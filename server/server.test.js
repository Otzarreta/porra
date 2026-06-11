const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ACCESS_TOKEN_SECRET = 'test-secret';

const {
  sanitizeResults,
  signAccessToken,
  verifyAccessToken,
  ACCESS_TOKEN_TTL_MS,
} = require('./server.js');

test('sanitizeResults preserves null', () => {
  assert.equal(sanitizeResults(null), null);
  assert.equal(sanitizeResults(undefined), null);
});

test('sanitizeResults rejects non-object payloads', () => {
  assert.throws(() => sanitizeResults('boom'), /results_not_object/);
  assert.throws(() => sanitizeResults([1, 2]), /results_not_object/);
});

test('sanitizeResults drops unknown teams and clamps invalid goals', () => {
  const out = sanitizeResults({
    groupMatches: {
      A: [
        {idx: 0, home: 'mexico', away: 'south-africa', goalsHome: 2, goalsAway: 1, result: '1'},
        {idx: 1, goalsHome: 999, goalsAway: 0},
        {idx: 7, result: '1'},
      ],
      Z: [{idx: 0, result: '1'}],
    },
    bracketAdvanced: {
      r32: ['mexico', 'made-up'],
      r16: ['brazil', 'brazil'],
      qf: 'not-array',
      sf: [],
      finalists: ['brazil', 'france'],
      champion: 'brazil',
    },
    teamGoals: {
      mexico: {for: 5, against: 3},
      'made-up': {for: 1, against: 1},
      brazil: {for: 'oops', against: 2},
    },
    playerGoals: {
      'p-lamine-yamal': 4,
      'p$bad': 9,
      'p-too-many': 999,
    },
    source: 'manual',
    lastUpdated: '2026-06-15T12:00:00Z',
  });

  assert.equal(out.groupMatches.A.length, 1);
  assert.equal(out.groupMatches.A[0].result, '1');
  assert.equal(out.groupMatches.Z, undefined);
  assert.deepEqual(out.bracketAdvanced.r32, ['mexico']);
  assert.deepEqual(out.bracketAdvanced.r16, ['brazil']);
  assert.deepEqual(out.bracketAdvanced.qf, []);
  assert.equal(out.bracketAdvanced.champion, 'brazil');
  assert.deepEqual(out.teamGoals.mexico, {for: 5, against: 3});
  assert.equal(out.teamGoals['made-up'], undefined);
  assert.deepEqual(out.teamGoals.brazil, {for: 0, against: 2});
  assert.equal(out.playerGoals['p-lamine-yamal'], 4);
  assert.equal(out.playerGoals['p$bad'], undefined);
  assert.equal(out.playerGoals['p-too-many'], undefined);
});

test('sanitizeResults derives 1x2 from goals when result missing', () => {
  const out = sanitizeResults({
    groupMatches: {
      A: [{idx: 0, goalsHome: 0, goalsAway: 2}],
    },
  });
  assert.equal(out.groupMatches.A[0].result, '2');
});

test('sanitizeResults conserva el directorio de goleadores saneado', () => {
  const out = sanitizeResults({
    scorers: {
      '365-251296': {name: 'Julian Quinones', teamId: 'mexico'},
      '365-9999': {name: 'Equipo Falso', teamId: 'made-up'},
      '$$$': {name: 'X', teamId: 'spain'},
      '365-1': 'not-an-object',
    },
  });

  assert.deepEqual(out.scorers, {
    '365-251296': {name: 'Julian Quinones', teamId: 'mexico'},
    '365-9999': {name: 'Equipo Falso', teamId: ''},
  });
});

test('sanitizeResults preserva flags en vivo y calcula liveCount', () => {
  const out = sanitizeResults({
    groupMatches: {
      A: [
        {idx: 0, goalsHome: 1, goalsAway: 0, live: true, minute: "42'"},
        {idx: 1, goalsHome: 2, goalsAway: 2},
      ],
    },
    liveKnockout: [
      {round: 'r16', homeId: 'spain', awayId: 'france', goalsHome: 2, goalsAway: 1, minute: "67'"},
      {round: 'bad-round', homeId: 'spain', awayId: 'france', goalsHome: 1, goalsAway: 0},
      {round: 'qf', homeId: 'made-up', awayId: 'france', goalsHome: 1, goalsAway: 0},
    ],
  });

  assert.equal(out.groupMatches.A[0].live, true);
  assert.equal(out.groupMatches.A[0].minute, "42'");
  assert.equal(out.groupMatches.A[1].live, undefined);
  assert.deepEqual(out.liveKnockout, [
    {round: 'r16', homeId: 'spain', awayId: 'france', goalsHome: 2, goalsAway: 1, minute: "67'"},
  ]);
  assert.equal(out.liveCount, 2);
});

test('access tokens expire after TTL', () => {
  const now = 1_700_000_000_000;
  const token = signAccessToken({porraId: 'abc', email: 'foo@bar.com', now});

  const fresh = verifyAccessToken(token, now + 1000);
  assert.equal(fresh?.porraId, 'abc');

  const expired = verifyAccessToken(token, now + ACCESS_TOKEN_TTL_MS + 1);
  assert.equal(expired, null);
});

test('verifyAccessToken rejects tampered signatures', () => {
  const token = signAccessToken({porraId: 'abc', email: 'foo@bar.com'});
  const [body] = token.split('.');
  const tampered = `${body}.AAAA`;
  assert.equal(verifyAccessToken(tampered), null);
});

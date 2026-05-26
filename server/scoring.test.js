const test = require('node:test');
const assert = require('node:assert/strict');

const {computeScore} = require('./scoring.js');

test('computeScore returns zero without real results', () => {
  const porra = {
    groupPredictions: {
      A: [{homeGoals: 2, awayGoals: 1}],
    },
    bracketWinners: {
      M73: 'mexico',
      M104: 'brazil',
    },
    topScorerTeam: 'mexico',
    topScorerPlayerId: 'player-1',
  };
  const score = computeScore(porra, null);
  assert.equal(score.total, 0);
});

test('group stage: signo acertado da 1 punto, marcador exacto da 2', () => {
  const porra = {
    groupPredictions: {
      A: [
        {homeGoals: 2, awayGoals: 1},
        {homeGoals: 1, awayGoals: 0},
      ],
    },
  };
  const results = {
    groupMatches: {
      A: [
        {idx: 0, result: '1', goalsHome: 2, goalsAway: 1},
        {idx: 1, result: '1', goalsHome: 3, goalsAway: 2},
      ],
    },
  };
  const score = computeScore(porra, results);
  assert.equal(score.grupos, 3);
});

test('R32 winner=2, exact=3 (replaces winner)', () => {
  const porra = {
    bracketWinners: {M73: 'mexico'},
    bracketScores: {M73: {homeGoals: 1, awayGoals: 0}},
    groupPredictions: {A: [{homeGoals: 1, awayGoals: 0}, {homeGoals: 1, awayGoals: 0}, {homeGoals: 1, awayGoals: 0}, {homeGoals: 1, awayGoals: 0}, {homeGoals: 1, awayGoals: 0}, {homeGoals: 1, awayGoals: 0}]},
  };
  const winnerOnly = computeScore(porra, {
    bracketAdvanced: {r32: ['mexico']},
    knockoutMatches: {r32: [{homeId: 'mexico', awayId: 'south-africa', goalsHome: 2, goalsAway: 1, winner: 'mexico'}]},
  });
  assert.equal(winnerOnly.r32, 2);

  const exact = computeScore({...porra, bracketScores: {M73: {homeGoals: 1, awayGoals: 0}}}, {
    bracketAdvanced: {r32: ['mexico']},
    knockoutMatches: {r32: [{homeId: 'mexico', awayId: 'south-africa', goalsHome: 1, goalsAway: 0, winner: 'mexico'}]},
  });
  assert.equal(exact.r32, 3);
});

test('Final: winner=10, exact=15', () => {
  const porra = {
    bracketWinners: {M104: 'brazil'},
    bracketScores: {M104: {homeGoals: 2, awayGoals: 1}},
  };
  const winnerOnly = computeScore(porra, {
    bracketAdvanced: {champion: 'brazil', finalists: ['brazil', 'france']},
    knockoutMatches: {final: [{homeId: 'brazil', awayId: 'france', goalsHome: 3, goalsAway: 0, winner: 'brazil'}]},
  });
  assert.equal(winnerOnly.final, 10);

  const exact = computeScore(porra, {
    bracketAdvanced: {champion: 'brazil', finalists: ['brazil', 'france']},
    knockoutMatches: {final: [{homeId: 'brazil', awayId: 'france', goalsHome: 2, goalsAway: 1, winner: 'brazil'}]},
  });
  assert.equal(exact.final, 15);
});

test('Especiales: 10 ptos top scorer team y 10 ptos top scorer player', () => {
  const porra = {
    topScorerTeam: 'brazil',
    topScorerPlayerId: 'p-vinicius',
  };
  const results = {
    bracketAdvanced: {topScorerTeam: 'brazil'},
    topScorerPlayerId: 'p-vinicius',
    teamGoals: {brazil: {for: 10, against: 2}},
    playerGoals: {'p-vinicius': 6},
  };
  const score = computeScore(porra, results);
  assert.equal(score.especiales, 20);
});

test('Especiales: top scorer team se infiere de teamGoals si no viene marcado', () => {
  const porra = {topScorerTeam: 'brazil'};
  const results = {
    teamGoals: {brazil: {for: 10, against: 2}, france: {for: 7, against: 3}},
    playerGoals: {},
  };
  const score = computeScore(porra, results);
  assert.equal(score.especiales, 10);
});

test('Bracket exact: marcador desigual al real => solo puntos por ganador', () => {
  const porra = {
    bracketWinners: {M73: 'mexico'},
    bracketScores: {M73: {homeGoals: 3, awayGoals: 0}},
  };
  const results = {
    bracketAdvanced: {r32: ['mexico']},
    knockoutMatches: {r32: [{homeId: 'mexico', awayId: 'czech-republic', goalsHome: 2, goalsAway: 1, winner: 'mexico'}]},
  };
  const score = computeScore(porra, results);
  assert.equal(score.r32, 2);
});

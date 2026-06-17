const test = require('node:test');
const assert = require('node:assert/strict');

const {computeScore, computeScoreDetailed, reconcileScorerIds} = require('./scoring.js');

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

test('Especiales: 1 punto por gol marcado/recibido/anotado por la elección', () => {
  const porra = {
    topScorerTeam: 'brazil',
    worstDefenseTeam: 'france',
    topScorerPlayerId: 'p-vinicius',
  };
  const results = {
    teamGoals: {brazil: {for: 17, against: 2}, france: {for: 7, against: 9}},
    playerGoals: {'p-vinicius': 6},
  };
  const score = computeScore(porra, results);
  // 17 goles a favor de brazil + 9 recibidos por france + 6 de vinicius
  assert.equal(score.especiales, 32);
});

test('Especiales: la elección suma sus goles aunque no sea la máxima', () => {
  const porra = {topScorerTeam: 'argentina', topScorerPlayerId: 'p-messi'};
  const results = {
    teamGoals: {brazil: {for: 20, against: 1}, argentina: {for: 12, against: 4}},
    playerGoals: {'p-mbappe': 9, 'p-messi': 7},
  };
  const score = computeScore(porra, results);
  // argentina suma sus 12 goles aunque brazil meta más; messi suma 7 aunque mbappe meta más
  assert.equal(score.especiales, 19);
});

test('Especiales: sin goles registrados no suma', () => {
  const porra = {topScorerTeam: 'brazil', worstDefenseTeam: 'spain', topScorerPlayerId: 'p-x'};
  const score = computeScore(porra, {teamGoals: {}, playerGoals: {}});
  assert.equal(score.especiales, 0);
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

test('reconcileScorerIds: remapea el id de gol al id de plantilla por nombre+selección', () => {
  const players = [{id: '365-39820', name: 'Kylian Mbappe', teamId: 'france'}];
  const results = {
    playerGoals: {'365-1589889': 2},
    scorers: {'365-1589889': {name: 'Kylian Mbappe', teamId: 'france'}},
  };
  const fixed = reconcileScorerIds(results, players);
  assert.equal(fixed.playerGoals['365-39820'], 2);
  assert.equal(fixed.playerGoals['365-1589889'], undefined);

  // Y ahora el especial del jugador elegido (id de plantilla) sí puntúa.
  const porra = {topScorerPlayerId: '365-39820'};
  assert.equal(computeScore(porra, fixed).especiales, 2);

  // Sin coincidencia de plantilla, conserva el id original (no se pierde el gol).
  const orphan = reconcileScorerIds(results, []);
  assert.equal(orphan.playerGoals['365-1589889'], 2);

  // Idempotente: aplicar dos veces no cambia el resultado.
  assert.deepEqual(reconcileScorerIds(fixed, players), fixed);
});

test('computeScoreDetailed: el breakdown coincide con computeScore y los eventos suman cada categoría', () => {
  const porra = {
    groupPredictions: {
      A: [{homeGoals: 2, awayGoals: 1}, {homeGoals: 1, awayGoals: 0}],
    },
    bracketWinners: {M73: 'mexico', M104: 'brazil'},
    bracketScores: {M73: {homeGoals: 1, awayGoals: 0}, M104: {homeGoals: 2, awayGoals: 1}},
    topScorerTeam: 'brazil',
    worstDefenseTeam: 'france',
    topScorerPlayerId: 'p-vinicius',
  };
  const results = {
    groupMatches: {
      A: [
        {idx: 0, home: 'mexico', away: 'south-africa', result: '1', goalsHome: 2, goalsAway: 1},
        {idx: 1, home: 'south-korea', away: 'czech-republic', result: '1', goalsHome: 3, goalsAway: 2},
      ],
    },
    bracketAdvanced: {r32: ['mexico'], champion: 'brazil', finalists: ['brazil', 'france']},
    knockoutMatches: {
      r32: [{homeId: 'mexico', awayId: 'south-africa', goalsHome: 1, goalsAway: 0, winner: 'mexico'}],
      final: [{homeId: 'brazil', awayId: 'france', goalsHome: 2, goalsAway: 1, winner: 'brazil'}],
    },
    teamGoals: {brazil: {for: 17, against: 2}, france: {for: 7, against: 9}},
    playerGoals: {'p-vinicius': 6},
  };

  const {breakdown, events} = computeScoreDetailed(porra, results);

  // El envoltorio computeScore debe devolver exactamente el mismo breakdown.
  assert.deepEqual(computeScore(porra, results), breakdown);

  // La suma de los puntos de los eventos coincide con cada categoría del breakdown.
  const sum = arr => arr.reduce((s, e) => s + e.points, 0);
  assert.equal(sum(events.grupos), breakdown.grupos);
  assert.equal(sum(events.especiales), breakdown.especiales);
  const bracketSum = {};
  events.bracket.forEach(e => { bracketSum[e.phase] = (bracketSum[e.phase] || 0) + e.points; });
  ['r32', 'r16', 'qf', 'sf', 'third', 'final'].forEach(r => {
    assert.equal(bracketSum[r] || 0, breakdown[r]);
  });
  // Y la suma global de todos los eventos coincide con el total.
  const totalEvents = sum(events.grupos) + sum(events.especiales) + sum(events.bracket);
  assert.equal(totalEvents, breakdown.total);
});

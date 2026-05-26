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

  assert.equal(score.grupos, 0);
  assert.equal(score.r32, 0);
  assert.equal(score.champion, 0);
  assert.equal(score.especiales, 0);
  assert.equal(score.total, 0);
});

test('computeScore compares score-derived group signs, bracket, team goals and player goals', () => {
  const porra = {
    groupPredictions: {
      A: [
        {homeGoals: 2, awayGoals: 1},
        {homeGoals: 0, awayGoals: 0},
      ],
    },
    bracketWinners: {
      M73: 'mexico',
      M89: 'brazil',
      M97: 'brazil',
      M101: 'brazil',
      M104: 'brazil',
    },
    topScorerTeam: 'mexico',
    bestDefenseTeam: 'brazil',
    topScorerPlayerId: 'p-lamine-yamal',
  };
  const results = {
    groupMatches: {
      A: [
        {idx: 0, result: '1'},
        {idx: 1, result: '2'},
      ],
    },
    bracketAdvanced: {
      r32: ['mexico'],
      r16: ['brazil'],
      qf: ['brazil'],
      sf: ['brazil'],
      finalists: ['brazil', 'france'],
      champion: 'brazil',
    },
    teamGoals: {
      mexico: {for: 5, against: 3},
      brazil: {for: 9, against: 2},
    },
    playerGoals: {
      'p-lamine-yamal': 4,
    },
  };

  const score = computeScore(porra, results);

  assert.equal(score.grupos, 1);
  assert.equal(score.r32, 2);
  assert.equal(score.r16, 3);
  assert.equal(score.qf, 4);
  assert.equal(score.sf, 6);
  assert.equal(score.finalists, 8);
  assert.equal(score.champion, 10);
  assert.equal(score.especiales, 11);
  assert.equal(score.total, 45);
});

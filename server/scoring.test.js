const test = require('node:test');
const assert = require('node:assert/strict');

const {computeScore} = require('./scoring.js');

test('computeScore estimates points when there are no real results', () => {
  const porra = {
    groupResults: {
      A: ['1', 'x', null, null, null, null],
      B: ['2', null, null, null, null, null],
    },
    bracketWinners: {
      m1: 'México',
      r16_1: 'México',
      qf_1: 'México',
      sf_1: 'México',
    },
    finalist1: 'México',
    finalist2: 'Brasil',
    champion: 'México',
  };

  const score = computeScore(porra, null);

  assert.equal(score.grupos, 3);
  assert.equal(score.r32, 2);
  assert.equal(score.r16, 3);
  assert.equal(score.qf, 4);
  assert.equal(score.sf, 6);
  assert.equal(score.finalists, 16);
  assert.equal(score.champion, 10);
  assert.equal(score.total, 44);
});

test('computeScore compares group, bracket, team goals and player goals', () => {
  const porra = {
    groupResults: {
      A: ['1', 'x', null, null, null, null],
    },
    bracketWinners: {
      m1: 'México',
      r16_1: 'Brasil',
      qf_1: 'Brasil',
      sf_1: 'Brasil',
    },
    finalist1: 'Brasil',
    finalist2: 'México',
    champion: 'Brasil',
    topScorerTeam: 'México',
    bestDefenseTeam: 'Brasil',
    topScorerPlayer: 'LAMINE YAMAL',
  };
  const results = {
    groupMatches: {
      A: [
        {idx: 0, result: '1'},
        {idx: 1, result: '2'},
      ],
    },
    bracketAdvanced: {
      r32: ['México'],
      r16: ['Brasil'],
      qf: ['Brasil'],
      sf: ['Brasil'],
      finalists: ['Brasil', 'Francia'],
      champion: 'Brasil',
    },
    teamGoals: {
      'México': {for: 5, against: 3},
      'Brasil': {for: 9, against: 2},
    },
    playerGoals: {
      'Lamine Yamal': 4,
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

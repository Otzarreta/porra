const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GROUP_ORDER,
  createEmptyGroupPredictions,
  buildGroupStandings,
  rankThirdPlaced,
  getThirdPlaceAssignments,
  resolveBracketMatches,
} = require('../public/fixtures.js');

test('group standings use head-to-head before overall goal difference', () => {
  const predictions = [
    {homeGoals: 1, awayGoals: 0},
    {homeGoals: 0, awayGoals: 1},
    {homeGoals: 0, awayGoals: 2},
    {homeGoals: 0, awayGoals: 1},
    {homeGoals: 0, awayGoals: 2},
    {homeGoals: 2, awayGoals: 0},
  ];

  const standings = buildGroupStandings('A', predictions);

  assert.equal(standings[0].teamId, 'mexico');
  assert.equal(standings[1].teamId, 'south-africa');
  assert.equal(standings[0].points, standings[1].points);
  assert.ok(standings[1].gd > standings[0].gd);
});

test('third-place ranking uses points, goal difference, goals for and fallback order', () => {
  const standingsByGroup = {
    A: [null, null, row('A', 'a3', 4, 1, 3, 10)],
    B: [null, null, row('B', 'b3', 4, 2, 2, 20)],
    C: [null, null, row('C', 'c3', 4, 2, 4, 30)],
    D: [null, null, row('D', 'd3', 3, 5, 9, 40)],
  };
  GROUP_ORDER.forEach((group, index) => {
    standingsByGroup[group] ||= [null, null, row(group, `${group}3`, 1, 0, 1, 100 + index)];
  });

  const ranking = rankThirdPlaced(standingsByGroup);

  assert.equal(ranking[0].teamId, 'c3');
  assert.equal(ranking[1].teamId, 'b3');
  assert.equal(ranking[2].teamId, 'a3');
});

test('Annexe C returns official third-place assignment rows', () => {
  assert.deepEqual(getThirdPlaceAssignments('EFGHIJKL'.split('')), {
    A: 'E',
    B: 'J',
    D: 'I',
    E: 'F',
    G: 'H',
    I: 'G',
    K: 'L',
    L: 'K',
  });
  assert.deepEqual(getThirdPlaceAssignments('ABCDEFGH'.split('')), {
    A: 'H',
    B: 'G',
    D: 'B',
    E: 'C',
    G: 'A',
    I: 'F',
    K: 'D',
    L: 'E',
  });
});

test('official bracket resolves M73-M104 and propagates winners', () => {
  const predictions = createSeedOrderPredictions();
  const first = resolveBracketMatches(predictions, {});

  assert.equal(first.matches.M73.slots[0], 'south-africa');
  assert.equal(first.matches.M73.slots[1], 'bosnia-herzegovina');
  assert.equal(first.matches.M79.slots[0], 'mexico');
  assert.equal(first.matches.M79.slots[1], 'saudi-arabia');

  const propagated = resolveBracketMatches(predictions, {
    M79: 'mexico',
    M80: 'england',
  });

  assert.deepEqual(propagated.matches.M92.slots, ['mexico', 'england']);
});

function createSeedOrderPredictions() {
  const predictions = createEmptyGroupPredictions();
  GROUP_ORDER.forEach(group => {
    predictions[group] = [
      {homeGoals: 3, awayGoals: 0},
      {homeGoals: 2, awayGoals: 0},
      {homeGoals: 2, awayGoals: 0},
      {homeGoals: 0, awayGoals: 2},
      {homeGoals: 0, awayGoals: 3},
      {homeGoals: 2, awayGoals: 0},
    ];
  });
  return predictions;
}

function row(group, teamId, points, gd, gf, fallbackRank) {
  return {thirdGroup: group, group, teamId, points, gd, gf, fallbackRank};
}

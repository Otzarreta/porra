const test = require('node:test');
const assert = require('node:assert/strict');

const {normalize365ScoresGames} = require('./scraper.js');

test('normalize365ScoresGames maps a 365Scores group match into groupMatches', () => {
  const results = normalize365ScoresGames([
    {
      id: 1001,
      competitionId: 5930,
      groupName: 'Group A',
      competitionDisplayName: 'FIFA World Cup - Group A',
      statusGroup: 4,
      homeCompetitor: {name: 'Mexico', nameForURL: 'mexico', score: 2},
      awayCompetitor: {name: 'South Africa', nameForURL: 'south-africa', score: 1},
    },
  ], new Date('2026-06-11T22:00:00Z'));

  assert.deepEqual(results.groupMatches.A, [
    {
      idx: 0,
      home: 'México',
      away: 'Sudáfrica',
      goalsHome: 2,
      goalsAway: 1,
      result: '1',
      sourceGameId: 1001,
    },
  ]);
  assert.equal(results.teamGoals['México'].for, 2);
  assert.equal(results.teamGoals['México'].against, 1);
  assert.equal(results.teamGoals['Sudáfrica'].for, 1);
  assert.equal(results.teamGoals['Sudáfrica'].against, 2);
  assert.deepEqual(results.playerGoals, {});
});

test('normalize365ScoresGames keeps fixture result perspective if source home/away is reversed', () => {
  const results = normalize365ScoresGames([
    {
      id: 1002,
      competitionId: 5930,
      groupName: 'Group A',
      competitionDisplayName: 'FIFA World Cup - Group A',
      statusGroup: 4,
      homeCompetitor: {name: 'South Africa', nameForURL: 'south-africa', score: 0},
      awayCompetitor: {name: 'Mexico', nameForURL: 'mexico', score: 1},
    },
  ], new Date('2026-06-11T22:00:00Z'));

  assert.equal(results.groupMatches.A[0].idx, 0);
  assert.equal(results.groupMatches.A[0].result, '1');
});

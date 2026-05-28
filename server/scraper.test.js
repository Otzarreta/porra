const test = require('node:test');
const assert = require('node:assert/strict');

const {normalize365ScoresGames, aggregatePlayerGoals} = require('./scraper.js');

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
      home: 'mexico',
      away: 'south-africa',
      goalsHome: 2,
      goalsAway: 1,
      result: '1',
      sourceGameId: 1001,
    },
  ]);
  assert.equal(results.teamGoals.mexico.for, 2);
  assert.equal(results.teamGoals.mexico.against, 1);
  assert.equal(results.teamGoals['south-africa'].for, 1);
  assert.equal(results.teamGoals['south-africa'].against, 2);
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
  assert.equal(results.groupMatches.A[0].home, 'mexico');
  assert.equal(results.groupMatches.A[0].away, 'south-africa');
  assert.equal(results.groupMatches.A[0].goalsHome, 1);
  assert.equal(results.groupMatches.A[0].goalsAway, 0);
  assert.equal(results.groupMatches.A[0].result, '1');
});

test('aggregatePlayerGoals cuenta gol normal y penalti, excluye gol en propia y no-goles', () => {
  const eventsList = [
    [
      {playerId: 111, eventType: {id: 1, subTypeId: 1, subTypeName: 'Field Goal'}},
      {playerId: 222, eventType: {id: 1, subTypeId: 3, subTypeName: 'Penalty'}},
      {playerId: 333, eventType: {id: 1, subTypeId: 2, subTypeName: 'Own Goal'}},
      {playerId: 444, eventType: {id: 2, subTypeId: -1, subTypeName: 'Yellow Card'}},
    ],
    [
      {playerId: 111, eventType: {id: 1, subTypeId: 1, subTypeName: 'Field Goal'}},
      {eventType: {id: 1, subTypeId: 1}},
    ],
  ];

  assert.deepEqual(aggregatePlayerGoals(eventsList), {
    '365-111': 2,
    '365-222': 1,
  });
});

test('aggregatePlayerGoals tolera entradas vacías', () => {
  assert.deepEqual(aggregatePlayerGoals(), {});
  assert.deepEqual(aggregatePlayerGoals([null, [], undefined]), {});
});

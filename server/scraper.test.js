const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalize365ScoresGames,
  aggregatePlayerGoals,
  createResultsTracker,
  tickDates,
  isLiveGame,
  extractGameScorers,
} = require('./scraper.js');

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

test('aggregatePlayerGoals excluye los lanzamientos de la tanda de penales (stage 11)', () => {
  const eventsList = [
    [
      // Gol en juego y penalti dentro del partido sí cuentan.
      {playerId: 111, stageId: 7, eventType: {id: 1, subTypeId: 1, subTypeName: 'Field Goal'}},
      {playerId: 222, stageId: 9, gameTime: 65, eventType: {id: 1, subTypeId: 3, subTypeName: 'Penalty'}},
      // Gol en la prórroga (stage 10) también cuenta.
      {playerId: 222, stageId: 10, gameTime: 105, eventType: {id: 1, subTypeId: 1, subTypeName: 'Field Goal'}},
      // Lanzamientos de la tanda (stage 11): no cuentan.
      {playerId: 111, stageId: 11, gameTime: 121, eventType: {id: 1, subTypeId: 3, subTypeName: 'Penalty'}},
      {playerId: 333, stageId: 11, gameTime: 122, eventType: {id: 1, subTypeId: 3, subTypeName: 'Penalty'}},
      {playerId: 444, stageId: 11, gameTime: 123, eventType: {id: 1, subTypeId: 3, subTypeName: 'Penalty'}},
    ],
  ];

  assert.deepEqual(aggregatePlayerGoals(eventsList), {
    '365-111': 1,
    '365-222': 2,
  });
});

test('normalize365ScoresGames clasifica el 3er puesto y resuelve penales sin sumar goles de tanda', () => {
  const results = normalize365ScoresGames([
    {
      id: 2103,
      competitionId: 5930,
      competitionDisplayName: 'FIFA World Cup - 3rd Place',
      roundName: '3rd Place',
      statusGroup: 4,
      statusText: 'After Penalties',
      homeCompetitor: {name: 'Croatia', nameForURL: 'croatia', score: 1, isWinner: false},
      awayCompetitor: {name: 'Morocco', nameForURL: 'morocco', score: 1, isWinner: true},
    },
  ], new Date('2026-07-18T22:00:00Z'));

  assert.deepEqual(results.bracketAdvanced.third, ['morocco']);
  assert.equal(results.knockoutMatches.third.length, 1);
  assert.equal(results.knockoutMatches.third[0].winner, 'morocco');
  assert.equal(results.knockoutMatches.third[0].goalsHome, 1);
  assert.equal(results.knockoutMatches.third[0].goalsAway, 1);
  // El marcador es el de los 120', sin goles de la tanda.
  assert.equal(results.teamGoals.croatia.for, 1);
  assert.equal(results.teamGoals.morocco.for, 1);
  // No debe clasificarse como final ni proclamar campeón.
  assert.equal(results.knockoutMatches.final.length, 0);
  assert.equal(results.bracketAdvanced.champion, null);
});

test('normalize365ScoresGames ignora partidos suspendidos aunque tengan statusGroup 4', () => {
  const results = normalize365ScoresGames([
    {
      id: 3001,
      competitionId: 5930,
      groupName: 'Group A',
      statusGroup: 4,
      statusText: 'Suspended',
      homeCompetitor: {name: 'Mexico', nameForURL: 'mexico', score: 1},
      awayCompetitor: {name: 'South Africa', nameForURL: 'south-africa', score: 0},
    },
  ], new Date('2026-06-11T22:00:00Z'));

  assert.deepEqual(results.groupMatches, {});
  assert.deepEqual(results.teamGoals, {});
});

test('aggregatePlayerGoals tolera entradas vacías', () => {
  assert.deepEqual(aggregatePlayerGoals(), {});
  assert.deepEqual(aggregatePlayerGoals([null, [], undefined]), {});
});

test('normalize365ScoresGames incluye partidos de grupos en vivo con flag y minuto', () => {
  const results = normalize365ScoresGames([
    {
      id: 1001,
      competitionId: 5930,
      groupName: 'Group A',
      statusGroup: 3,
      statusText: '1st Half',
      gameTimeDisplay: "42'",
      startTime: '2026-06-11T21:00:00+02:00',
      homeCompetitor: {name: 'Mexico', nameForURL: 'mexico', score: 1},
      awayCompetitor: {name: 'South Africa', nameForURL: 'south-africa', score: 0},
    },
  ], new Date('2026-06-11T19:45:00Z'));

  assert.deepEqual(results.groupMatches.A, [
    {
      idx: 0,
      home: 'mexico',
      away: 'south-africa',
      goalsHome: 1,
      goalsAway: 0,
      result: '1',
      sourceGameId: 1001,
      live: true,
      minute: "42'",
    },
  ]);
  assert.equal(results.liveCount, 1);
  assert.equal(results.teamGoals.mexico.for, 1);
  assert.equal(results.teamGoals['south-africa'].against, 1);
});

test('normalize365ScoresGames pone los cruces en vivo en liveKnockout sin avanzar equipos', () => {
  const results = normalize365ScoresGames([
    {
      id: 2001,
      competitionId: 5930,
      roundName: 'Round of 16',
      statusGroup: 3,
      statusText: '2nd Half',
      gameTimeDisplay: "67'",
      startTime: '2026-07-05T21:00:00+02:00',
      homeCompetitor: {name: 'Spain', nameForURL: 'spain', score: 2},
      awayCompetitor: {name: 'France', nameForURL: 'france', score: 1},
    },
  ], new Date('2026-07-05T20:10:00Z'));

  assert.deepEqual(results.liveKnockout, [
    {
      round: 'r16',
      homeId: 'spain',
      awayId: 'france',
      goalsHome: 2,
      goalsAway: 1,
      minute: "67'",
      sourceGameId: 2001,
    },
  ]);
  assert.equal(results.liveCount, 1);
  assert.deepEqual(results.bracketAdvanced.r16, []);
  assert.deepEqual(results.knockoutMatches.r16, []);
  // Los goles en vivo sí cuentan provisionalmente para los especiales.
  assert.equal(results.teamGoals.spain.for, 2);
});

test('isLiveGame no marca en vivo partidos programados ni suspendidos', () => {
  const nowMs = Date.parse('2026-06-11T19:45:00Z');
  assert.equal(isLiveGame({
    statusGroup: 2,
    startTime: '2026-06-12T18:00:00+02:00',
    homeCompetitor: {score: -1},
    awayCompetitor: {score: -1},
  }, nowMs), false);
  assert.equal(isLiveGame({
    statusGroup: 3,
    statusText: 'Suspended',
    startTime: '2026-06-11T21:00:00+02:00',
    homeCompetitor: {score: 1},
    awayCompetitor: {score: 0},
  }, nowMs), false);
});

test('tickDates devuelve hoy y ayer en horario de Madrid dentro del torneo', () => {
  // 02:00 en Madrid del 12 de junio: aún hay partidos del día 11 en juego en América.
  const dates = tickDates(new Date('2026-06-12T00:00:00Z')).map(d => d.toISOString().slice(0, 10));
  assert.deepEqual(dates, ['2026-06-11', '2026-06-12']);
  // Primer día del torneo: ayer queda fuera de ventana.
  const opening = tickDates(new Date('2026-06-11T20:00:00Z')).map(d => d.toISOString().slice(0, 10));
  assert.deepEqual(opening, ['2026-06-11']);
});

function makeFetchStub({gamesByDate = {}, detailsByGame = {}} = {}) {
  const calls = {dates: [], events: []};
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname.includes('/web/games/allscores')) {
      const date = parsed.searchParams.get('startDate');
      calls.dates.push(date);
      return {ok: true, json: async () => ({games: gamesByDate[date] || []})};
    }
    if (parsed.pathname.includes('/web/game')) {
      const gameId = parsed.searchParams.get('gameId');
      calls.events.push(gameId);
      return {ok: true, json: async () => ({game: detailsByGame[gameId] || {events: []}})};
    }
    throw new Error(`unexpected url ${url}`);
  };
  return {fetchImpl, calls};
}

test('createResultsTracker: el tick consulta solo hoy/ayer y conserva lo del barrido completo', async () => {
  const finishedGame = {
    id: 1,
    competitionId: 5930,
    groupName: 'Group B',
    statusGroup: 4,
    startTime: '2026-06-12T18:00:00+02:00',
    homeCompetitor: {name: 'Canada', nameForURL: 'canada', score: 2},
    awayCompetitor: {name: 'Bosnia and Herzegovina', nameForURL: 'bosnia-and-herzegovina', score: 0},
  };
  const liveGame = {
    id: 2,
    competitionId: 5930,
    groupName: 'Group A',
    statusGroup: 3,
    gameTimeDisplay: "30'",
    startTime: '2026-06-13T21:00:00+02:00',
    homeCompetitor: {name: 'Mexico', nameForURL: 'mexico', score: 1},
    awayCompetitor: {name: 'South Korea', nameForURL: 'south-korea', score: 1},
  };
  const {fetchImpl, calls} = makeFetchStub({
    gamesByDate: {
      '12/06/2026': [finishedGame],
      '13/06/2026': [liveGame],
    },
  });
  const tracker = createResultsTracker({fetchImpl});

  const full = await tracker.refresh({full: true, now: new Date('2026-06-13T20:00:00Z')});
  assert.equal(calls.dates.length, 39);
  assert.equal(full.groupMatches.B[0].goalsHome, 2);

  calls.dates.length = 0;
  const tick = await tracker.refresh({now: new Date('2026-06-13T20:00:00Z')});
  assert.deepEqual(calls.dates, ['12/06/2026', '13/06/2026']);
  // El partido terminado del barrido completo sigue presente tras el tick.
  assert.equal(tick.groupMatches.B[0].goalsHome, 2);
  assert.equal(tick.groupMatches.B[0].live, undefined);
  assert.deepEqual(tick.groupMatches.A.find(m => m.idx === 2), {
    idx: 2,
    home: 'mexico',
    away: 'south-korea',
    goalsHome: 1,
    goalsAway: 1,
    result: 'x',
    sourceGameId: 2,
    live: true,
    minute: "30'",
  });
  assert.equal(tick.liveCount, 1);
});

test('createResultsTracker: cachea eventos de partidos terminados y refresca los vivos', async () => {
  const finishedGame = {
    id: 11,
    competitionId: 5930,
    groupName: 'Group A',
    statusGroup: 4,
    startTime: '2026-06-13T18:00:00+02:00',
    homeCompetitor: {name: 'Mexico', nameForURL: 'mexico', score: 1},
    awayCompetitor: {name: 'South Africa', nameForURL: 'south-africa', score: 0},
  };
  const liveGame = {
    id: 12,
    competitionId: 5930,
    groupName: 'Group B',
    statusGroup: 3,
    startTime: '2026-06-13T21:00:00+02:00',
    homeCompetitor: {name: 'Canada', nameForURL: 'canada', score: 1},
    awayCompetitor: {name: 'Qatar', nameForURL: 'qatar', score: 0},
  };
  const {fetchImpl, calls} = makeFetchStub({
    gamesByDate: {'13/06/2026': [finishedGame, liveGame]},
    detailsByGame: {
      11: {
        events: [{playerId: 111, competitorId: 91, eventType: {id: 1, subTypeId: 1}}],
        members: [{id: 111, competitorId: 91, name: 'Raul Jimenez'}],
        homeCompetitor: {id: 91, name: 'Mexico', nameForURL: 'mexico'},
        awayCompetitor: {id: 92, name: 'South Africa', nameForURL: 'south-africa'},
      },
      12: {
        events: [{playerId: 222, competitorId: 93, eventType: {id: 1, subTypeId: 1}}],
        members: [{id: 222, competitorId: 93, name: 'Jonathan David'}],
        homeCompetitor: {id: 93, name: 'Canada', nameForURL: 'canada'},
        awayCompetitor: {id: 94, name: 'Qatar', nameForURL: 'qatar'},
      },
    },
  });
  const tracker = createResultsTracker({fetchImpl});
  const now = new Date('2026-06-13T20:00:00Z');

  const first = await tracker.refresh({now});
  assert.deepEqual(first.playerGoals, {'365-111': 1, '365-222': 1});
  assert.deepEqual(first.scorers, {
    '365-111': {name: 'Raul Jimenez', teamId: 'mexico'},
    '365-222': {name: 'Jonathan David', teamId: 'canada'},
  });

  await tracker.refresh({now});
  const eventCalls = calls.events.reduce((acc, id) => ({...acc, [id]: (acc[id] || 0) + 1}), {});
  // El terminado se consulta una vez; el vivo, en cada tick.
  assert.deepEqual(eventCalls, {11: 1, 12: 2});
});

test('extractGameScorers resuelve nombre y selección desde members y competitorId', () => {
  const scorers = extractGameScorers({
    homeCompetitor: {id: 91, name: 'Mexico', nameForURL: 'mexico'},
    awayCompetitor: {id: 92, name: 'South Africa', nameForURL: 'south-africa'},
    members: [
      {id: 111, competitorId: 91, name: 'Julian Quinones'},
      {id: 333, competitorId: 92, name: 'Defensa Propia'},
    ],
    events: [
      {playerId: 111, competitorId: 91, eventType: {id: 1, subTypeId: 1}},
      // Gol en propia puerta: no aparece como goleador.
      {playerId: 333, competitorId: 92, eventType: {id: 1, subTypeId: 2}},
      // Tanda de penales: tampoco.
      {playerId: 111, stageId: 11, eventType: {id: 1, subTypeId: 3}},
      // Sin member conocido: cae al competitorId del evento.
      {playerId: 444, competitorId: 92, eventType: {id: 1, subTypeId: 1}},
    ],
  });

  assert.deepEqual(scorers, {
    '365-111': {name: 'Julian Quinones', teamId: 'mexico'},
    '365-444': {name: '', teamId: 'south-africa'},
  });
});

test('createResultsTracker: liveWindow y nextKickoff', async () => {
  const upcoming = {
    id: 21,
    competitionId: 5930,
    groupName: 'Group A',
    statusGroup: 2,
    startTime: '2026-06-13T21:00:00+02:00',
    homeCompetitor: {name: 'Mexico', nameForURL: 'mexico', score: -1},
    awayCompetitor: {name: 'South Korea', nameForURL: 'south-korea', score: -1},
  };
  const {fetchImpl} = makeFetchStub({gamesByDate: {'13/06/2026': [upcoming]}});
  const tracker = createResultsTracker({fetchImpl});
  await tracker.refresh({now: new Date('2026-06-13T10:00:00Z')});

  const kickoff = Date.parse('2026-06-13T19:00:00Z');
  assert.equal(tracker.nextKickoff(Date.parse('2026-06-13T10:00:00Z')), kickoff);
  // Lejos del kickoff no hay ventana en vivo; cerca o después (sin terminar), sí.
  assert.equal(tracker.liveWindow(Date.parse('2026-06-13T10:00:00Z')), false);
  assert.equal(tracker.liveWindow(kickoff - 5 * 60 * 1000), true);
  assert.equal(tracker.liveWindow(kickoff + 60 * 60 * 1000), true);
  assert.equal(tracker.liveWindow(kickoff + 5 * 60 * 60 * 1000), false);
});

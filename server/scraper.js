/* ═══════════════════════════════════════════════════════
   SCRAPER 365SCORES — resultados Mundial 2026
═══════════════════════════════════════════════════════ */
const {GROUPS, TEAMS, GROUP_FIXTURES} = require('../public/fixtures.js');

const SCRAPE_INTERVAL_MS = 30 * 60 * 1000;
const COMPETITION_ID = 5930;
const SCORES_URL = 'https://webws.365scores.com/web/games/allscores/';
const GAME_URL = 'https://webws.365scores.com/web/game/';
const GAME_DETAIL_CONCURRENCY = 5;
const GOAL_EVENT_TYPE_ID = 1;
const OWN_GOAL_SUBTYPE_ID = 2;
const PENALTY_SHOOTOUT_STAGE_ID = 11;
const TOURNAMENT_START = '2026-06-11';
const TOURNAMENT_END = '2026-07-19';
const GROUP_LETTERS = Object.keys(GROUPS);

const TEAM_SLUGS = {
  'mexico': 'mexico',
  'south-africa': 'south-africa',
  'south-korea': 'south-korea',
  'czech-republic': 'czech-republic',
  'czechia': 'czech-republic',
  'canada': 'canada',
  'bosnia-and-herzegovina': 'bosnia-herzegovina',
  'bosnia-herzegovina': 'bosnia-herzegovina',
  'qatar': 'qatar',
  'switzerland': 'switzerland',
  'brazil': 'brazil',
  'morocco': 'morocco',
  'haiti': 'haiti',
  'scotland': 'scotland',
  'usa': 'usa',
  'united-states': 'usa',
  'united-states-of-america': 'usa',
  'paraguay': 'paraguay',
  'australia': 'australia',
  'turkey': 'turkey',
  'turkiye': 'turkey',
  'germany': 'germany',
  'curacao': 'curacao',
  'curaçao': 'curacao',
  'ivory-coast': 'ivory-coast',
  'cote-d-ivoire': 'ivory-coast',
  'ecuador': 'ecuador',
  'netherlands': 'netherlands',
  'japan': 'japan',
  'sweden': 'sweden',
  'tunisia': 'tunisia',
  'belgium': 'belgium',
  'egypt': 'egypt',
  'iran': 'iran',
  'new-zealand': 'new-zealand',
  'spain': 'spain',
  'cape-verde': 'cape-verde',
  'cape-verde-islands': 'cape-verde',
  'saudi-arabia': 'saudi-arabia',
  'uruguay': 'uruguay',
  'france': 'france',
  'senegal': 'senegal',
  'iraq': 'iraq',
  'norway': 'norway',
  'argentina': 'argentina',
  'algeria': 'algeria',
  'austria': 'austria',
  'jordan': 'jordan',
  'portugal': 'portugal',
  'dr-congo': 'dr-congo',
  'd-r-congo': 'dr-congo',
  'congo-dr': 'dr-congo',
  'democratic-republic-of-the-congo': 'dr-congo',
  'uzbekistan': 'uzbekistan',
  'colombia': 'colombia',
  'england': 'england',
  'croatia': 'croatia',
  'ghana': 'ghana',
  'panama': 'panama',
};

const NAME_ALIASES = {
  'mexico': 'mexico',
  'south africa': 'south-africa',
  'korea republic': 'south-korea',
  'south korea': 'south-korea',
  'czech republic': 'czech-republic',
  'czechia': 'czech-republic',
  'canada': 'canada',
  'bosnia and herzegovina': 'bosnia-herzegovina',
  'qatar': 'qatar',
  'switzerland': 'switzerland',
  'brazil': 'brazil',
  'morocco': 'morocco',
  'haiti': 'haiti',
  'scotland': 'scotland',
  'usa': 'usa',
  'united states': 'usa',
  'united states of america': 'usa',
  'paraguay': 'paraguay',
  'australia': 'australia',
  'turkey': 'turkey',
  'turkiye': 'turkey',
  'germany': 'germany',
  'curacao': 'curacao',
  'ivory coast': 'ivory-coast',
  "cote d'ivoire": 'ivory-coast',
  'ecuador': 'ecuador',
  'netherlands': 'netherlands',
  'japan': 'japan',
  'sweden': 'sweden',
  'tunisia': 'tunisia',
  'belgium': 'belgium',
  'egypt': 'egypt',
  'iran': 'iran',
  'new zealand': 'new-zealand',
  'spain': 'spain',
  'cape verde': 'cape-verde',
  'saudi arabia': 'saudi-arabia',
  'uruguay': 'uruguay',
  'france': 'france',
  'senegal': 'senegal',
  'iraq': 'iraq',
  'norway': 'norway',
  'argentina': 'argentina',
  'algeria': 'algeria',
  'austria': 'austria',
  'jordan': 'jordan',
  'portugal': 'portugal',
  'dr congo': 'dr-congo',
  'd r congo': 'dr-congo',
  'democratic republic of the congo': 'dr-congo',
  'uzbekistan': 'uzbekistan',
  'colombia': 'colombia',
  'england': 'england',
  'croatia': 'croatia',
  'ghana': 'ghana',
  'panama': 'panama',
};

const NORMALIZED_TEAMS = new Map(Object.values(TEAMS).map(team => [normalizeName(team.name), team.id]));

async function scrape365Scores(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('Node 18+ fetch API is required');
  }

  const start = options.startDate || TOURNAMENT_START;
  const end = options.endDate || TOURNAMENT_END;
  const allGames = [];
  const errors = [];

  for (const date of datesBetween(start, end)) {
    try {
      const games = await fetchGamesForDate(date, fetchImpl);
      allGames.push(...games);
    } catch (err) {
      errors.push({date: toIsoDate(date), error: err.message});
    }
  }

  if (!allGames.length && errors.length) {
    throw new Error(`365Scores scrape failed for all dates: ${errors[0].error}`);
  }

  const normalized = normalize365ScoresGames(allGames);
  normalized.sourceMeta.errors = errors;
  try {
    normalized.playerGoals = await collectPlayerGoals(allGames, fetchImpl);
  } catch (err) {
    errors.push({stage: 'playerGoals', error: err.message});
  }
  return normalized;
}

async function fetchGamesForDate(date, fetchImpl) {
  const url = new URL(SCORES_URL);
  const params = {
    appTypeId: '5',
    langId: '1',
    timezoneName: 'Europe/Madrid',
    userCountryId: '2',
    sports: '1',
    startDate: formatDateParam(date),
    endDate: formatDateParam(date),
    showOdds: 'false',
    onlyMajorGames: 'false',
  };
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const res = await fetchImpl(url, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'Mozilla/5.0 PorraMundial2026/1.0',
    },
  });

  if (!res.ok) {
    throw new Error(`365Scores HTTP ${res.status} ${res.statusText}`);
  }

  const payload = await res.json();
  return (payload.games || []).filter(game => Number(game.competitionId) === COMPETITION_ID);
}

async function fetchGameEvents(gameId, fetchImpl) {
  const url = new URL(GAME_URL);
  const params = {
    appTypeId: '5',
    langId: '1',
    timezoneName: 'Europe/Madrid',
    userCountryId: '2',
    gameId: String(gameId),
  };
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const res = await fetchImpl(url, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'Mozilla/5.0 PorraMundial2026/1.0',
    },
  });

  if (!res.ok) {
    throw new Error(`365Scores HTTP ${res.status} ${res.statusText}`);
  }

  const payload = await res.json();
  return payload.game?.events || [];
}

async function collectPlayerGoals(games, fetchImpl) {
  const finished = (games || []).filter(game =>
    Number(game.competitionId) === COMPETITION_ID && isFinishedGame(game));

  const eventsList = await mapWithConcurrency(finished, GAME_DETAIL_CONCURRENCY, async game => {
    const gameId = game.id ?? game.gameId;
    if (gameId == null) return [];
    try {
      return await fetchGameEvents(gameId, fetchImpl);
    } catch {
      return [];
    }
  });

  return aggregatePlayerGoals(eventsList);
}

function aggregatePlayerGoals(eventsList) {
  const playerGoals = {};
  for (const events of eventsList || []) {
    for (const event of events || []) {
      if (event?.eventType?.id !== GOAL_EVENT_TYPE_ID) continue;
      if (event.eventType.subTypeId === OWN_GOAL_SUBTYPE_ID) continue;
      if (event.stageId === PENALTY_SHOOTOUT_STAGE_ID) continue;
      if (event.playerId == null) continue;
      const id = `365-${event.playerId}`;
      playerGoals[id] = (playerGoals[id] || 0) + 1;
    }
  }
  return playerGoals;
}

async function mapWithConcurrency(items, concurrency, handler) {
  const results = new Array(items.length);
  let index = 0;
  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({length: workerCount}, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await handler(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

function normalize365ScoresGames(games, now = new Date()) {
  const groupMaps = {};
  GROUP_LETTERS.forEach(group => { groupMaps[group] = new Map(); });

  const bracketSets = {
    r32: new Set(),
    r16: new Set(),
    qf: new Set(),
    sf: new Set(),
    third: new Set(),
    finalists: new Set(),
  };
  const knockoutMatches = {r32: [], r16: [], qf: [], sf: [], third: [], final: []};
  const teamGoals = {};
  let champion = null;
  let finishedGames = 0;
  let groupGames = 0;
  let knockoutGames = 0;
  let skippedUnknownTeams = 0;

  for (const game of games || []) {
    if (Number(game.competitionId) !== COMPETITION_ID || !isFinishedGame(game)) continue;

    const home = teamFromCompetitor(game.homeCompetitor);
    const away = teamFromCompetitor(game.awayCompetitor);
    const homeScore = scoreOf(game.homeCompetitor);
    const awayScore = scoreOf(game.awayCompetitor);
    if (!home || !away) {
      skippedUnknownTeams++;
      continue;
    }

    finishedGames++;
    addTeamGoals(teamGoals, home, homeScore, awayScore);
    addTeamGoals(teamGoals, away, awayScore, homeScore);

    const group = groupLetterFromGame(game);
    const fixture = group ? findGroupFixtureIndex(group, home, away) : null;
    if (fixture) {
      const fixtureHomeScore = fixture.inverted ? awayScore : homeScore;
      const fixtureAwayScore = fixture.inverted ? homeScore : awayScore;
      groupMaps[group].set(fixture.idx, {
        idx: fixture.idx,
        home: fixture.homeId,
        away: fixture.awayId,
        goalsHome: fixtureHomeScore,
        goalsAway: fixtureAwayScore,
        result: result1x2(fixtureHomeScore, fixtureAwayScore),
        sourceGameId: game.id || game.gameId || null,
      });
      groupGames++;
      continue;
    }

    const bucket = knockoutBucket(game);
    if (!bucket) continue;

    const winner = winnerFromGame(game, home, away, homeScore, awayScore);
    if (!winner) continue;

    if (bucket === 'final') {
      bracketSets.finalists.add(home);
      bracketSets.finalists.add(away);
      champion = winner;
    } else {
      bracketSets[bucket].add(winner);
      if (bucket === 'sf') bracketSets.finalists.add(winner);
    }
    knockoutMatches[bucket].push({
      homeId: home,
      awayId: away,
      goalsHome: homeScore,
      goalsAway: awayScore,
      winner,
      sourceGameId: game.id || game.gameId || null,
    });
    knockoutGames++;
  }

  const groupMatches = {};
  for (const group of GROUP_LETTERS) {
    const matches = Array.from(groupMaps[group].values()).sort((a, b) => a.idx - b.idx);
    if (matches.length) groupMatches[group] = matches;
  }

  return {
    groupMatches,
    bracketAdvanced: {
      r32: Array.from(bracketSets.r32),
      r16: Array.from(bracketSets.r16),
      qf: Array.from(bracketSets.qf),
      sf: Array.from(bracketSets.sf),
      third: Array.from(bracketSets.third),
      finalists: Array.from(bracketSets.finalists),
      champion,
    },
    knockoutMatches,
    teamGoals,
    playerGoals: {},
    lastUpdated: now.toISOString(),
    source: '365scores',
    sourceMeta: {
      competitionId: COMPETITION_ID,
      games: Array.isArray(games) ? games.length : 0,
      finishedGames,
      groupGames,
      knockoutGames,
      skippedUnknownTeams,
    },
  };
}

function addTeamGoals(teamGoals, team, goalsFor, goalsAgainst) {
  teamGoals[team] ||= {for: 0, against: 0};
  teamGoals[team].for += goalsFor;
  teamGoals[team].against += goalsAgainst;
}

function teamFromCompetitor(competitor = {}) {
  const slug = normalizeSlug(competitor.nameForURL || competitor.slug || competitor.name);
  if (TEAM_SLUGS[slug]) return TEAM_SLUGS[slug];

  const direct = normalizeName(competitor.name || competitor.shortName || competitor.displayName || '');
  if (NAME_ALIASES[direct]) return NAME_ALIASES[direct];
  if (NORMALIZED_TEAMS.has(direct)) return NORMALIZED_TEAMS.get(direct);
  return null;
}

function findGroupFixtureIndex(group, homeTeam, awayTeam) {
  const fixtures = GROUP_FIXTURES[group] || [];
  for (let idx = 0; idx < fixtures.length; idx++) {
    const fixture = fixtures[idx];
    const fixtureHome = fixture.homeId;
    const fixtureAway = fixture.awayId;
    if (fixtureHome === homeTeam && fixtureAway === awayTeam) return {idx, inverted: false, homeId: fixtureHome, awayId: fixtureAway};
    if (fixtureHome === awayTeam && fixtureAway === homeTeam) return {idx, inverted: true, homeId: fixtureHome, awayId: fixtureAway};
  }
  return null;
}

function groupLetterFromGame(game = {}) {
  const text = [
    game.groupName,
    game.competitionDisplayName,
    game.stageName,
    game.roundName,
  ].filter(Boolean).join(' ');
  const match = text.match(/\bgroup\s+([A-L])\b/i);
  if (match) return match[1].toUpperCase();

  const groupNum = Number(game.groupNum || game.groupId);
  if (groupNum >= 1 && groupNum <= GROUP_LETTERS.length) return GROUP_LETTERS[groupNum - 1];
  return null;
}

function knockoutBucket(game = {}) {
  const text = normalizeName([
    game.stageName,
    game.roundName,
    game.competitionDisplayName,
    game.groupName,
    game.name,
  ].filter(Boolean).join(' '));

  if (/\bgroup\s+[a-l]\b/.test(text)) return null;
  if (/round of 32|last 32|1\/16|sixteenth|treintaidosavos|dieciseisavos/.test(text)) return 'r32';
  if (/round of 16|last 16|octavos|1\/8/.test(text)) return 'r16';
  if (/quarter|cuartos|1\/4/.test(text)) return 'qf';
  if (/semi|semifinal/.test(text)) return 'sf';
  if (/third place|3rd place|tercer puesto/.test(text)) return 'third';
  if (/\bfinal\b/.test(text)) return 'final';
  return null;
}

function winnerFromGame(game, home, away, homeScore, awayScore) {
  if (game.homeCompetitor?.isWinner === true) return home;
  if (game.awayCompetitor?.isWinner === true) return away;
  if (homeScore > awayScore) return home;
  if (awayScore > homeScore) return away;
  return null;
}

function isFinishedGame(game = {}) {
  const homeScore = scoreOf(game.homeCompetitor);
  const awayScore = scoreOf(game.awayCompetitor);
  if (homeScore < 0 || awayScore < 0) return false;

  const statusText = normalizeName([
    game.statusText,
    game.shortStatusText,
    game.gameTimeDisplay,
    game.statusName,
  ].filter(Boolean).join(' '));
  // 365scores marca los suspendidos con el mismo statusGroup que los terminados.
  if (/suspend|postpon|abandon|cancel/.test(statusText)) return false;

  const statusGroup = Number(game.statusGroup);
  if (statusGroup === 4) return true;
  return /\b(ft|aet|ended|final|full time|after penalties)\b/.test(statusText);
}

function scoreOf(competitor = {}) {
  const value = Number(competitor.score);
  return Number.isFinite(value) ? value : -1;
}

function result1x2(homeScore, awayScore) {
  if (homeScore > awayScore) return '1';
  if (awayScore > homeScore) return '2';
  return 'x';
}

function invertResult(result) {
  if (result === '1') return '2';
  if (result === '2') return '1';
  return result;
}

function datesBetween(start, end) {
  const dates = [];
  const cursor = parseIsoDate(start);
  const last = parseIsoDate(end);
  while (cursor <= last) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function parseIsoDate(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) throw new Error(`Invalid ISO date: ${value}`);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function formatDateParam(date) {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeSlug(value) {
  return normalizeName(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  SCRAPE_INTERVAL_MS,
  COMPETITION_ID,
  scrape365Scores,
  normalize365ScoresGames,
  fetchGamesForDate,
  fetchGameEvents,
  collectPlayerGoals,
  aggregatePlayerGoals,
  teamFromCompetitor,
  formatDateParam,
  result1x2,
  invertResult,
};

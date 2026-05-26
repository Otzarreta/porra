/* ═══════════════════════════════════════════════════════
   SCRAPER 365SCORES — resultados Mundial 2026
═══════════════════════════════════════════════════════ */
const {GROUPS, ALL_TEAMS, GROUP_FIXTURES} = require('../public/fixtures.js');

const SCRAPE_INTERVAL_MS = 30 * 60 * 1000;
const COMPETITION_ID = 5930;
const SCORES_URL = 'https://webws.365scores.com/web/games/allscores/';
const TOURNAMENT_START = '2026-06-11';
const TOURNAMENT_END = '2026-07-19';
const GROUP_LETTERS = Object.keys(GROUPS);

const TEAM_SLUGS = {
  'mexico': 'México',
  'south-africa': 'Sudáfrica',
  'south-korea': 'Corea del Sur',
  'czech-republic': 'Rep. Checa',
  'czechia': 'Rep. Checa',
  'canada': 'Canadá',
  'bosnia-and-herzegovina': 'Bosnia y Herzegovina',
  'bosnia-herzegovina': 'Bosnia y Herzegovina',
  'qatar': 'Qatar',
  'switzerland': 'Suiza',
  'brazil': 'Brasil',
  'morocco': 'Marruecos',
  'haiti': 'Haití',
  'scotland': 'Escocia',
  'usa': 'Estados Unidos',
  'united-states': 'Estados Unidos',
  'united-states-of-america': 'Estados Unidos',
  'paraguay': 'Paraguay',
  'australia': 'Australia',
  'turkey': 'Turquía',
  'turkiye': 'Turquía',
  'germany': 'Alemania',
  'curacao': 'Curazao',
  'curaçao': 'Curazao',
  'ivory-coast': 'Costa de Marfil',
  'cote-d-ivoire': 'Costa de Marfil',
  'ecuador': 'Ecuador',
  'netherlands': 'Países Bajos',
  'japan': 'Japón',
  'sweden': 'Suecia',
  'tunisia': 'Túnez',
  'belgium': 'Bélgica',
  'egypt': 'Egipto',
  'iran': 'Irán',
  'new-zealand': 'Nueva Zelanda',
  'spain': 'España',
  'cape-verde': 'Cabo Verde',
  'cape-verde-islands': 'Cabo Verde',
  'saudi-arabia': 'Arabia Saudita',
  'uruguay': 'Uruguay',
  'france': 'Francia',
  'senegal': 'Senegal',
  'iraq': 'Irak',
  'norway': 'Noruega',
  'argentina': 'Argentina',
  'algeria': 'Argelia',
  'austria': 'Austria',
  'jordan': 'Jordania',
  'portugal': 'Portugal',
  'dr-congo': 'RD Congo',
  'd-r-congo': 'RD Congo',
  'congo-dr': 'RD Congo',
  'democratic-republic-of-the-congo': 'RD Congo',
  'uzbekistan': 'Uzbekistán',
  'colombia': 'Colombia',
  'england': 'Inglaterra',
  'croatia': 'Croacia',
  'ghana': 'Ghana',
  'panama': 'Panamá',
};

const NAME_ALIASES = {
  'mexico': 'México',
  'south africa': 'Sudáfrica',
  'korea republic': 'Corea del Sur',
  'south korea': 'Corea del Sur',
  'czech republic': 'Rep. Checa',
  'czechia': 'Rep. Checa',
  'canada': 'Canadá',
  'bosnia and herzegovina': 'Bosnia y Herzegovina',
  'qatar': 'Qatar',
  'switzerland': 'Suiza',
  'brazil': 'Brasil',
  'morocco': 'Marruecos',
  'haiti': 'Haití',
  'scotland': 'Escocia',
  'usa': 'Estados Unidos',
  'united states': 'Estados Unidos',
  'united states of america': 'Estados Unidos',
  'paraguay': 'Paraguay',
  'australia': 'Australia',
  'turkey': 'Turquía',
  'turkiye': 'Turquía',
  'germany': 'Alemania',
  'curacao': 'Curazao',
  'ivory coast': 'Costa de Marfil',
  "cote d'ivoire": 'Costa de Marfil',
  'ecuador': 'Ecuador',
  'netherlands': 'Países Bajos',
  'japan': 'Japón',
  'sweden': 'Suecia',
  'tunisia': 'Túnez',
  'belgium': 'Bélgica',
  'egypt': 'Egipto',
  'iran': 'Irán',
  'new zealand': 'Nueva Zelanda',
  'spain': 'España',
  'cape verde': 'Cabo Verde',
  'saudi arabia': 'Arabia Saudita',
  'uruguay': 'Uruguay',
  'france': 'Francia',
  'senegal': 'Senegal',
  'iraq': 'Irak',
  'norway': 'Noruega',
  'argentina': 'Argentina',
  'algeria': 'Argelia',
  'austria': 'Austria',
  'jordan': 'Jordania',
  'portugal': 'Portugal',
  'dr congo': 'RD Congo',
  'd r congo': 'RD Congo',
  'democratic republic of the congo': 'RD Congo',
  'uzbekistan': 'Uzbekistán',
  'colombia': 'Colombia',
  'england': 'Inglaterra',
  'croatia': 'Croacia',
  'ghana': 'Ghana',
  'panama': 'Panamá',
};

const NORMALIZED_TEAMS = new Map(ALL_TEAMS.map(team => [normalizeName(team), team]));

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

function normalize365ScoresGames(games, now = new Date()) {
  const groupMaps = {};
  GROUP_LETTERS.forEach(group => { groupMaps[group] = new Map(); });

  const bracketSets = {
    r32: new Set(),
    r16: new Set(),
    qf: new Set(),
    sf: new Set(),
    finalists: new Set(),
  };
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
      const rawResult = result1x2(homeScore, awayScore);
      groupMaps[group].set(fixture.idx, {
        idx: fixture.idx,
        home,
        away,
        goalsHome: homeScore,
        goalsAway: awayScore,
        result: fixture.inverted ? invertResult(rawResult) : rawResult,
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
      finalists: Array.from(bracketSets.finalists),
      champion,
    },
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
  const teams = GROUPS[group]?.teams || [];
  for (let idx = 0; idx < fixtures.length; idx++) {
    const fixture = fixtures[idx];
    const fixtureHome = teams[fixture.home];
    const fixtureAway = teams[fixture.away];
    if (fixtureHome === homeTeam && fixtureAway === awayTeam) return {idx, inverted: false};
    if (fixtureHome === awayTeam && fixtureAway === homeTeam) return {idx, inverted: true};
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

  const statusGroup = Number(game.statusGroup);
  if (statusGroup === 4) return true;

  const statusText = normalizeName([
    game.statusText,
    game.shortStatusText,
    game.gameTimeDisplay,
    game.statusName,
  ].filter(Boolean).join(' '));
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
  teamFromCompetitor,
  formatDateParam,
  result1x2,
  invertResult,
};

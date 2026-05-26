/* ==========================================================================
   Scraper de jugadores 365Scores
========================================================================== */
const {parse} = require('node-html-parser');

const {TEAM_IDS, normalizeName} = require('../public/fixtures.js');
const {fetchGamesForDate, teamFromCompetitor} = require('./scraper.js');

const PLAYER_SYNC_USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const PLAYERS_SOURCE = '365scores';
const TOURNAMENT_START = '2026-06-11';
const TOURNAMENT_END = '2026-07-19';
const BASE_TEAM_URL = 'https://www.365scores.com/en-us/football/team/';
const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;
const DEFAULT_TEAM_CONCURRENCY = 4;

async function scrape365ScoresPlayers(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('Node 18+ fetch API is required');
  }

  const requestTimeoutMs = boundedInt(options.requestTimeoutMs, 1000, 60000, DEFAULT_REQUEST_TIMEOUT_MS);
  const teamConcurrency = boundedInt(options.teamConcurrency, 1, 8, DEFAULT_TEAM_CONCURRENCY);
  const timedFetch = fetchWithTimeout(fetchImpl, requestTimeoutMs);
  const requestedTeams = normalizeTeamFilter(options.teams);
  const refs = options.teamRefs || await collect365ScoresTeamRefs({
    fetchImpl: timedFetch,
    startDate: options.startDate || TOURNAMENT_START,
    endDate: options.endDate || TOURNAMENT_END,
  });
  const selectedRefs = refs.filter(ref => !requestedTeams.size || requestedTeams.has(ref.teamId));
  if (!selectedRefs.length) {
    throw new Error(requestedTeams.size ? 'no_matching_365scores_teams' : 'no_365scores_teams_found');
  }

  const players = [];
  const errors = [];
  const fetchedTeamIds = [];

  const results = await mapWithConcurrency(selectedRefs, teamConcurrency, async ref => {
    try {
      const html = await fetchTeamSquadHtml(ref, timedFetch);
      const teamPlayers = normalize365ScoresSquadHtml(html, ref);
      if (!teamPlayers.length) throw new Error('no_players_found');
      return {teamId: ref.teamId, players: teamPlayers};
    } catch (err) {
      return {teamId: ref.teamId, url: ref.url, error: err.message};
    }
  });

  for (const result of results) {
    if (result.error) {
      errors.push({teamId: result.teamId, url: result.url, error: result.error});
      continue;
    }
    players.push(...result.players);
    fetchedTeamIds.push(result.teamId);
  }

  if (!players.length) {
    const reason = errors[0]?.error || 'no_players_found';
    throw new Error(`365Scores player sync failed: ${reason}`);
  }

  return {
    players: sortPlayers(dedupePlayers(players)),
    teamIds: Array.from(new Set(fetchedTeamIds)),
    sourceMeta: {
      source: PLAYERS_SOURCE,
      teamRefs: refs.length,
      requestedTeams: requestedTeams.size ? Array.from(requestedTeams) : [],
      fetchedTeams: fetchedTeamIds.length,
      requestTimeoutMs,
      errors,
    },
  };
}

async function collect365ScoresTeamRefs({fetchImpl = globalThis.fetch, startDate = TOURNAMENT_START, endDate = TOURNAMENT_END} = {}) {
  const refs = new Map();
  const errors = [];

  for (const date of datesBetween(startDate, endDate)) {
    try {
      const games = await fetchGamesForDate(date, fetchImpl);
      for (const game of games) {
        addTeamRef(refs, game.homeCompetitor);
        addTeamRef(refs, game.awayCompetitor);
      }
    } catch (err) {
      errors.push({date: toIsoDate(date), error: err.message});
    }
    if (refs.size === TEAM_IDS.length) break;
  }

  const out = Array.from(refs.values()).sort((a, b) => TEAM_IDS.indexOf(a.teamId) - TEAM_IDS.indexOf(b.teamId));
  Object.defineProperty(out, 'errors', {value: errors, enumerable: false});
  return out;
}

function addTeamRef(refs, competitor = {}) {
  const teamId = teamFromCompetitor(competitor);
  if (!teamId || refs.has(teamId)) return;

  const sourceTeamId = competitor.id == null ? '' : String(competitor.id);
  const sourceSlug = normalizeSlug(competitor.nameForURL || competitor.slug || competitor.name);
  if (!sourceTeamId || !sourceSlug) return;

  refs.set(teamId, {
    teamId,
    sourceTeamId,
    sourceSlug,
    sourceName: String(competitor.name || '').trim(),
    url: `${BASE_TEAM_URL}${sourceSlug}-${sourceTeamId}/squad`,
  });
}

async function fetchTeamSquadHtml(ref, fetchImpl) {
  const res = await fetchImpl(ref.url, {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': PLAYER_SYNC_USER_AGENT,
    },
  });

  if (!res.ok) {
    throw new Error(`365Scores HTTP ${res.status} ${res.statusText}`);
  }

  return res.text();
}

function normalize365ScoresSquadHtml(html, ref = {}) {
  const root = parse(String(html || ''));
  const now = new Date().toISOString();
  const players = [];

  root.querySelectorAll('a[href*="/football/player/"]').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (!href.includes('#national')) return;

    const sourceId = playerIdFromHref(href);
    if (!sourceId) return;

    const lines = link.structuredText.split('\n').map(line => line.trim()).filter(Boolean);
    const name = cleanText(lines[0]);
    const detail = cleanText(lines.slice(1).join(' '));
    if (!name || !detail) return;

    const parsed = parsePlayerDetail(detail);
    if (parsed.position && /coach/i.test(parsed.position)) return;

    players.push({
      id: `365-${sourceId}`,
      name,
      teamId: ref.teamId,
      active: true,
      position: parsed.position,
      club: parsed.club,
      source: PLAYERS_SOURCE,
      sourceId,
      sourceTeamId: ref.sourceTeamId ? String(ref.sourceTeamId) : '',
      sourceUrl: ref.url || '',
      updatedAt: now,
    });
  });

  return sortPlayers(dedupePlayers(players));
}

function parsePlayerDetail(detail) {
  const match = String(detail || '').match(/^(.*)\(([^)]+)\)\s*$/);
  if (!match) return {club: detail || '', position: ''};
  return {
    club: cleanText(match[1]),
    position: cleanText(match[2]),
  };
}

function playerIdFromHref(href) {
  const match = String(href || '').match(/\/football\/player\/(?:[^/#]*-)?(\d+)(?:#|$)/);
  return match ? match[1] : '';
}

function mergePlayers(existingPlayers, incomingPlayers, options = {}) {
  const existing = Array.isArray(existingPlayers) ? existingPlayers : [];
  const incoming = Array.isArray(incomingPlayers) ? incomingPlayers : [];
  const deactivateMissing = options.deactivateMissing !== false;
  const syncedTeamIds = new Set((options.syncedTeamIds || incoming.map(player => player.teamId)).filter(Boolean));
  const incomingIds = new Set(incoming.map(player => player.id).filter(Boolean));
  const byId = new Map();
  let added = 0;
  let updated = 0;
  let deactivated = 0;

  existing.forEach(player => {
    if (player?.id) byId.set(player.id, {...player});
  });

  incoming.forEach(player => {
    if (!player?.id) return;
    const previous = byId.get(player.id);
    byId.set(player.id, {
      ...(previous || {}),
      ...player,
      active: player.active !== false,
    });
    if (previous) updated += 1;
    else added += 1;
  });

  if (deactivateMissing) {
    byId.forEach((player, id) => {
      if (player.source !== PLAYERS_SOURCE) return;
      if (!syncedTeamIds.has(player.teamId)) return;
      if (incomingIds.has(id)) return;
      if (player.active !== false) {
        byId.set(id, {...player, active: false});
        deactivated += 1;
      }
    });
  }

  return {
    players: sortPlayers(Array.from(byId.values())),
    added,
    updated,
    deactivated,
  };
}

function dedupePlayers(players) {
  const seen = new Set();
  return players.filter(player => {
    if (!player.id || seen.has(player.id)) return false;
    seen.add(player.id);
    return true;
  });
}

function sortPlayers(players) {
  return [...players].sort((a, b) => {
    const teamDelta = TEAM_IDS.indexOf(a.teamId) - TEAM_IDS.indexOf(b.teamId);
    return teamDelta || String(a.name).localeCompare(String(b.name));
  });
}

function normalizeTeamFilter(teams) {
  const out = new Set();
  (Array.isArray(teams) ? teams : []).forEach(teamId => {
    if (TEAM_IDS.includes(teamId)) out.add(teamId);
  });
  return out;
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

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeSlug(value) {
  return normalizeName(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function fetchWithTimeout(fetchImpl, timeoutMs) {
  return async (url, init = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, {
        ...init,
        signal: init.signal || controller.signal,
      });
    } catch (err) {
      if (err?.name === 'AbortError') throw new Error(`request_timeout_${timeoutMs}ms`);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };
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

function boundedInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

module.exports = {
  PLAYER_SYNC_USER_AGENT,
  scrape365ScoresPlayers,
  collect365ScoresTeamRefs,
  normalize365ScoresSquadHtml,
  mergePlayers,
  playerIdFromHref,
  parsePlayerDetail,
  fetchWithTimeout,
};

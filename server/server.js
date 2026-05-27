/* ==========================================================================
   Porra Mundial 2026 - backend Express
========================================================================== */
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const {computeScore} = require('./scoring.js');
const {scrape365Scores, SCRAPE_INTERVAL_MS} = require('./scraper.js');
const {scrape365ScoresPlayers, mergePlayers} = require('./playerScraper.js');
const {
  GROUP_ORDER,
  GROUP_FIXTURES,
  TEAM_IDS,
  BRACKET_MATCHES,
  normalizeGroupPredictions,
  normalizeName,
  normalizeScore,
  isScoreComplete,
  resolveBracketMatches,
  getTeamName,
} = require('../public/fixtures.js');

const ACCESS_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 60; // 60 dias
const MAX_GOALS_PER_MATCH = 50;
const MAX_PLAYER_GOALS = 100;
const PLAYER_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const PLAYER_SYNC_END = '2026-07-20T00:00:00Z';
const PLAYER_SYNC_BOOT_DELAY_MS = 15_000;

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const PORRAS_FILE = path.join(DATA_DIR, 'porras.json');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');
const META_FILE = path.join(DATA_DIR, 'meta.json');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const PLAYERS_SEED_FILE = path.join(__dirname, 'players-seed.json');
const FIXTURES_SEED_FILE = path.join(__dirname, 'fixtures-seed.json');

const DEFAULT_DEADLINE = '2026-06-11T19:00:00Z';
const ROUND_LOCK_DATES = {
  r32: '2026-06-28T00:00:00Z',
  r16: '2026-07-04T00:00:00Z',
  qf: '2026-07-09T00:00:00Z',
  sf: '2026-07-14T00:00:00Z',
  third: '2026-07-18T00:00:00Z',
  final: '2026-07-19T00:00:00Z',
};
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || ADMIN_TOKEN || 'porra-local-dev-secret';

let porras = {};
let players = [];
let kickoffs = {};
let results = null;
let metaState = {
  deadline: DEFAULT_DEADLINE,
  lastScrape: null,
  lastPlayerSync: null,
};

async function readJson(file, fallback, createIfMissing = false) {
  let txt;
  try {
    txt = await fs.readFile(file, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    if (createIfMissing) await writeJsonAtomic(file, fallback);
    return fallback;
  }

  if (!txt.trim()) {
    console.warn(`[readJson] ${file} esta vacio, restaurando fallback.`);
    if (createIfMissing) await writeJsonAtomic(file, fallback);
    return fallback;
  }

  try {
    return JSON.parse(txt);
  } catch (err) {
    const backup = `${file}.corrupt-${Date.now()}`;
    console.error(`[readJson] ${file} con JSON invalido (${err.message}). Renombrado a ${backup}, arrancando con fallback.`);
    try { await fs.rename(file, backup); } catch (renameErr) {
      console.error(`[readJson] no pude renombrar ${file}: ${renameErr.message}`);
    }
    if (createIfMissing) await writeJsonAtomic(file, fallback);
    return fallback;
  }
}

async function writeJsonAtomic(file, data) {
  const tmp = `${file}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

const writeQueues = new Map();

function writeJsonSerialized(file, data) {
  const prev = writeQueues.get(file) || Promise.resolve();
  const next = prev.catch(() => {}).then(() => writeJsonAtomic(file, data));
  writeQueues.set(file, next);
  next.finally(() => {
    if (writeQueues.get(file) === next) writeQueues.delete(file);
  });
  return next;
}

async function loadState() {
  await fs.mkdir(DATA_DIR, {recursive: true});
  porras = await readJson(PORRAS_FILE, {}, true);
  players = sanitizePlayers(await readJson(PLAYERS_FILE, [], true));
  if (!players.length) {
    const seed = sanitizePlayers(await readJson(PLAYERS_SEED_FILE, [], false));
    if (seed.length) {
      players = seed;
      await writeJsonSerialized(PLAYERS_FILE, players);
      console.log(`[boot] sembrados ${players.length} jugadores desde players-seed.json`);
    }
  }
  results = await readJson(RESULTS_FILE, null, true);
  metaState = {...metaState, ...(await readJson(META_FILE, metaState, true))};
  const fixturesSeed = await readJson(FIXTURES_SEED_FILE, null, false);
  kickoffs = sanitizeKickoffs(fixturesSeed?.matches);
}

const isLocked = () => Date.now() > Date.parse(metaState.deadline);

function bracketMatchLockTime(matchId) {
  const kickoff = kickoffs?.[matchId]?.kickoff;
  const kickoffMs = kickoff ? Date.parse(kickoff) : NaN;
  if (Number.isFinite(kickoffMs)) return kickoffMs;
  const match = BRACKET_MATCHES.find(m => m.id === matchId);
  const fallback = match ? ROUND_LOCK_DATES[match.round] : null;
  return fallback ? Date.parse(fallback) : NaN;
}

function isBracketMatchLocked(matchId, now = Date.now()) {
  const lockMs = bracketMatchLockTime(matchId);
  return Number.isFinite(lockMs) && now > lockMs;
}

function mergeBracketField(existing, incoming, now = Date.now()) {
  const out = {};
  const ids = new Set([...Object.keys(existing || {}), ...Object.keys(incoming || {})]);
  ids.forEach(matchId => {
    const locked = isBracketMatchLocked(matchId, now);
    if (locked) {
      if (existing && existing[matchId] !== undefined) out[matchId] = existing[matchId];
    } else if (incoming && incoming[matchId] !== undefined) {
      out[matchId] = incoming[matchId];
    } else if (existing && existing[matchId] !== undefined) {
      out[matchId] = existing[matchId];
    }
  });
  return out;
}

const app = express();
app.use(express.json({limit: '2mb'}));
app.use((req, res, next) => {
  if (req.path.endsWith('.avif')) res.type('image/avif');
  next();
});
app.use(express.static(path.join(ROOT, 'public'), {
  etag: true,
  lastModified: true,
  setHeaders(res, filePath) {
    if (/\.(html|js|css|json)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    }
  },
}));

app.get('/api/health', (_req, res) => res.json({ok: true, uptime: process.uptime()}));

app.get('/api/meta', (_req, res) => res.json(publicMeta()));

app.get('/api/players', (_req, res) => res.json(players));

app.get('/api/kickoffs', (_req, res) => res.json(kickoffs));

app.get('/api/results', (_req, res) => res.json(results || null));

app.get('/api/porras', (_req, res) => {
  const list = Object.values(porras).map(p => ({
    id: p.id,
    player: p.player,
    updatedAt: p.updatedAt,
  }));
  res.json(list);
});

app.get('/api/porras/:id', (req, res) => {
  const porra = porras[req.params.id];
  if (!porra) return res.status(404).json({error: 'not_found'});

  const payload = getAccessPayload(req);
  const admin = isAdminRequest(req);
  if (!admin && payload?.porraId !== porra.id) {
    return res.status(401).json({error: 'unauthorized'});
  }

  res.json(porra);
});

app.post('/api/access', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const requestedPlayer = sanitizeStr(req.body?.player, 80).trim();
  if (!email) return res.status(400).json({error: 'email_required'});

  const matches = findPorrasByEmail(email);
  let porra = matches[0] || null;
  let shouldPersist = false;
  if (matches.length > 1) {
    matches.slice(1).forEach(duplicate => {
      delete porras[duplicate.id];
      shouldPersist = true;
    });
  }
  if (porra && porra.email !== email) {
    porra.email = email;
    shouldPersist = true;
  }
  if (!porra) {
    if (isLocked()) {
      return res.status(423).json({error: 'locked', message: 'El plazo de envio ha finalizado.'});
    }
    const player = requestedPlayer || email.split('@')[0];
    porra = createEmptyPorra({email, player});
    porras[porra.id] = porra;
    await writeJsonSerialized(PORRAS_FILE, porras);
  } else if (!isLocked() && requestedPlayer && requestedPlayer !== porra.player) {
    porra.player = requestedPlayer;
    porra.updatedAt = new Date().toISOString();
    await writeJsonSerialized(PORRAS_FILE, porras);
  } else if (shouldPersist) {
    await writeJsonSerialized(PORRAS_FILE, porras);
  }

  res.json({
    porra,
    accessToken: signAccessToken({porraId: porra.id, email}),
    meta: publicMeta(),
  });
});

app.post('/api/porras', async (req, res) => {
  const payload = getAccessPayload(req);
  if (!payload) return res.status(401).json({error: 'access_token_required'});

  const existing = porras[payload.porraId];
  if (!existing || normalizeEmail(existing.email) !== payload.email) {
    return res.status(401).json({error: 'invalid_access'});
  }

  const now = Date.now();
  const groupsLocked = isLocked();
  const data = req.body || {};
  const incomingWinners = sanitizeBracketWinners(data.bracketWinners);
  const incomingScores = sanitizeBracketScores(data.bracketScores);

  const stored = {
    ...existing,
    player: groupsLocked
      ? existing.player
      : (sanitizeStr(data.player || existing.player, 80).trim() || existing.player),
    groupPredictions: groupsLocked
      ? normalizeGroupPredictions(existing.groupPredictions)
      : normalizeGroupPredictions(data.groupPredictions),
    bracketWinners: mergeBracketField(existing.bracketWinners, incomingWinners, now),
    bracketScores: mergeBracketField(existing.bracketScores, incomingScores, now),
    topScorerTeam: groupsLocked ? (existing.topScorerTeam || '') : sanitizeTeamId(data.topScorerTeam),
    topScorerPlayerId: groupsLocked ? (existing.topScorerPlayerId || '') : sanitizePlayerId(data.topScorerPlayerId),
    championTeam: groupsLocked ? (existing.championTeam || '') : sanitizeTeamId(data.championTeam),
    updatedAt: new Date().toISOString(),
  };
  delete stored.bestDefenseTeam;

  porras[stored.id] = stored;
  await writeJsonSerialized(PORRAS_FILE, porras);

  res.json({id: stored.id, updatedAt: stored.updatedAt});
});

app.get('/api/matches/:matchId/predictions', (req, res) => {
  const data = collectMatchPredictions(req.params.matchId);
  if (!data) return res.status(404).json({error: 'match_not_found'});
  res.json(data);
});

app.get('/api/ranking', (_req, res) => {
  const list = Object.values(porras).map(p => {
    const breakdown = computeScore(p, results);
    return {
      id: p.id,
      player: p.player || '-',
      total: breakdown.total,
      breakdown,
      updatedAt: p.updatedAt,
    };
  }).sort((a, b) => b.total - a.total || String(a.player).localeCompare(String(b.player)));
  res.json(list);
});

app.post('/api/admin/players', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const incoming = Array.isArray(req.body) ? req.body : req.body?.players;
  if (!Array.isArray(incoming)) return res.status(400).json({error: 'players_array_required'});
  players = sanitizePlayers(incoming);
  await writeJsonSerialized(PLAYERS_FILE, players);
  res.json({ok: true, count: players.length});
});

app.post('/api/admin/players/sync', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await runPlayerSync({
      teams: Array.isArray(req.body?.teams) ? req.body.teams : null,
      deactivateMissing: req.body?.deactivateMissing !== false,
      syncOptions: {
        startDate: sanitizeDate(req.body?.startDate),
        endDate: sanitizeDate(req.body?.endDate),
        requestTimeoutMs: req.body?.requestTimeoutMs,
        teamConcurrency: req.body?.teamConcurrency,
      },
      throwOnError: true,
    });
    res.json({
      ok: true,
      count: players.length,
      imported: result.sync.players.length,
      teams: result.sync.teamIds.length,
      added: result.merged.added,
      updated: result.merged.updated,
      deactivated: result.merged.deactivated,
      errors: result.sync.sourceMeta.errors,
    });
  } catch (err) {
    res.status(500).json({error: 'players_sync_failed', message: err.message});
  }
});

app.post('/api/admin/results', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  let sanitized;
  try {
    sanitized = sanitizeResults(req.body);
  } catch (err) {
    return res.status(400).json({error: 'results_invalid', message: err.message});
  }
  results = sanitized;
  await writeJsonSerialized(RESULTS_FILE, results);
  metaState.lastScrape = {ok: true, at: new Date().toISOString(), source: 'manual'};
  await writeJsonSerialized(META_FILE, metaState);
  res.json({ok: true});
});

app.post('/api/admin/scrape', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    await runScrape({throwOnError: true});
    res.json({ok: true, lastScrape: metaState.lastScrape});
  } catch (err) {
    res.status(500).json({error: 'scrape_failed', message: err.message});
  }
});

function publicMeta() {
  return {
    deadline: metaState.deadline,
    locked: isLocked(),
    roundLocks: {...ROUND_LOCK_DATES},
    lastScrape: metaState.lastScrape,
    lastPlayerSync: metaState.lastPlayerSync,
    count: Object.keys(porras).length,
  };
}

function createEmptyPorra({email, player}) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    email,
    player: sanitizeStr(player, 80).trim(),
    groupPredictions: normalizeGroupPredictions(null),
    bracketWinners: {},
    bracketScores: {},
    topScorerTeam: '',
    topScorerPlayerId: '',
    championTeam: '',
    createdAt: now,
    updatedAt: now,
  };
}

function findPorrasByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];
  return Object.values(porras)
    .filter(porra => normalizeEmail(porra.email) === normalized)
    .sort((a, b) => {
      const right = Date.parse(b.updatedAt || b.createdAt || 0) || 0;
      const left = Date.parse(a.updatedAt || a.createdAt || 0) || 0;
      return right - left;
    });
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email.slice(0, 160);
}

function sanitizeStr(value, max = 60) {
  if (typeof value !== 'string') return '';
  return value.slice(0, max);
}

function sanitizeTeamId(value) {
  return TEAM_IDS.includes(value) ? value : '';
}

function sanitizePlayerId(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 120);
}

function sanitizeDate(value) {
  if (typeof value !== 'string') return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function sanitizeBracketWinners(input) {
  const out = {};
  const validMatchIds = new Set(BRACKET_MATCHES.map(match => match.id));
  if (!input || typeof input !== 'object') return out;
  Object.entries(input).forEach(([matchId, teamId]) => {
    if (validMatchIds.has(matchId) && TEAM_IDS.includes(teamId)) out[matchId] = teamId;
  });
  return out;
}

function sanitizeBracketScores(input) {
  const out = {};
  const validMatchIds = new Set(BRACKET_MATCHES.map(match => match.id));
  if (!input || typeof input !== 'object') return out;
  Object.entries(input).forEach(([matchId, value]) => {
    if (!validMatchIds.has(matchId) || !value || typeof value !== 'object') return;
    const homeGoals = sanitizeGoalCount(value.homeGoals);
    const awayGoals = sanitizeGoalCount(value.awayGoals);
    if (homeGoals == null && awayGoals == null) return;
    out[matchId] = {homeGoals, awayGoals};
  });
  return out;
}

function sanitizeKickoffs(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  Object.entries(input).forEach(([rawId, value]) => {
    if (!value || typeof value !== 'object') return;
    const matchId = String(rawId).trim().toUpperCase();
    if (!matchId) return;
    const kickoff = typeof value.kickoff === 'string' ? value.kickoff.slice(0, 40) : null;
    if (!kickoff) return;
    out[matchId] = {
      kickoff,
      round: typeof value.round === 'string' ? value.round.slice(0, 20) : null,
      group: typeof value.group === 'string' ? value.group.slice(0, 2) : null,
      venueName: typeof value.venueName === 'string' ? value.venueName.slice(0, 80) : null,
      venueCity: typeof value.venueCity === 'string' ? value.venueCity.slice(0, 80) : null,
    };
  });
  return out;
}

function sanitizeResults(input) {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('results_not_object');
  }
  const out = {
    groupMatches: sanitizeGroupMatches(input.groupMatches),
    bracketAdvanced: sanitizeBracketAdvanced(input.bracketAdvanced),
    knockoutMatches: sanitizeKnockoutMatches(input.knockoutMatches),
    teamGoals: sanitizeTeamGoals(input.teamGoals),
    playerGoals: sanitizePlayerGoals(input.playerGoals),
    topScorerPlayerId: sanitizePlayerId(input.topScorerPlayerId),
    lastUpdated: typeof input.lastUpdated === 'string' ? input.lastUpdated.slice(0, 40) : new Date().toISOString(),
    source: typeof input.source === 'string' ? input.source.slice(0, 40) : 'manual',
  };
  if (input.sourceMeta && typeof input.sourceMeta === 'object' && !Array.isArray(input.sourceMeta)) {
    out.sourceMeta = sanitizeSourceMeta(input.sourceMeta);
  }
  return out;
}

function sanitizeGroupMatches(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  GROUP_ORDER.forEach(group => {
    const arr = Array.isArray(input[group]) ? input[group] : null;
    if (!arr) return;
    const matches = [];
    arr.forEach(item => {
      if (!item || typeof item !== 'object') return;
      const idx = Number(item.idx);
      const fixture = Number.isInteger(idx) ? GROUP_FIXTURES[group]?.[idx] : null;
      if (!fixture) return;
      const goalsHome = sanitizeGoalCount(item.goalsHome);
      const goalsAway = sanitizeGoalCount(item.goalsAway);
      const declared = ['1', 'x', '2'].includes(item.result) ? item.result : null;
      const derived = derivedResult(goalsHome, goalsAway);
      const result = declared || derived;
      if (!result) return;
      const match = {
        idx,
        home: fixture.homeId,
        away: fixture.awayId,
        goalsHome: goalsHome == null ? null : goalsHome,
        goalsAway: goalsAway == null ? null : goalsAway,
        result,
      };
      if (typeof item.sourceGameId === 'string' || typeof item.sourceGameId === 'number') {
        match.sourceGameId = String(item.sourceGameId).slice(0, 80);
      }
      matches.push(match);
    });
    if (matches.length) out[group] = matches.sort((a, b) => a.idx - b.idx);
  });
  return out;
}

function sanitizeBracketAdvanced(input) {
  const base = {r32: [], r16: [], qf: [], sf: [], third: [], finalists: [], champion: null};
  if (!input || typeof input !== 'object') return base;
  ['r32', 'r16', 'qf', 'sf', 'third', 'finalists'].forEach(key => {
    const arr = Array.isArray(input[key]) ? input[key] : [];
    base[key] = Array.from(new Set(arr.filter(id => TEAM_IDS.includes(id))));
  });
  base.champion = TEAM_IDS.includes(input.champion) ? input.champion : null;
  return base;
}

function sanitizeKnockoutMatches(input) {
  const out = {r32: [], r16: [], qf: [], sf: [], third: [], final: []};
  if (!input || typeof input !== 'object') return out;
  Object.keys(out).forEach(round => {
    const arr = Array.isArray(input[round]) ? input[round] : [];
    arr.forEach(item => {
      if (!item || typeof item !== 'object') return;
      const homeId = TEAM_IDS.includes(item.homeId) ? item.homeId : null;
      const awayId = TEAM_IDS.includes(item.awayId) ? item.awayId : null;
      if (!homeId || !awayId || homeId === awayId) return;
      const goalsHome = sanitizeGoalCount(item.goalsHome);
      const goalsAway = sanitizeGoalCount(item.goalsAway);
      if (goalsHome == null || goalsAway == null) return;
      const winner = TEAM_IDS.includes(item.winner) ? item.winner : (goalsHome > goalsAway ? homeId : goalsAway > goalsHome ? awayId : null);
      out[round].push({homeId, awayId, goalsHome, goalsAway, winner});
    });
  });
  return out;
}

function sanitizeTeamGoals(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  Object.entries(input).forEach(([teamId, value]) => {
    if (!TEAM_IDS.includes(teamId) || !value || typeof value !== 'object') return;
    const forGoals = sanitizeGoalCount(value.for);
    const againstGoals = sanitizeGoalCount(value.against);
    if (forGoals == null && againstGoals == null) return;
    out[teamId] = {for: forGoals ?? 0, against: againstGoals ?? 0};
  });
  return out;
}

function sanitizePlayerGoals(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  Object.entries(input).forEach(([rawId, value]) => {
    const id = sanitizePlayerId(rawId);
    if (!id) return;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > MAX_PLAYER_GOALS) return;
    out[id] = Math.floor(n);
  });
  return out;
}

function sanitizeSourceMeta(input) {
  const out = {};
  Object.entries(input).forEach(([key, value]) => {
    if (typeof key !== 'string' || key.length > 40) return;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      out[key] = typeof value === 'string' ? value.slice(0, 200) : value;
    } else if (Array.isArray(value)) {
      out[key] = value.slice(0, 50).map(item => {
        if (item === null || ['string', 'number', 'boolean'].includes(typeof item)) return item;
        if (item && typeof item === 'object') return sanitizeSourceMeta(item);
        return null;
      });
    } else if (value && typeof value === 'object') {
      out[key] = sanitizeSourceMeta(value);
    }
  });
  return out;
}

function sanitizeGoalCount(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > MAX_GOALS_PER_MATCH) return null;
  return Math.floor(n);
}

function derivedResult(home, away) {
  if (home == null || away == null) return null;
  if (home > away) return '1';
  if (away > home) return '2';
  return 'x';
}

function sanitizePlayers(input) {
  const seen = new Set();
  const out = [];
  (Array.isArray(input) ? input : []).forEach(item => {
    if (!item || typeof item !== 'object') return;
    const name = sanitizeStr(item.name, 100).trim();
    const teamId = sanitizeTeamId(item.teamId);
    if (!name || !teamId) return;
    let id = sanitizePlayerId(item.id) || `${teamId}-${slugify(name)}`;
    if (seen.has(id)) {
      let suffix = 2;
      while (seen.has(`${id}-${suffix}`)) suffix += 1;
      id = `${id}-${suffix}`;
    }
    seen.add(id);
    const player = {
      id,
      name,
      teamId,
      active: item.active !== false,
    };
    copyOptionalPlayerField(player, item, 'position', 60);
    copyOptionalPlayerField(player, item, 'club', 100);
    copyOptionalPlayerField(player, item, 'source', 40);
    copyOptionalPlayerField(player, item, 'sourceId', 80);
    copyOptionalPlayerField(player, item, 'sourceTeamId', 80);
    copyOptionalPlayerField(player, item, 'sourceUrl', 240);
    copyOptionalPlayerField(player, item, 'updatedAt', 40);
    out.push(player);
  });
  return out.sort((a, b) => a.teamId.localeCompare(b.teamId) || a.name.localeCompare(b.name));
}

function copyOptionalPlayerField(target, source, key, max) {
  const value = source?.[key];
  if (value === null || value === undefined || value === '') return;
  target[key] = sanitizeStr(String(value), max).trim();
}

function collectMatchPredictions(matchId) {
  const normalizedId = String(matchId || '').trim().toUpperCase();
  const groupMatch = normalizedId.match(/^([A-L])([1-6])$/);
  if (groupMatch) {
    const group = groupMatch[1];
    const idx = Number(groupMatch[2]) - 1;
    const fixture = GROUP_FIXTURES[group]?.[idx];
    if (!fixture) return null;
    return {
      matchId: normalizedId,
      type: 'group',
      group,
      idx,
      homeId: fixture.homeId,
      awayId: fixture.awayId,
      predictions: publicPorras().map(porra => {
        const score = normalizeScore(porra.groupPredictions?.[group]?.[idx]);
        return {
          player: porra.player || '-',
          updatedAt: porra.updatedAt,
          complete: isScoreComplete(score),
          homeGoals: score.homeGoals,
          awayGoals: score.awayGoals,
        };
      }),
    };
  }

  const bracketMatch = BRACKET_MATCHES.find(match => match.id === normalizedId);
  if (!bracketMatch) return null;
  return {
    matchId: normalizedId,
    type: 'bracket',
    round: bracketMatch.round,
    sourceLabels: bracketMatch.sources.map(source => source.label || ''),
    predictions: publicPorras().map(porra => {
      const resolved = resolveBracketMatches(porra.groupPredictions, porra.bracketWinners);
      const slots = resolved.matches[normalizedId]?.slots || [];
      const winnerId = porra.bracketWinners?.[normalizedId] || '';
      return {
        player: porra.player || '-',
        updatedAt: porra.updatedAt,
        slots,
        slotNames: slots.map(teamId => teamId ? getTeamName(teamId) : ''),
        winnerId,
        winnerName: winnerId ? getTeamName(winnerId) : '',
        complete: Boolean(winnerId),
      };
    }),
  };
}

function publicPorras() {
  return Object.values(porras).sort((a, b) => String(a.player || '').localeCompare(String(b.player || '')));
}

function slugify(value) {
  return normalizeName(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || crypto.randomUUID();
}

function signAccessToken({porraId, email, ttlMs = ACCESS_TOKEN_TTL_MS, now = Date.now()} = {}) {
  const payload = {
    porraId,
    email,
    iat: now,
    exp: now + ttlMs,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', ACCESS_TOKEN_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyAccessToken(token, now = Date.now()) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [body, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', ACCESS_TOKEN_SECRET).update(body).digest('base64url');
  if (!safeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.porraId || !payload?.email) return null;
    if (typeof payload.exp === 'number' && payload.exp < now) return null;
    payload.email = normalizeEmail(payload.email);
    if (!payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function accessTokenFromRequest(req) {
  const auth = req.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return req.get('x-access-token') || req.body?.accessToken || '';
}

function getAccessPayload(req) {
  return verifyAccessToken(accessTokenFromRequest(req));
}

function isAdminRequest(req) {
  return Boolean(ADMIN_TOKEN && req.get('x-admin-token') === ADMIN_TOKEN);
}

function requireAdmin(req, res) {
  if (!isAdminRequest(req)) {
    res.status(401).json({error: 'unauthorized'});
    return false;
  }
  return true;
}

async function runScrape({throwOnError = false} = {}) {
  try {
    const fresh = await scrape365Scores();
    results = sanitizeResults(fresh);
    await writeJsonSerialized(RESULTS_FILE, results);
    metaState.lastScrape = {ok: true, at: new Date().toISOString()};
    await writeJsonSerialized(META_FILE, metaState);
    console.log('[scrape] ok', new Date().toISOString());
  } catch (err) {
    console.error('[scrape] failed:', err.message);
    metaState.lastScrape = {ok: false, at: new Date().toISOString(), error: err.message};
    await writeJsonSerialized(META_FILE, metaState);
    if (throwOnError) throw err;
  }
}

function scheduleScrape() {
  const now = Date.now();
  const start = Date.parse('2026-06-11T00:00:00Z');
  const end = Date.parse('2026-07-20T00:00:00Z');
  if (now < start || now > end) {
    console.log('[scrape] fuera de ventana del torneo, skipping cron');
    return;
  }
  runScrape();
  setInterval(runScrape, SCRAPE_INTERVAL_MS);
}

async function runPlayerSync({teams = null, deactivateMissing = true, syncOptions = {}, throwOnError = false} = {}) {
  try {
    const sync = await scrape365ScoresPlayers({...syncOptions, teams});
    const merged = mergePlayers(players, sync.players, {
      deactivateMissing,
      syncedTeamIds: sync.teamIds,
    });
    players = sanitizePlayers(merged.players);
    await writeJsonSerialized(PLAYERS_FILE, players);

    metaState.lastPlayerSync = {
      ok: true,
      at: new Date().toISOString(),
      source: '365scores',
      imported: sync.players.length,
      count: players.length,
      teams: sync.teamIds.length,
      errors: sync.sourceMeta.errors,
    };
    await writeJsonSerialized(META_FILE, metaState);
    console.log(`[playerSync] ok: ${players.length} jugadores (${sync.teamIds.length} selecciones)`);
    return {sync, merged};
  } catch (err) {
    console.error('[playerSync] failed:', err.message);
    metaState.lastPlayerSync = {
      ok: false,
      at: new Date().toISOString(),
      source: '365scores',
      error: err.message,
    };
    await writeJsonSerialized(META_FILE, metaState);
    if (throwOnError) throw err;
    return null;
  }
}

function schedulePlayerSync() {
  const now = Date.now();
  const end = Date.parse(PLAYER_SYNC_END);
  if (now > end) {
    console.log('[playerSync] fuera de ventana (post torneo), skipping cron');
    return;
  }
  setTimeout(() => {
    runPlayerSync();
    setInterval(runPlayerSync, PLAYER_SYNC_INTERVAL_MS);
  }, PLAYER_SYNC_BOOT_DELAY_MS);
}

async function start() {
  await loadState();
  app.listen(PORT, () => {
    console.log(`Porra Mundial 2026 escuchando en http://localhost:${PORT}`);
    console.log(`Deadline: ${metaState.deadline} (locked=${isLocked()})`);
    console.log(`Porras cargadas: ${Object.keys(porras).length}`);
  });
  scheduleScrape();
  schedulePlayerSync();
}

if (require.main === module) {
  start().catch(err => {
    console.error('Fatal boot error:', err);
    process.exit(1);
  });
}

module.exports = {
  app,
  start,
  loadState,
  computeScore,
  signAccessToken,
  verifyAccessToken,
  sanitizePlayers,
  sanitizeResults,
  normalizeEmail,
  collectMatchPredictions,
  scrape365ScoresPlayers,
  ACCESS_TOKEN_TTL_MS,
};

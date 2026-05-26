/* ═══════════════════════════════════════════════════════
   PORRA MUNDIAL 2026 — BACKEND EXPRESS
═══════════════════════════════════════════════════════ */
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const {computeScore} = require('./scoring.js');
const {scrape365Scores, SCRAPE_INTERVAL_MS} = require('./scraper.js');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const PORRAS_FILE  = path.join(DATA_DIR, 'porras.json');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');
const META_FILE    = path.join(DATA_DIR, 'meta.json');

// Default deadline: 1h antes del primer partido (11 jun 2026, ~17:00 ET)
const DEFAULT_DEADLINE = '2026-06-11T19:00:00Z';
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;

/* ═════════════════════════════════════════
   ESTADO EN MEMORIA (persistido en disco)
═════════════════════════════════════════ */
let porras = {};           // {id: {...porraData, updatedAt}}
let results = null;        // resultados reales (o null)
let metaState = {
  deadline: DEFAULT_DEADLINE,
  lastScrape: null,        // {ok, at, error?}
};

/* ═════════════════════════════════════════
   PERSISTENCIA ATÓMICA
═════════════════════════════════════════ */
async function readJson(file, fallback) {
  try {
    const txt = await fs.readFile(file, 'utf8');
    return JSON.parse(txt);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJsonAtomic(file, data) {
  const tmp = file + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

async function loadState() {
  await fs.mkdir(DATA_DIR, {recursive: true});
  porras    = await readJson(PORRAS_FILE,  {});
  results   = await readJson(RESULTS_FILE, null);
  metaState = {...metaState, ...(await readJson(META_FILE, {}))};
}

const isLocked = () => Date.now() > Date.parse(metaState.deadline);

/* ═════════════════════════════════════════
   APP
═════════════════════════════════════════ */
const app = express();
app.use(express.json({limit: '256kb'}));
app.use(express.static(path.join(ROOT, 'public')));

// Health
app.get('/api/health', (_req, res) => res.json({ok:true, uptime: process.uptime()}));

// Meta
app.get('/api/meta', (_req, res) => {
  res.json({
    deadline: metaState.deadline,
    locked: isLocked(),
    lastScrape: metaState.lastScrape,
    count: Object.keys(porras).length,
  });
});

// Listado de porras (resumen)
app.get('/api/porras', (_req, res) => {
  const list = Object.values(porras).map(p => ({
    id: p.id,
    player: p.player,
    updatedAt: p.updatedAt,
  }));
  res.json(list);
});

// Una porra
app.get('/api/porras/:id', (req, res) => {
  const p = porras[req.params.id];
  if (!p) return res.status(404).json({error: 'not_found'});
  res.json(p);
});

// Crear/actualizar
app.post('/api/porras', async (req, res) => {
  const data = req.body || {};
  let {id} = data;

  if (id && !porras[id]) {
    // si trae id pero no existe (¿borrado?), lo regeneramos
    id = null;
  }

  if (isLocked()) {
    return res.status(423).json({error: 'locked', message: 'El plazo de envío ha finalizado.'});
  }

  if (!id) {
    id = crypto.randomUUID();
  }

  const stored = {
    id,
    player: typeof data.player === 'string' ? data.player.slice(0, 80) : '',
    groupResults: sanitizeGroupResults(data.groupResults),
    bracketWinners: sanitizeBracketWinners(data.bracketWinners),
    finalist1:       sanitizeStr(data.finalist1),
    finalist2:       sanitizeStr(data.finalist2),
    champion:        sanitizeStr(data.champion),
    topScorerTeam:   sanitizeStr(data.topScorerTeam),
    bestDefenseTeam: sanitizeStr(data.bestDefenseTeam),
    topScorerPlayer: sanitizeStr(data.topScorerPlayer, 80),
    createdAt: porras[id]?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  porras[id] = stored;
  await writeJsonAtomic(PORRAS_FILE, porras);
  res.json({id, updatedAt: stored.updatedAt});
});

// Resultados reales
app.get('/api/results', (_req, res) => {
  res.json(results || null);
});

// Ranking
app.get('/api/ranking', (_req, res) => {
  const list = Object.values(porras).map(p => {
    const bd = computeScore(p, results);
    return {
      id: p.id,
      player: p.player || '—',
      total: bd.total,
      breakdown: bd,
      updatedAt: p.updatedAt,
    };
  }).sort((a, b) => b.total - a.total);
  res.json(list);
});

// Admin: forzar refresh del scrape
app.post('/api/admin/scrape', async (req, res) => {
  if (!ADMIN_TOKEN || req.get('x-admin-token') !== ADMIN_TOKEN) {
    return res.status(401).json({error: 'unauthorized'});
  }
  try {
    await runScrape({throwOnError: true});
    res.json({ok: true, lastScrape: metaState.lastScrape});
  } catch (err) {
    res.status(500).json({error: 'scrape_failed', message: err.message});
  }
});

// Admin: sobrescribir resultados manualmente
app.post('/api/admin/results', async (req, res) => {
  if (!ADMIN_TOKEN || req.get('x-admin-token') !== ADMIN_TOKEN) {
    return res.status(401).json({error: 'unauthorized'});
  }
  results = req.body || null;
  await writeJsonAtomic(RESULTS_FILE, results);
  metaState.lastScrape = {ok: true, at: new Date().toISOString(), source: 'manual'};
  await writeJsonAtomic(META_FILE, metaState);
  res.json({ok: true});
});

/* ═════════════════════════════════════════
   SANITIZACIÓN
═════════════════════════════════════════ */
function sanitizeStr(s, max=60) {
  if (typeof s !== 'string') return '';
  return s.slice(0, max);
}

function sanitizeGroupResults(gr) {
  const out = {};
  if (!gr || typeof gr !== 'object') return out;
  for (const g of Object.keys(gr)) {
    const arr = gr[g];
    if (!Array.isArray(arr)) continue;
    out[g] = arr.slice(0, 6).map(v => (v === '1' || v === 'x' || v === '2') ? v : null);
    while (out[g].length < 6) out[g].push(null);
  }
  return out;
}

function sanitizeBracketWinners(bw) {
  const out = {};
  if (!bw || typeof bw !== 'object') return out;
  for (const k of Object.keys(bw)) {
    if (typeof bw[k] === 'string' && bw[k].length <= 60) out[k] = bw[k];
  }
  return out;
}

/* ═════════════════════════════════════════
   SCRAPE LOOP
═════════════════════════════════════════ */
async function runScrape({throwOnError = false} = {}) {
  try {
    const fresh = await scrape365Scores();
    results = fresh;
    await writeJsonAtomic(RESULTS_FILE, results);
    metaState.lastScrape = {ok: true, at: new Date().toISOString()};
    await writeJsonAtomic(META_FILE, metaState);
    console.log('[scrape] ok', new Date().toISOString());
  } catch (err) {
    console.error('[scrape] failed:', err.message);
    metaState.lastScrape = {ok: false, at: new Date().toISOString(), error: err.message};
    await writeJsonAtomic(META_FILE, metaState);
    if (throwOnError) throw err;
  }
}

function scheduleScrape() {
  // Solo durante el torneo
  const now = Date.now();
  const start = Date.parse('2026-06-11T00:00:00Z');
  const end   = Date.parse('2026-07-20T00:00:00Z');
  if (now < start || now > end) {
    console.log('[scrape] fuera de ventana del torneo, skipping cron');
    return;
  }
  runScrape();
  setInterval(runScrape, SCRAPE_INTERVAL_MS);
}

/* ═════════════════════════════════════════
   BOOT
═════════════════════════════════════════ */
(async () => {
  await loadState();
  app.listen(PORT, () => {
    console.log(`Porra Mundial 2026 escuchando en http://localhost:${PORT}`);
    console.log(`Deadline: ${metaState.deadline} (locked=${isLocked()})`);
    console.log(`Porras cargadas: ${Object.keys(porras).length}`);
  });
  scheduleScrape();
})().catch(err => {
  console.error('Fatal boot error:', err);
  process.exit(1);
});

#!/usr/bin/env node
/* ==========================================================================
   Genera server/players-seed.json scrappeando 365scores desde tu maquina.
   Uso: npm run sync:players
========================================================================== */
const path = require('path');
const fs = require('fs').promises;

const {scrape365ScoresPlayers} = require('./playerScraper.js');

const OUT = path.join(__dirname, 'players-seed.json');

async function main() {
  console.log('[sync:players] scrapeando 365scores...');
  const result = await scrape365ScoresPlayers({
    teamConcurrency: 4,
    requestTimeoutMs: 20_000,
  });

  await fs.writeFile(OUT, JSON.stringify(result.players, null, 2), 'utf8');

  console.log(`[sync:players] ${result.players.length} jugadores escritos en ${path.relative(process.cwd(), OUT)}`);
  console.log(`[sync:players] selecciones cubiertas: ${result.teamIds.length}/${result.sourceMeta.teamRefs}`);
  if (result.sourceMeta.errors?.length) {
    console.warn(`[sync:players] ${result.sourceMeta.errors.length} errores parciales:`);
    result.sourceMeta.errors.forEach(err => {
      console.warn(`  - ${err.teamId || '?'}: ${err.error}${err.url ? ` (${err.url})` : ''}`);
    });
  }
}

main().catch(err => {
  console.error('[sync:players] failed:', err.message);
  process.exit(1);
});

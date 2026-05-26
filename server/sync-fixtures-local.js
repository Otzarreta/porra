#!/usr/bin/env node
/* ==========================================================================
   Genera server/fixtures-seed.json con kickoff + sede de los partidos.
   Uso: npm run sync:fixtures
========================================================================== */
const path = require('path');
const fs = require('fs').promises;

const {fetchGamesForDate, teamFromCompetitor} = require('./scraper.js');
const {GROUP_FIXTURES, GROUP_ORDER} = require('../public/fixtures.js');

const TOURNAMENT_START = '2026-06-11';
const TOURNAMENT_END = '2026-07-19';
const OUT = path.join(__dirname, 'fixtures-seed.json');

async function main() {
  console.log('[sync:fixtures] scrapeando 365scores...');
  const dates = datesBetween(TOURNAMENT_START, TOURNAMENT_END);
  const matches = {};
  const errors = [];
  let totalGames = 0;
  let matchedGroup = 0;

  for (const date of dates) {
    let games;
    try {
      games = await fetchGamesForDate(date, globalThis.fetch);
    } catch (err) {
      errors.push({date: toIso(date), error: err.message});
      continue;
    }
    totalGames += games.length;
    for (const game of games) {
      const home = teamFromCompetitor(game.homeCompetitor);
      const away = teamFromCompetitor(game.awayCompetitor);
      if (!home || !away) continue;

      const group = groupLetterFromGame(game);
      if (group) {
        const fixture = findGroupFixtureIndex(group, home, away);
        if (!fixture) continue;
        const matchId = `${group}${fixture.idx + 1}`;
        matches[matchId] = buildEntry(game, {round: 'group', group, fixtureIdx: fixture.idx});
        matchedGroup++;
      }
    }
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    matches,
    sourceMeta: {
      source: '365scores',
      datesScanned: dates.length,
      totalGames,
      matchedGroup,
      errors,
    },
  };

  await fs.writeFile(OUT, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[sync:fixtures] escrito ${path.relative(process.cwd(), OUT)}`);
  console.log(`[sync:fixtures] partidos de grupo emparejados: ${matchedGroup}/72`);
  if (errors.length) {
    console.warn(`[sync:fixtures] ${errors.length} fechas con error: ${errors.map(e => e.date).join(', ')}`);
  }
}

function buildEntry(game, ctx) {
  return {
    ...ctx,
    kickoff: pickIso(game.startTime || game.startTimeUTC || game.gameTimeAndStatusDisplayType?.startTime),
    statusText: game.statusText || game.shortStatusText || null,
    venueName: game.venue?.name || game.venueName || null,
    venueCity: game.venue?.cityName || game.venueCity || null,
    sourceGameId: game.id || game.gameId || null,
  };
}

function pickIso(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function findGroupFixtureIndex(group, homeTeam, awayTeam) {
  const fixtures = GROUP_FIXTURES[group] || [];
  for (let idx = 0; idx < fixtures.length; idx++) {
    const fixture = fixtures[idx];
    if (fixture.homeId === homeTeam && fixture.awayId === awayTeam) return {idx, inverted: false};
    if (fixture.homeId === awayTeam && fixture.awayId === homeTeam) return {idx, inverted: true};
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
  const num = Number(game.groupNum || game.groupId);
  if (num >= 1 && num <= GROUP_ORDER.length) return GROUP_ORDER[num - 1];
  return null;
}

function datesBetween(start, end) {
  const dates = [];
  const cursor = parseIso(start);
  const last = parseIso(end);
  while (cursor <= last) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function parseIso(value) {
  const [y, m, d] = String(value).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function toIso(date) {
  return date.toISOString().slice(0, 10);
}

main().catch(err => {
  console.error('[sync:fixtures] failed:', err.message);
  process.exit(1);
});

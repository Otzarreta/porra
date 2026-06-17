#!/usr/bin/env node
/* ==========================================================================
   Auditoría de puntos de la porra.
   Recalcula el desglose detallado de cada usuario a partir de los datos reales
   (porra-data/ por defecto) y verifica que cada punto — incluidos los
   especiales — está contabilizado y que la suma de eventos coincide con el
   total del ranking. Uso:
     node server/verify-scores.js [ruta-a-data-dir]
   Sale con código != 0 si detecta cualquier inconsistencia.
========================================================================== */
const fs = require('fs');
const path = require('path');
const {computeScore, computeScoreDetailed, reconcileScorerIds} = require('./scoring.js');
const {getTeamName, GROUP_ORDER, resultFromPrediction} = require('../public/fixtures.js');

const DATA_DIR = path.resolve(process.argv[2] || path.join(__dirname, '..', 'porra-data'));

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
}

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};
const c = (color, txt) => `${C[color]}${txt}${C.reset}`;

const ROUND_LABEL = {
  grupos: 'Grupos', r32: '1/16', r16: 'Octavos', qf: 'Cuartos',
  sf: 'Semis', third: '3er puesto', final: 'Final',
};

function main() {
  console.log(c('bold', `\n=== AUDITORÍA DE PUNTOS ===`));
  console.log(c('dim', `Datos: ${DATA_DIR}\n`));

  const porras = readJson('porras.json');
  let players = [];
  try { players = readJson('players.json'); } catch { /* opcional */ }
  // Reconciliamos los ids de goleador igual que hace el servidor, para que los
  // goles del jugador elegido (que se guarda con id de plantilla) se cuenten.
  const results = reconcileScorerIds(readJson('results.json'), players);

  const playerName = {};
  players.forEach(p => { if (p && p.id) playerName[p.id] = p.name; });
  const scorers = results.scorers || {};
  const resolvePlayer = id => playerName[id] || scorers[id]?.name || id;
  const teamGoals = results.teamGoals || {};
  const playerGoals = results.playerGoals || {};

  const rows = Object.values(porras).map(p => {
    const {breakdown, events} = computeScoreDetailed(p, results);
    return {porra: p, breakdown, events};
  }).sort((a, b) => b.breakdown.total - a.breakdown.total
    || String(a.porra.player).localeCompare(String(b.porra.player)));

  const problems = [];
  const anomalies = [];

  rows.forEach((row, i) => {
    const {porra, breakdown, events} = row;
    const name = porra.player || '(sin nombre)';
    console.log(c('cyan', `\n${'─'.repeat(64)}`));
    console.log(`${c('bold', `#${i + 1}  ${name}`)}  ${c('dim', porra.email || '')}  →  ${c('bold', c('green', `${breakdown.total} pts`))}`);

    // --- Verificación de consistencia: suma de eventos === breakdown ---
    const sumGroups = events.grupos.reduce((s, e) => s + e.points, 0);
    const sumEspeciales = events.especiales.reduce((s, e) => s + e.points, 0);
    const bracketByRound = {};
    events.bracket.forEach(e => { bracketByRound[e.phase] = (bracketByRound[e.phase] || 0) + e.points; });

    const check = (label, eventsSum, bdValue) => {
      if (eventsSum !== bdValue) {
        const msg = `${name}: ${label} suma de eventos=${eventsSum} != breakdown=${bdValue}`;
        problems.push(msg);
        console.log(c('red', `  ✗ INCONSISTENCIA ${label}: eventos=${eventsSum} breakdown=${bdValue}`));
      }
    };
    check('grupos', sumGroups, breakdown.grupos);
    check('especiales', sumEspeciales, breakdown.especiales);
    ['r32', 'r16', 'qf', 'sf', 'third', 'final'].forEach(r => check(r, bracketByRound[r] || 0, breakdown[r]));
    const totalEvents = sumGroups + sumEspeciales + events.bracket.reduce((s, e) => s + e.points, 0);
    if (totalEvents !== breakdown.total) {
      const msg = `${name}: total eventos=${totalEvents} != total breakdown=${breakdown.total}`;
      problems.push(msg);
      console.log(c('red', `  ✗ INCONSISTENCIA total: eventos=${totalEvents} breakdown=${breakdown.total}`));
    }

    // --- Detalle: Grupos ---
    if (events.grupos.length) {
      console.log(c('bold', `  Grupos (${breakdown.grupos} pts):`));
      events.grupos.forEach(e => {
        const real = `${e.realHome}-${e.realAway}`;
        const pred = `${e.predHome}-${e.predAway}`;
        const tag = e.hit === 'exact' ? c('green', 'EXACTO') : c('yellow', 'resultado');
        console.log(`    ${e.group}${e.idx + 1}  ${getTeamName(e.homeId)} ${real} ${getTeamName(e.awayId)}  ${c('dim', `(tú: ${pred})`)}  ${tag} ${c('bold', `+${e.points}`)}`);
      });
    }

    // --- Detalle: Eliminatorias ---
    if (events.bracket.length) {
      console.log(c('bold', `  Eliminatorias:`));
      events.bracket.forEach(e => {
        const tag = e.exact ? c('green', 'EXACTO') : c('yellow', 'ganador');
        console.log(`    ${ROUND_LABEL[e.phase]} ${e.matchId}  ${getTeamName(e.winnerId)}  ${tag} ${c('bold', `+${e.points}`)}`);
      });
    }

    // --- Detalle: Especiales ---
    if (events.especiales.length) {
      console.log(c('bold', `  Especiales (${breakdown.especiales} pts):`));
      events.especiales.forEach(e => {
        if (e.kind === 'topScorerTeam') {
          console.log(`    Máx. goleador (equipo): ${getTeamName(e.targetId)} · ${e.goals} goles a favor ${c('bold', `+${e.points}`)}`);
        } else if (e.kind === 'worstDefenseTeam') {
          console.log(`    Equipo más goleado: ${getTeamName(e.targetId)} · ${e.goals} goles en contra ${c('bold', `+${e.points}`)}`);
        } else {
          console.log(`    Máx. goleador (jugador): ${resolvePlayer(e.targetId)} · ${e.goals} goles ${c('bold', `+${e.points}`)}`);
        }
      });
    } else if (porra.topScorerTeam || porra.worstDefenseTeam || porra.topScorerPlayerId) {
      console.log(c('dim', `  Especiales: elegidos pero aún sin goles → 0 pts`));
    }

    if (breakdown.total === 0) console.log(c('dim', '  (todavía sin puntos)'));

    // --- Anomalías de datos (no afectan al total, pero conviene saberlo) ---
    if (porra.topScorerTeam && !(porra.topScorerTeam in teamGoals)) {
      anomalies.push(`${name}: topScorerTeam "${porra.topScorerTeam}" no aparece en teamGoals`);
    }
    if (porra.worstDefenseTeam && !(porra.worstDefenseTeam in teamGoals)) {
      anomalies.push(`${name}: worstDefenseTeam "${porra.worstDefenseTeam}" no aparece en teamGoals`);
    }
    if (porra.topScorerPlayerId && !playerName[porra.topScorerPlayerId] && !scorers[porra.topScorerPlayerId]) {
      anomalies.push(`${name}: topScorerPlayerId "${porra.topScorerPlayerId}" no existe en players.json ni ha marcado`);
    }
    // Partidos de grupo jugados sin pronóstico válido del usuario.
    GROUP_ORDER.forEach(g => {
      (results.groupMatches?.[g] || []).forEach(m => {
        if (!m.result) return;
        const pred = porra.groupPredictions?.[g]?.[Number(m.idx)];
        if (!resultFromPrediction(pred)) {
          anomalies.push(`${name}: ${g}${Number(m.idx) + 1} jugado pero sin pronóstico completo`);
        }
      });
    });
  });

  // --- Resumen global ---
  console.log(c('cyan', `\n${'═'.repeat(64)}`));
  console.log(c('bold', 'RESUMEN'));
  rows.forEach((r, i) => {
    const b = r.breakdown;
    console.log(`  ${String(i + 1).padStart(2)}. ${(r.porra.player || '-').padEnd(24)} ${String(b.total).padStart(4)} pts   ${c('dim', `grupos:${b.grupos} especiales:${b.especiales}`)}`);
  });

  // Cuadre global de especiales: total de goles disponibles vs repartidos.
  console.log(c('cyan', `\n${'─'.repeat(64)}`));
  const playedGroup = GROUP_ORDER.reduce((s, g) => s + (results.groupMatches?.[g] || []).filter(m => m.result).length, 0);
  console.log(c('dim', `Partidos de grupo con resultado: ${playedGroup}`));
  console.log(c('dim', `Equipos con goles registrados: ${Object.keys(teamGoals).length} · jugadores goleadores: ${Object.keys(playerGoals).length}`));

  if (anomalies.length) {
    console.log(c('yellow', `\n⚠ Anomalías de datos (${anomalies.length}):`));
    [...new Set(anomalies)].forEach(a => console.log(c('yellow', `  - ${a}`)));
  }

  console.log('');
  if (problems.length) {
    console.log(c('red', c('bold', `✗ ${problems.length} INCONSISTENCIA(S) DE PUNTOS DETECTADA(S)`)));
    problems.forEach(p => console.log(c('red', `  - ${p}`)));
    process.exit(1);
  }
  console.log(c('green', c('bold', `✓ Todos los puntos cuadran: la suma de eventos coincide con el total de cada usuario (${rows.length} porras).`)));
}

main();

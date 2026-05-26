/* ═══════════════════════════════════════════════════════
   SCORING — fuente única de verdad para el cálculo de puntos
   Se usa tanto para el ranking server-side como (opcionalmente)
   por el cliente para una estimación local.
═══════════════════════════════════════════════════════ */
const {GROUPS, GROUP_FIXTURES, R32, R16, QF, SF} = require('../public/fixtures.js');

const POINTS = {grupos:1, r32:2, r16:3, qf:4, sf:6, finalist:8, champion:10};

/**
 * computeScore(porra, results)
 *   porra:   {player, groupResults:{A:[...6],...}, bracketWinners:{m1:'México',...},
 *             finalist1, finalist2, champion, topScorerTeam, bestDefenseTeam, topScorerPlayer}
 *   results: opcional. Si no hay resultados reales, devuelve la "estimación":
 *            puntúa por cada pronóstico realizado (mismo cálculo que el cliente).
 *            Si hay results, puntúa solo los aciertos reales.
 *
 *   results: {
 *     groupMatches: {A:[{idx:0,result:'1'|'x'|'2'},...]},
 *     bracketAdvanced: {r32:['México','Brasil',...], r16:[...], qf:[...], sf:[...], finalists:[...], champion:'...'},
 *     teamGoals: {'México':{for:5,against:3},...},
 *     playerGoals: {'Lamine Yamal': 4, ...}
 *   }
 */
function computeScore(porra, results) {
  const bd = {grupos:0, r32:0, r16:0, qf:0, sf:0, finalists:0, champion:0, especiales:0};

  if (!results) {
    // estimación: contar pronósticos hechos
    Object.keys(GROUPS).forEach(g => {
      (porra.groupResults?.[g] || []).forEach(r => { if (r) bd.grupos += POINTS.grupos; });
    });
    const cw = (matches, key, pts) => matches.forEach(m => { if (porra.bracketWinners?.[m.id]) bd[key] += pts; });
    cw(R32,'r32',POINTS.r32); cw(R16,'r16',POINTS.r16); cw(QF,'qf',POINTS.qf); cw(SF,'sf',POINTS.sf);
    if (porra.finalist1) bd.finalists += POINTS.finalist;
    if (porra.finalist2) bd.finalists += POINTS.finalist;
    if (porra.champion)  bd.champion  += POINTS.champion;
    bd.total = sum(bd);
    return bd;
  }

  // Con resultados reales: comparar aciertos
  // Grupos: 1 pt por cada 1X2 acertado
  Object.keys(GROUPS).forEach(g => {
    const pred = porra.groupResults?.[g] || [];
    const real = results.groupMatches?.[g] || [];
    real.forEach(m => {
      if (m.result && pred[m.idx] === m.result) bd.grupos += POINTS.grupos;
    });
  });

  // Eliminatorias: por cada equipo correctamente predicho que llegó a la ronda
  // El usuario predice un GANADOR de cada match; lo que cuenta es que ese equipo
  // aparezca en el array de avanzados de esa ronda (sin importar posición).
  const advR32 = new Set(results.bracketAdvanced?.r32 || []);
  const advR16 = new Set(results.bracketAdvanced?.r16 || []);
  const advQF  = new Set(results.bracketAdvanced?.qf  || []);
  const advSF  = new Set(results.bracketAdvanced?.sf  || []);
  const advFinalists = new Set(results.bracketAdvanced?.finalists || []);
  const realChampion = results.bracketAdvanced?.champion || null;

  R32.forEach(m => { const w = porra.bracketWinners?.[m.id]; if (w && advR32.has(w)) bd.r32 += POINTS.r32; });
  R16.forEach(m => { const w = porra.bracketWinners?.[m.id]; if (w && advR16.has(w)) bd.r16 += POINTS.r16; });
  QF .forEach(m => { const w = porra.bracketWinners?.[m.id]; if (w && advQF .has(w)) bd.qf  += POINTS.qf;  });
  SF .forEach(m => { const w = porra.bracketWinners?.[m.id]; if (w && advSF .has(w)) bd.sf  += POINTS.sf;  });

  if (porra.finalist1 && advFinalists.has(porra.finalist1)) bd.finalists += POINTS.finalist;
  if (porra.finalist2 && advFinalists.has(porra.finalist2)) bd.finalists += POINTS.finalist;
  if (porra.champion && porra.champion === realChampion)    bd.champion  += POINTS.champion;

  // Especiales: 1 pt/gol marcado/recibido/anotado
  const tg = results.teamGoals || {};
  if (porra.topScorerTeam && tg[porra.topScorerTeam])  bd.especiales += tg[porra.topScorerTeam].for || 0;
  if (porra.bestDefenseTeam && tg[porra.bestDefenseTeam]) bd.especiales += tg[porra.bestDefenseTeam].against || 0;
  const pg = results.playerGoals || {};
  if (porra.topScorerPlayer) {
    const key = Object.keys(pg).find(k => normalizeName(k) === normalizeName(porra.topScorerPlayer));
    if (key) bd.especiales += pg[key] || 0;
  }

  bd.total = sum(bd);
  return bd;
}

function sum(bd) { return bd.grupos + bd.r32 + bd.r16 + bd.qf + bd.sf + bd.finalists + bd.champion + bd.especiales; }
function normalizeName(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim(); }

module.exports = {computeScore, POINTS};

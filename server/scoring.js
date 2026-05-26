/* ==========================================================================
   Scoring server-side de la porra.
   Sin resultados reales no hay puntos: solo existe progreso de porra.
========================================================================== */
const {
  GROUP_ORDER,
  BRACKET_BY_ROUND,
  resultFromPrediction,
  normalizeName,
} = require('../public/fixtures.js');

const POINTS = {
  grupos: 1,
  r32: 2,
  r16: 3,
  qf: 4,
  sf: 6,
  finalist: 8,
  champion: 10,
};

function emptyBreakdown() {
  return {grupos: 0, r32: 0, r16: 0, qf: 0, sf: 0, finalists: 0, champion: 0, especiales: 0, total: 0};
}

function computeScore(porra = {}, results = null) {
  const bd = emptyBreakdown();
  if (!results) return bd;

  scoreGroups(bd, porra, results);
  scoreBracket(bd, porra, results);
  scoreSpecials(bd, porra, results);

  bd.total = bd.grupos + bd.r32 + bd.r16 + bd.qf + bd.sf + bd.finalists + bd.champion + bd.especiales;
  return bd;
}

function scoreGroups(bd, porra, results) {
  const groupMatches = results.groupMatches || {};
  GROUP_ORDER.forEach(group => {
    const realMatches = Array.isArray(groupMatches[group]) ? groupMatches[group] : [];
    realMatches.forEach(match => {
      const idx = Number(match.idx);
      if (!Number.isInteger(idx) || !match.result) return;
      const predicted = getPredictedGroupResult(porra, group, idx);
      if (predicted && predicted === match.result) bd.grupos += POINTS.grupos;
    });
  });
}

function getPredictedGroupResult(porra, group, idx) {
  const score = porra.groupPredictions?.[group]?.[idx];
  const scoreResult = resultFromPrediction(score);
  if (scoreResult) return scoreResult;

  const legacy = porra.groupResults?.[group]?.[idx];
  return resultFromPrediction(legacy);
}

function scoreBracket(bd, porra, results) {
  const advanced = results.bracketAdvanced || {};
  addRoundPoints(bd, 'r32', BRACKET_BY_ROUND.r32, new Set(advanced.r32 || []));
  addRoundPoints(bd, 'r16', BRACKET_BY_ROUND.r16, new Set(advanced.r16 || []));
  addRoundPoints(bd, 'qf', BRACKET_BY_ROUND.qf, new Set(advanced.qf || []));
  addRoundPoints(bd, 'sf', BRACKET_BY_ROUND.sf, new Set(advanced.sf || []));

  const finalists = new Set(advanced.finalists || []);
  const predictedFinalists = getPredictedFinalists(porra);
  predictedFinalists.forEach(teamId => {
    if (teamId && finalists.has(teamId)) bd.finalists += POINTS.finalist;
  });

  const predictedChampion = porra.bracketWinners?.M104 || porra.champion || '';
  if (predictedChampion && predictedChampion === advanced.champion) {
    bd.champion += POINTS.champion;
  }

  function addRoundPoints(target, key, matches, realSet) {
    matches.forEach(match => {
      const predicted = porra.bracketWinners?.[match.id];
      if (predicted && realSet.has(predicted)) target[key] += POINTS[key];
    });
  }
}

function getPredictedFinalists(porra) {
  const fromBracket = [porra.bracketWinners?.M101, porra.bracketWinners?.M102].filter(Boolean);
  if (fromBracket.length) return fromBracket;
  return [porra.finalist1, porra.finalist2].filter(Boolean);
}

function scoreSpecials(bd, porra, results) {
  const teamGoals = results.teamGoals || {};
  const topTeam = porra.topScorerTeam || '';
  const defenseTeam = porra.bestDefenseTeam || '';
  if (topTeam && teamGoals[topTeam]) bd.especiales += Number(teamGoals[topTeam].for) || 0;
  if (defenseTeam && teamGoals[defenseTeam]) bd.especiales += Number(teamGoals[defenseTeam].against) || 0;

  const playerGoals = results.playerGoals || {};
  const playerId = porra.topScorerPlayerId || '';
  if (playerId && Object.prototype.hasOwnProperty.call(playerGoals, playerId)) {
    bd.especiales += Number(playerGoals[playerId]) || 0;
    return;
  }

  const legacyPlayer = porra.topScorerPlayer || '';
  if (legacyPlayer) {
    const key = Object.keys(playerGoals).find(candidate => normalizeName(candidate) === normalizeName(legacyPlayer));
    if (key) bd.especiales += Number(playerGoals[key]) || 0;
  }
}

module.exports = {computeScore, POINTS, emptyBreakdown};

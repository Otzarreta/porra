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
  grupos: {winner: 1, exact: 2},
  r32: {winner: 2, exact: 3},
  r16: {winner: 2, exact: 3},
  qf: {winner: 3, exact: 4},
  sf: {winner: 3, exact: 4},
  third: {winner: 3, exact: 4},
  final: {winner: 10, exact: 15},
  championTeam: 10,
  topScorerTeam: 10,
  topScorerPlayer: 10,
};

function emptyBreakdown() {
  return {grupos: 0, r32: 0, r16: 0, qf: 0, sf: 0, third: 0, final: 0, especiales: 0, total: 0};
}

function computeScore(porra = {}, results = null) {
  const bd = emptyBreakdown();
  if (!results) return bd;

  scoreGroups(bd, porra, results);
  scoreBracket(bd, porra, results);
  scoreSpecials(bd, porra, results);

  bd.total = bd.grupos + bd.r32 + bd.r16 + bd.qf + bd.sf + bd.third + bd.final + bd.especiales;
  return bd;
}

function scoreGroups(bd, porra, results) {
  const groupMatches = results.groupMatches || {};
  GROUP_ORDER.forEach(group => {
    const realMatches = Array.isArray(groupMatches[group]) ? groupMatches[group] : [];
    realMatches.forEach(match => {
      const idx = Number(match.idx);
      if (!Number.isInteger(idx) || !match.result) return;
      const predicted = porra.groupPredictions?.[group]?.[idx];
      const predictedResult = resultFromPrediction(predicted);
      if (!predictedResult || predictedResult !== match.result) return;

      const realHome = Number(match.goalsHome);
      const realAway = Number(match.goalsAway);
      const predHome = Number(predicted?.homeGoals);
      const predAway = Number(predicted?.awayGoals);
      const exact = Number.isInteger(realHome) && Number.isInteger(realAway)
        && Number.isInteger(predHome) && Number.isInteger(predAway)
        && realHome === predHome && realAway === predAway;
      bd.grupos += exact ? POINTS.grupos.exact : POINTS.grupos.winner;
    });
  });
}

function scoreBracket(bd, porra, results) {
  const advanced = results.bracketAdvanced || {};
  const knockoutMatches = results.knockoutMatches || {};

  ['r32', 'r16', 'qf', 'sf', 'third', 'final'].forEach(round => {
    const matches = BRACKET_BY_ROUND[round] || [];
    const winnersSet = winnersForRound(round, advanced);
    const realGames = Array.isArray(knockoutMatches[round]) ? knockoutMatches[round] : [];

    matches.forEach(match => {
      const predictedWinner = porra.bracketWinners?.[match.id];
      if (!predictedWinner || !winnersSet.has(predictedWinner)) return;

      const exact = matchExactScore(porra.bracketScores?.[match.id], predictedWinner, realGames);
      bd[round] += exact ? POINTS[round].exact : POINTS[round].winner;
    });
  });
}

function winnersForRound(round, advanced) {
  if (round === 'final') return new Set([advanced.champion].filter(Boolean));
  if (round === 'third') return new Set(advanced.third || []);
  return new Set(advanced[round] || []);
}

function matchExactScore(predScore, predictedWinner, realGames) {
  if (!predScore) return false;
  const predHome = Number(predScore.homeGoals);
  const predAway = Number(predScore.awayGoals);
  if (!Number.isInteger(predHome) || !Number.isInteger(predAway)) return false;
  const predPair = [predHome, predAway].sort((a, b) => a - b);

  return realGames.some(game => {
    if (!game || game.winner !== predictedWinner) return false;
    const realPair = [Number(game.goalsHome), Number(game.goalsAway)].sort((a, b) => a - b);
    return predPair[0] === realPair[0] && predPair[1] === realPair[1];
  });
}

function scoreSpecials(bd, porra, results) {
  const advanced = results.bracketAdvanced || {};

  if (porra.championTeam && advanced.champion && porra.championTeam === advanced.champion) {
    bd.especiales += POINTS.championTeam;
  }

  if (porra.topScorerTeam && advanced.topScorerTeam && porra.topScorerTeam === advanced.topScorerTeam) {
    bd.especiales += POINTS.topScorerTeam;
  } else if (porra.topScorerTeam && !advanced.topScorerTeam) {
    const teamGoals = results.teamGoals || {};
    const sorted = Object.entries(teamGoals)
      .map(([teamId, value]) => ({teamId, goals: Number(value?.for) || 0}))
      .sort((a, b) => b.goals - a.goals);
    if (sorted.length && sorted[0].teamId === porra.topScorerTeam && sorted[0].goals > 0) {
      bd.especiales += POINTS.topScorerTeam;
    }
  }

  const playerGoals = results.playerGoals || {};
  const predictedPlayerId = porra.topScorerPlayerId || '';
  if (predictedPlayerId && results.topScorerPlayerId && predictedPlayerId === results.topScorerPlayerId) {
    bd.especiales += POINTS.topScorerPlayer;
  } else if (predictedPlayerId && Object.keys(playerGoals).length) {
    const sorted = Object.entries(playerGoals)
      .map(([id, goals]) => ({id, goals: Number(goals) || 0}))
      .sort((a, b) => b.goals - a.goals);
    if (sorted.length && sorted[0].id === predictedPlayerId && sorted[0].goals > 0) {
      bd.especiales += POINTS.topScorerPlayer;
    }
  } else if (predictedPlayerId) {
    const legacyPlayer = porra.topScorerPlayer || '';
    if (legacyPlayer) {
      const key = Object.keys(playerGoals).find(candidate => normalizeName(candidate) === normalizeName(legacyPlayer));
      if (key && playerGoals[key] > 0) {
        const sorted = Object.entries(playerGoals).sort((a, b) => Number(b[1]) - Number(a[1]));
        if (sorted[0][0] === key) bd.especiales += POINTS.topScorerPlayer;
      }
    }
  }
}

module.exports = {computeScore, POINTS, emptyBreakdown};

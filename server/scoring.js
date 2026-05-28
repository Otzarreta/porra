/* ==========================================================================
   Scoring server-side de la porra.
   Sin resultados reales no hay puntos: solo existe progreso de porra.
========================================================================== */
const {
  GROUP_ORDER,
  BRACKET_BY_ROUND,
  resultFromPrediction,
} = require('../public/fixtures.js');

const POINTS = {
  grupos: {winner: 1, exact: 2},
  r32: {winner: 2, exact: 3},
  r16: {winner: 2, exact: 3},
  qf: {winner: 3, exact: 4},
  sf: {winner: 3, exact: 4},
  third: {winner: 3, exact: 4},
  final: {winner: 10, exact: 15},
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
  const teamGoals = results.teamGoals || {};
  const playerGoals = results.playerGoals || {};

  // Un punto por cada gol que marque la selección elegida como más goleadora,
  // sea o no la máxima goleadora del torneo.
  if (porra.topScorerTeam) {
    bd.especiales += Number(teamGoals[porra.topScorerTeam]?.for) || 0;
  }

  // Un punto por cada gol que reciba la selección elegida como más goleada,
  // sea o no la más goleada del torneo.
  if (porra.worstDefenseTeam) {
    bd.especiales += Number(teamGoals[porra.worstDefenseTeam]?.against) || 0;
  }

  // Un punto por cada gol que marque el jugador elegido como máximo goleador,
  // sea o no el máximo goleador del torneo.
  if (porra.topScorerPlayerId) {
    bd.especiales += Number(playerGoals[porra.topScorerPlayerId]) || 0;
  }
}

module.exports = {computeScore, POINTS, emptyBreakdown};

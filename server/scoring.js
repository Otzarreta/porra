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
};

function emptyBreakdown() {
  return {grupos: 0, r32: 0, r16: 0, qf: 0, sf: 0, third: 0, final: 0, especiales: 0, total: 0};
}

// 365scores usa identificadores de jugador distintos en la lista de plantillas
// (de donde el usuario elige su goleador) y en los eventos de gol de los
// partidos. Para que los goles del jugador elegido cuenten, remapeamos las
// claves de scorers/playerGoals al id de plantilla casando por nombre+selección.
// Idempotente: si un id ya es de plantilla, se mapea a sí mismo.
function reconcileScorerIds(results, players = []) {
  if (!results || !results.scorers) return results;
  const squadByNameTeam = new Map();
  (players || []).forEach(p => {
    if (!p || !p.id || !p.name) return;
    squadByNameTeam.set(`${normalizeName(p.name)}|${p.teamId || ''}`, p.id);
  });

  const remapId = id => {
    const info = results.scorers[id];
    if (!info || !info.name) return id;
    return squadByNameTeam.get(`${normalizeName(info.name)}|${info.teamId || ''}`) || id;
  };

  const scorers = {};
  Object.keys(results.scorers).forEach(id => { scorers[remapId(id)] = results.scorers[id]; });

  const playerGoals = {};
  Object.entries(results.playerGoals || {}).forEach(([id, goals]) => {
    const target = remapId(id);
    playerGoals[target] = (playerGoals[target] || 0) + (Number(goals) || 0);
  });

  return {...results, scorers, playerGoals};
}

function emptyEvents() {
  return {grupos: [], bracket: [], especiales: []};
}

// Fuente única: calcula el breakdown y, opcionalmente, el detalle de cada punto.
// computeScore es un envoltorio sobre esto, así el total agregado nunca diverge
// de la suma de eventos que se muestra en la auditoría y en el popup.
function computeScoreDetailed(porra = {}, results = null) {
  const bd = emptyBreakdown();
  const events = emptyEvents();
  if (!results) return {breakdown: bd, events};

  scoreGroups(bd, porra, results, events.grupos);
  scoreBracket(bd, porra, results, events.bracket);
  scoreSpecials(bd, porra, results, events.especiales);

  bd.total = bd.grupos + bd.r32 + bd.r16 + bd.qf + bd.sf + bd.third + bd.final + bd.especiales;
  return {breakdown: bd, events};
}

function computeScore(porra = {}, results = null) {
  return computeScoreDetailed(porra, results).breakdown;
}

function scoreGroups(bd, porra, results, out = null) {
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
      const points = exact ? POINTS.grupos.exact : POINTS.grupos.winner;
      bd.grupos += points;
      if (out) {
        out.push({
          phase: 'grupos', group, idx,
          homeId: match.home, awayId: match.away,
          realHome: Number.isInteger(realHome) ? realHome : null,
          realAway: Number.isInteger(realAway) ? realAway : null,
          predHome: Number.isInteger(predHome) ? predHome : null,
          predAway: Number.isInteger(predAway) ? predAway : null,
          hit: exact ? 'exact' : 'winner', points,
        });
      }
    });
  });
}

function scoreBracket(bd, porra, results, out = null) {
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
      const points = exact ? POINTS[round].exact : POINTS[round].winner;
      bd[round] += points;
      if (out) {
        const predScore = porra.bracketScores?.[match.id];
        out.push({
          phase: round, matchId: match.id, winnerId: predictedWinner, exact,
          predHome: Number.isInteger(Number(predScore?.homeGoals)) ? Number(predScore.homeGoals) : null,
          predAway: Number.isInteger(Number(predScore?.awayGoals)) ? Number(predScore.awayGoals) : null,
          points,
        });
      }
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

function scoreSpecials(bd, porra, results, out = null) {
  const teamGoals = results.teamGoals || {};
  const playerGoals = results.playerGoals || {};

  // Un punto por cada gol que marque la selección elegida como más goleadora,
  // sea o no la máxima goleadora del torneo.
  if (porra.topScorerTeam) {
    const goals = Number(teamGoals[porra.topScorerTeam]?.for) || 0;
    bd.especiales += goals;
    if (out && goals > 0) {
      out.push({kind: 'topScorerTeam', targetId: porra.topScorerTeam, goals, points: goals});
    }
  }

  // Un punto por cada gol que reciba la selección elegida como más goleada,
  // sea o no la más goleada del torneo.
  if (porra.worstDefenseTeam) {
    const goals = Number(teamGoals[porra.worstDefenseTeam]?.against) || 0;
    bd.especiales += goals;
    if (out && goals > 0) {
      out.push({kind: 'worstDefenseTeam', targetId: porra.worstDefenseTeam, goals, points: goals});
    }
  }

  // Un punto por cada gol que marque el jugador elegido como máximo goleador,
  // sea o no el máximo goleador del torneo.
  if (porra.topScorerPlayerId) {
    const goals = Number(playerGoals[porra.topScorerPlayerId]) || 0;
    bd.especiales += goals;
    if (out && goals > 0) {
      out.push({kind: 'topScorerPlayer', targetId: porra.topScorerPlayerId, goals, points: goals});
    }
  }
}

module.exports = {computeScore, computeScoreDetailed, reconcileScorerIds, POINTS, emptyBreakdown};

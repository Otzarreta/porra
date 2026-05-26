/* global API, GROUP_ORDER, GROUPS, TEAMS, TEAM_IDS, GROUP_FIXTURES, BRACKET_BY_ROUND, BRACKET_MATCHES */
/* global createEmptyGroupPredictions, normalizeGroupPredictions, sanitizeScoreValue, isScoreComplete */
/* global buildGroupStandings, resolveBracketMatches, getTeamName, getTeamFlag, getTeamFlagImg */

const KICKOFF_DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  weekday: 'short',
  day: '2-digit',
  month: 'short',
});

const KICKOFF_TIME_FORMATTER = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  hour: '2-digit',
  minute: '2-digit',
});

function formatKickoff(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = KICKOFF_DATE_FORMATTER.format(date).replace('.', '');
  const time = KICKOFF_TIME_FORMATTER.format(date);
  return {day, time, iso};
}

function kickoffMeta(matchId) {
  const entry = state.kickoffs?.[matchId];
  if (!entry?.kickoff) return null;
  const f = formatKickoff(entry.kickoff);
  if (!f) return null;
  return {...f, venue: entry.venueName || '', city: entry.venueCity || ''};
}

const state = {
  meta: {locked: false, deadline: null},
  accessToken: '',
  porraId: '',
  email: '',
  player: '',
  players: [],
  kickoffs: {},
  homeMatchView: 'groups',
  groupPredictions: createEmptyGroupPredictions(),
  bracketWinners: {},
  bracketScores: {},
  topScorerTeam: '',
  topScorerPlayerId: '',
  score: 0,
  autosaveReady: false,
};

let saveTimer = null;
let saveInFlight = false;
let lastSavedAt = null;
let saveTicker = null;

function init() {
  buildGroups();
  buildBracket();
  buildSpecialSelects();
  buildHomeMatches();
  loadPublicData().then(() => restoreAccess()).catch(err => {
    console.warn('init failed', err);
    setAccessMessage('No se pudo conectar con el servidor.', 'error');
  });
}

async function loadPublicData() {
  const [meta, players, kickoffs] = await Promise.all([
    API.getMeta(),
    API.getPlayers().catch(() => []),
    API.getKickoffs().catch(() => ({})),
  ]);
  state.meta = meta || state.meta;
  state.players = Array.isArray(players) ? players : [];
  state.kickoffs = kickoffs && typeof kickoffs === 'object' ? kickoffs : {};
  buildGroups();
  buildHomeMatches();
  renderMeta();
  renderPlayerOptions();
  applyLockState();
  await refreshRanking();
}

async function restoreAccess() {
  const email = localStorage.getItem('porraEmail') || '';
  const alias = localStorage.getItem('playerAlias') || '';
  if (!email) return;
  document.getElementById('player-email').value = email;
  document.getElementById('player-alias').value = alias;
  await loginUser(true);
}

async function loginUser(silent) {
  const email = document.getElementById('player-email').value.trim();
  const alias = document.getElementById('player-alias').value.trim();
  if (!email) {
    setAccessMessage('Introduce tu correo electrónico.', 'error');
    return;
  }
  setAccessMessage('Abriendo tu porra...', 'pending');
  try {
    const res = await API.access(email, alias);
    state.accessToken = res.accessToken || '';
    state.porraId = res.porra?.id || '';
    state.email = res.porra?.email || email.toLowerCase();
    state.player = res.porra?.player || alias || '';
    if (res.meta) state.meta = res.meta;
    localStorage.setItem('porraEmail', state.email);
    localStorage.setItem('playerAlias', state.player);
    applyPorra(res.porra || {});
    showGame();
    setAccessMessage('');
    state.autosaveReady = true;
    await refreshRanking();
    if (!silent) showToast('Porra abierta');
  } catch (err) {
    console.error('access failed', err);
    const msg = err.status === 423 ? 'El plazo está cerrado.' : 'No se pudo abrir la porra con ese correo.';
    setAccessMessage(msg, 'error');
  }
}

function showGame() {
  document.getElementById('home-view').classList.add('hidden');
  document.getElementById('game-view').classList.remove('hidden');
  document.getElementById('active-player').textContent = state.player || '-';
  renderAll();
}

function returnHome() {
  document.getElementById('game-view').classList.add('hidden');
  document.getElementById('home-view').classList.remove('hidden');
  document.getElementById('player-email').value = state.email || localStorage.getItem('porraEmail') || '';
  document.getElementById('player-alias').value = state.player || localStorage.getItem('playerAlias') || '';
  refreshRanking();
}

function logoutUser() {
  localStorage.removeItem('porraEmail');
  localStorage.removeItem('playerAlias');
  location.reload();
}

function renderMeta() {
  const deadline = state.meta?.deadline ? new Date(state.meta.deadline) : null;
  document.getElementById('home-deadline').textContent = deadline && !Number.isNaN(deadline.getTime())
    ? deadline.toLocaleDateString('es-ES', {day: '2-digit', month: 'short'})
    : '-';
  document.getElementById('home-lock-state').textContent = state.meta?.locked ? 'cerrado' : 'abierto';
  document.getElementById('home-player-count').textContent = state.meta?.count ?? 0;
  document.body.classList.toggle('locked', Boolean(state.meta?.locked));
}

function setAccessMessage(text, type) {
  const el = document.getElementById('access-message');
  el.textContent = text || '';
  el.className = `form-message ${type || ''}`;
}

function buildGroups() {
  const container = document.getElementById('groups-container');
  container.innerHTML = '';
  GROUP_ORDER.forEach(group => {
    const groupData = GROUPS[group];
    const card = document.createElement('article');
    card.className = 'group-card';
    card.id = `group-card-${group}`;
    card.innerHTML = `
      <div class="group-head">
        <div class="group-letter">${group}</div>
        <div class="group-head-text">
          <h3>${groupData.name}</h3>
          <div class="group-teams">
            ${groupData.teams.map(team => `<span class="group-team">${getTeamFlagImg(team.id, {className: 'flag flag-sm'})}<span>${escapeHtml(team.name)}</span></span>`).join('')}
          </div>
        </div>
      </div>
      <div class="match-list" id="matches-${group}"></div>
      <div class="standings" id="standings-${group}"></div>
    `;
    container.appendChild(card);
    const list = document.getElementById(`matches-${group}`);
    GROUP_FIXTURES[group].forEach((fixture, idx) => {
      const home = TEAMS[fixture.homeId];
      const away = TEAMS[fixture.awayId];
      const matchId = `${group}${idx + 1}`;
      const kickoff = kickoffMeta(matchId);
      const row = document.createElement('div');
      row.className = 'match-row';
      row.innerHTML = `
        <div class="match-meta">
          <span class="match-id">${matchId}</span>
          ${kickoff ? `<time class="match-kickoff" datetime="${kickoff.iso}"><span>${kickoff.day}</span><strong>${kickoff.time}</strong></time>` : '<span class="match-kickoff placeholder">Por confirmar</span>'}
        </div>
        <div class="match-teams">
          <span class="team left">${getTeamFlagImg(fixture.homeId, {className: 'flag'})}<b>${escapeHtml(home.name)}</b></span>
          <div class="score-inputs">
            <input class="editable score-input" type="number" min="0" max="99" inputmode="numeric" data-group="${group}" data-index="${idx}" data-side="home" oninput="setGroupScore(this)">
            <span>-</span>
            <input class="editable score-input" type="number" min="0" max="99" inputmode="numeric" data-group="${group}" data-index="${idx}" data-side="away" oninput="setGroupScore(this)">
          </div>
          <span class="team right"><b>${escapeHtml(away.name)}</b>${getTeamFlagImg(fixture.awayId, {className: 'flag'})}</span>
        </div>
      `;
      list.appendChild(row);
    });
  });
}

function setGroupScore(input) {
  if (state.meta.locked) return;
  const group = input.dataset.group;
  const idx = Number(input.dataset.index);
  const side = input.dataset.side === 'home' ? 'homeGoals' : 'awayGoals';
  const value = sanitizeScoreValue(input.value);
  if (input.value !== '' && value === null) input.value = '';
  state.groupPredictions[group][idx][side] = value;
  renderGroupStandings(group);
  refreshBracket();
  markDirty();
}

function renderGroupStandings(group) {
  const standings = buildGroupStandings(group, state.groupPredictions[group]);
  const el = document.getElementById(`standings-${group}`);
  el.innerHTML = `
    <div class="standing-head"><span>Pos</span><span>Sel.</span><span>Pts</span><span>DG</span><span>GF</span></div>
    ${standings.map((row, index) => `
      <div class="standing-row ${index < 2 ? 'qualified' : index === 2 ? 'third' : ''}">
        <span>${index + 1}</span>
        <span class="standing-team">${getTeamFlagImg(row.team.id, {className: 'flag flag-xs'})}<span>${escapeHtml(row.team.name)}</span></span>
        <span>${row.points}</span>
        <span>${row.gd}</span>
        <span>${row.gf}</span>
      </div>
    `).join('')}
  `;
}

function buildHomeMatches() {
  const container = document.getElementById('home-matches-container');
  if (!container) return;
  if (state.homeMatchView === 'groups') {
    container.innerHTML = GROUP_ORDER.map(group => `
      <div class="home-match-group">
        <h3>Grupo ${group}</h3>
        ${GROUP_FIXTURES[group].map((fixture, index) => {
          const home = TEAMS[fixture.homeId];
          const away = TEAMS[fixture.awayId];
          const matchId = `${group}${index + 1}`;
          const kickoff = kickoffMeta(matchId);
          const prediction = state.groupPredictions?.[group]?.[index] || {};
          const homeGoals = Number.isFinite(prediction.homeGoals) ? prediction.homeGoals : null;
          const awayGoals = Number.isFinite(prediction.awayGoals) ? prediction.awayGoals : null;
          const homeSlot = homeGoals == null ? '<span class="home-match-score placeholder">–</span>' : `<span class="home-match-score">${homeGoals}</span>`;
          const awaySlot = awayGoals == null ? '<span class="home-match-score placeholder">–</span>' : `<span class="home-match-score">${awayGoals}</span>`;
          return `
            <button class="home-match-card" onclick="openMatchPredictions('${matchId}')" type="button">
              <span class="home-match-head">
                <span class="home-match-id">${matchId}</span>
                ${kickoff ? `<time class="home-match-kickoff" datetime="${kickoff.iso}">${kickoff.day} · ${kickoff.time}</time>` : '<span class="home-match-kickoff placeholder">Por confirmar</span>'}
              </span>
              <span class="home-match-body">
                <span class="home-match-team home">${getTeamFlagImg(fixture.homeId, {className: 'flag flag-sm'})}<strong>${escapeHtml(home.name)}</strong></span>
                ${homeSlot}
                <em>vs</em>
                ${awaySlot}
                <span class="home-match-team away"><strong>${escapeHtml(away.name)}</strong>${getTeamFlagImg(fixture.awayId, {className: 'flag flag-sm'})}</span>
              </span>
            </button>
          `;
        }).join('')}
      </div>
    `).join('');
    return;
  }

  const rounds = [
    ['r32', '1/16'],
    ['r16', 'Octavos'],
    ['qf', 'Cuartos'],
    ['sf', 'Semifinales'],
    ['final', 'Final'],
  ];
  container.innerHTML = rounds.map(([round, label]) => `
    <div class="home-match-group">
      <h3>${label}</h3>
      ${BRACKET_BY_ROUND[round].map(match => {
        const kickoff = kickoffMeta(match.id);
        return `
        <button class="home-match-card bracket" onclick="openMatchPredictions('${match.id}')" type="button">
          <span class="home-match-head">
            <span class="home-match-id">${match.id}</span>
            ${kickoff ? `<time class="home-match-kickoff" datetime="${kickoff.iso}">${kickoff.day} · ${kickoff.time}</time>` : ''}
          </span>
          <span class="home-match-body bracket-body">
            <strong>${sourceLabel(match.sources[0])}</strong>
            <em>vs</em>
            <strong>${sourceLabel(match.sources[1])}</strong>
          </span>
        </button>
      `;
      }).join('')}
    </div>
  `).join('');
}

function showHomeMatches(view, btn) {
  state.homeMatchView = view;
  document.querySelectorAll('.mini-tab').forEach(tab => tab.classList.remove('active'));
  if (btn) btn.classList.add('active');
  buildHomeMatches();
}

async function openMatchPredictions(matchId) {
  const modal = document.getElementById('match-modal');
  const title = document.getElementById('match-modal-title');
  const subtitle = document.getElementById('match-modal-subtitle');
  const body = document.getElementById('match-modal-body');
  modal.classList.add('active');
  title.textContent = matchId;
  subtitle.textContent = 'Cargando pronósticos...';
  body.innerHTML = '';
  try {
    const data = await API.getMatchPredictions(matchId);
    renderMatchPredictionModal(data);
  } catch (err) {
    console.error('match predictions failed', err);
    subtitle.textContent = 'No se pudieron cargar los pronósticos.';
  }
}

function renderMatchPredictionModal(data) {
  const title = document.getElementById('match-modal-title');
  const subtitle = document.getElementById('match-modal-subtitle');
  const body = document.getElementById('match-modal-body');
  if (data.type === 'group') {
    title.textContent = `${data.matchId} · ${getTeamFlag(data.homeId)} ${getTeamName(data.homeId)} vs ${getTeamFlag(data.awayId)} ${getTeamName(data.awayId)}`;
    subtitle.textContent = `${data.predictions.length} pronósticos registrados`;
    body.innerHTML = data.predictions.map(item => `
      <div class="prediction-row">
        <span>${escapeHtml(item.player)}</span>
        <strong>${item.complete ? `${item.homeGoals} - ${item.awayGoals}` : 'sin marcador'}</strong>
      </div>
    `).join('') || '<div class="empty-state">Aún no hay pronósticos para este partido.</div>';
    return;
  }

  title.textContent = `${data.matchId} · ${roundLabel(data.round)}`;
  subtitle.textContent = `${data.predictions.length} pronósticos registrados`;
  body.innerHTML = data.predictions.map(item => `
    <div class="prediction-row bracket">
      <span>${escapeHtml(item.player)}</span>
      <div>
        <small>${formatSlotName(item.slots?.[0], data.sourceLabels?.[0])} vs ${formatSlotName(item.slots?.[1], data.sourceLabels?.[1])}</small>
        <strong>${item.winnerId ? `${getTeamFlag(item.winnerId)} ${escapeHtml(item.winnerName)}` : 'sin ganador'}</strong>
      </div>
    </div>
  `).join('') || '<div class="empty-state">Aún no hay pronósticos para este partido.</div>';
}

function closeMatchModal(event) {
  if (event && event.target !== document.getElementById('match-modal')) return;
  document.getElementById('match-modal').classList.remove('active');
}

function formatSlotName(teamId, fallback) {
  return teamId ? `${getTeamFlag(teamId)} ${getTeamName(teamId)}` : (fallback || '-');
}

function roundLabel(round) {
  return ({r32: '1/16 de final', r16: 'Octavos', qf: 'Cuartos', sf: 'Semifinales', final: 'Final'})[round] || round;
}

function buildBracket() {
  const container = document.getElementById('bracket-container');
  const rounds = [
    ['r32', '1/16 de final'],
    ['r16', 'Octavos'],
    ['qf', 'Cuartos'],
    ['sf', 'Semifinales'],
    ['final', 'Final'],
  ];
  container.innerHTML = rounds.map(([round, label]) => `
    <section class="round-block">
      <h3>${label}</h3>
      <div class="round-grid round-${round}" id="round-${round}"></div>
    </section>
  `).join('');

  rounds.forEach(([round]) => {
    const grid = document.getElementById(`round-${round}`);
    BRACKET_BY_ROUND[round].forEach(match => {
      const kickoff = kickoffMeta(match.id);
      const card = document.createElement('article');
      card.className = 'bracket-card';
      card.id = `match-${match.id}`;
      card.innerHTML = `
        <div class="bracket-head">
          <span class="match-id">${match.id}</span>
          ${kickoff ? `<time class="match-kickoff" datetime="${kickoff.iso}"><span>${kickoff.day}</span><strong>${kickoff.time}</strong></time>` : ''}
        </div>
        <div class="bracket-teams">
          <div class="slot" id="slot-${match.id}-0">-</div>
          <div class="bracket-score">
            <input class="editable score-input" type="number" min="0" max="99" inputmode="numeric" id="bracket-score-${match.id}-home" data-match="${match.id}" data-side="home" oninput="onBracketScore(this)">
            <span>-</span>
            <input class="editable score-input" type="number" min="0" max="99" inputmode="numeric" id="bracket-score-${match.id}-away" data-match="${match.id}" data-side="away" oninput="onBracketScore(this)">
          </div>
          <div class="slot" id="slot-${match.id}-1">-</div>
        </div>
        <select class="editable winner-select" id="winner-${match.id}" onchange="onWinnerSelect('${match.id}')"></select>
      `;
      grid.appendChild(card);
    });
  });
}

function onBracketScore(input) {
  if (state.meta.locked) return;
  const matchId = input.dataset.match;
  const side = input.dataset.side === 'home' ? 'homeGoals' : 'awayGoals';
  const value = sanitizeScoreValue(input.value);
  if (input.value !== '' && value === null) input.value = '';
  const current = state.bracketScores[matchId] || {homeGoals: null, awayGoals: null};
  state.bracketScores[matchId] = {...current, [side]: value};
  markDirty();
}

function refreshBracket() {
  for (let pass = 0; pass < 6; pass += 1) {
    const resolved = resolveBracketMatches(state.groupPredictions, state.bracketWinners);
    let changed = false;
    BRACKET_MATCHES.forEach(match => {
      const slots = (resolved.matches[match.id]?.slots || []).filter(Boolean);
      const winner = state.bracketWinners[match.id];
      if (winner && !slots.includes(winner)) {
        delete state.bracketWinners[match.id];
        changed = true;
      }
    });
    if (!changed) break;
  }

  const resolved = resolveBracketMatches(state.groupPredictions, state.bracketWinners);
  renderThirdSummary(resolved);
  BRACKET_MATCHES.forEach(match => {
    const item = resolved.matches[match.id];
    const slots = item?.slots || [];
    slots.forEach((teamId, index) => {
      const slot = document.getElementById(`slot-${match.id}-${index}`);
      if (!slot) return;
      slot.innerHTML = teamId
        ? `${getTeamFlagImg(teamId, {className: 'flag flag-sm'})} <span>${escapeHtml(getTeamName(teamId))}</span>`
        : `<span>${escapeHtml(sourceLabel(match.sources[index]))}</span>`;
      slot.classList.toggle('empty', !teamId);
    });

    const select = document.getElementById(`winner-${match.id}`);
    const current = state.bracketWinners[match.id] || '';
    const options = slots.filter(Boolean);
    select.innerHTML = `<option value="">Ganador</option>${options.map(teamId => `<option value="${teamId}">${getTeamFlag(teamId)} ${escapeHtml(getTeamName(teamId))}</option>`).join('')}`;
    select.value = options.includes(current) ? current : '';
    select.disabled = state.meta.locked || options.length < 2;
    document.getElementById(`match-${match.id}`).classList.toggle('invalid', match.id === 'M104' && current && !options.includes(current));

    const score = state.bracketScores[match.id] || {homeGoals: null, awayGoals: null};
    const homeInput = document.getElementById(`bracket-score-${match.id}-home`);
    const awayInput = document.getElementById(`bracket-score-${match.id}-away`);
    if (homeInput && awayInput) {
      homeInput.value = score.homeGoals ?? '';
      awayInput.value = score.awayGoals ?? '';
      const ready = options.length === 2 && !state.meta.locked;
      homeInput.disabled = !ready;
      awayInput.disabled = !ready;
    }
  });
}

function sourceLabel(source) {
  if (!source) return '-';
  return source.label || '-';
}

function renderThirdSummary(resolved) {
  const el = document.getElementById('third-summary');
  const top = resolved.thirdRank.slice(0, 8);
  el.innerHTML = `
    <div>
      <strong>Mejores terceros</strong>
      <span>${top.map(row => `${row.thirdGroup}: ${getTeamFlagImg(row.teamId, {className: 'flag flag-xs'})} ${escapeHtml(getTeamName(row.teamId))}`).join(' · ') || '-'}</span>
    </div>
  `;
}

function onWinnerSelect(matchId) {
  if (state.meta.locked) return;
  const value = document.getElementById(`winner-${matchId}`).value;
  if (value) state.bracketWinners[matchId] = value;
  else delete state.bracketWinners[matchId];
  refreshBracket();
  markDirty();
}

function buildSpecialSelects() {
  const teamOptions = `<option value="">Selecciona selección</option>${TEAM_IDS.map(id => `<option value="${id}">${getTeamFlag(id)} ${escapeHtml(getTeamName(id))}</option>`).join('')}`;
  document.getElementById('top-scorer-team').innerHTML = teamOptions;
  document.getElementById('player-team-filter').innerHTML = `<option value="">Todas las selecciones</option>${TEAM_IDS.map(id => `<option value="${id}">${getTeamFlag(id)} ${escapeHtml(getTeamName(id))}</option>`).join('')}`;
}

function renderPlayerOptions() {
  const select = document.getElementById('top-scorer-player-id');
  const status = document.getElementById('players-status');
  const teamFilter = document.getElementById('player-team-filter')?.value || '';
  const query = normalizeInput(document.getElementById('player-search')?.value || '');

  if (!state.players.length) {
    select.innerHTML = '<option value="">Sin jugadores disponibles</option>';
    select.disabled = true;
    status.textContent = 'La base de jugadores se sincroniza con 365scores. Vuelve a intentarlo en unos minutos.';
    renderSelectedPlayer();
    return;
  }

  const filtered = state.players.filter(player => {
    if (player.active === false) return false;
    if (teamFilter && player.teamId !== teamFilter) return false;
    if (query && !normalizeInput(`${player.name} ${getTeamName(player.teamId)} ${player.club || ''}`).includes(query)) return false;
    return true;
  }).slice(0, 300);

  select.disabled = state.meta.locked;
  const optionHtml = filtered.map(player => `<option value="${player.id}">${escapeHtml(player.name)} · ${getTeamName(player.teamId)}${player.club ? ` — ${escapeHtml(player.club)}` : ''}</option>`).join('');
  const placeholder = `<option value="">${filtered.length ? 'Elige jugador…' : 'Sin coincidencias con el filtro'}</option>`;
  let html = placeholder + optionHtml;
  if (state.topScorerPlayerId && !filtered.some(player => player.id === state.topScorerPlayerId)) {
    const selected = state.players.find(player => player.id === state.topScorerPlayerId);
    if (selected) {
      html = `<option value="${selected.id}">${escapeHtml(selected.name)} · ${getTeamName(selected.teamId)}${selected.club ? ` — ${escapeHtml(selected.club)}` : ''}</option>` + html;
    }
  }
  select.innerHTML = html;
  select.value = state.topScorerPlayerId || '';

  const total = state.players.filter(p => p.active !== false).length;
  status.textContent = `${filtered.length} de ${total} jugadores visibles`;
  renderSelectedPlayer();
}

function renderSelectedPlayer() {
  const target = document.getElementById('player-selected');
  if (!target) return;
  const player = state.players.find(p => p.id === state.topScorerPlayerId);
  if (!player) {
    target.innerHTML = '<span class="player-selected-empty">Aún no has elegido jugador.</span>';
    return;
  }
  target.innerHTML = `
    ${getTeamFlagImg(player.teamId, {className: 'flag flag-md'})}
    <div class="player-selected-text">
      <strong>${escapeHtml(player.name)}</strong>
      <span>${escapeHtml(getTeamName(player.teamId))}${player.club ? ` · ${escapeHtml(player.club)}` : ''}${player.position ? ` · ${escapeHtml(player.position)}` : ''}</span>
    </div>
  `;
}

function onSpecialChange() {
  if (state.meta.locked) return;
  state.topScorerTeam = document.getElementById('top-scorer-team').value;
  markDirty();
}

function onPlayerSelect() {
  if (state.meta.locked) return;
  state.topScorerPlayerId = document.getElementById('top-scorer-player-id').value;
  renderSelectedPlayer();
  markDirty();
}

function applyPorra(porra) {
  state.porraId = porra.id || state.porraId;
  state.email = porra.email || state.email;
  state.player = porra.player || state.player;
  state.groupPredictions = normalizeGroupPredictions(porra.groupPredictions);
  state.bracketWinners = {...(porra.bracketWinners || {})};
  state.bracketScores = normalizeBracketScores(porra.bracketScores);
  state.topScorerTeam = porra.topScorerTeam || '';
  state.topScorerPlayerId = porra.topScorerPlayerId || '';
  document.getElementById('active-player').textContent = state.player || '-';
  syncFormFromState();
  markSaved(porra.updatedAt);
}

function normalizeBracketScores(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  Object.entries(input).forEach(([matchId, value]) => {
    if (!value || typeof value !== 'object') return;
    const homeGoals = sanitizeScoreValue(value.homeGoals);
    const awayGoals = sanitizeScoreValue(value.awayGoals);
    out[String(matchId).toUpperCase()] = {homeGoals, awayGoals};
  });
  return out;
}

function syncFormFromState() {
  GROUP_ORDER.forEach(group => {
    GROUP_FIXTURES[group].forEach((fixture, idx) => {
      const score = state.groupPredictions[group][idx];
      const home = document.querySelector(`[data-group="${group}"][data-index="${idx}"][data-side="home"]`);
      const away = document.querySelector(`[data-group="${group}"][data-index="${idx}"][data-side="away"]`);
      if (home) home.value = score.homeGoals ?? '';
      if (away) away.value = score.awayGoals ?? '';
    });
    renderGroupStandings(group);
  });
  document.getElementById('top-scorer-team').value = state.topScorerTeam;
  renderPlayerOptions();
  refreshBracket();
  updateProgress();
  updateScorePanel();
  applyLockState();
}

function collectPorra() {
  return {
    player: state.player,
    groupPredictions: state.groupPredictions,
    bracketWinners: state.bracketWinners,
    bracketScores: state.bracketScores,
    topScorerTeam: state.topScorerTeam,
    topScorerPlayerId: state.topScorerPlayerId,
  };
}

function markDirty() {
  updateProgress();
  if (!state.autosaveReady || state.meta.locked) return;
  setSaveStatus('pending', 'editando');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, 800);
}

async function doSave() {
  if (state.meta.locked || !state.accessToken) {
    setSaveStatus('error', state.meta.locked ? 'plazo cerrado' : 'sin acceso');
    return false;
  }
  if (saveInFlight) {
    saveTimer = setTimeout(doSave, 300);
    return false;
  }
  saveInFlight = true;
  setSaveStatus('pending', 'guardando...');
  try {
    const res = await API.savePorra(collectPorra(), state.accessToken);
    markSaved(res?.updatedAt);
    await refreshRanking();
    return true;
  } catch (err) {
    console.error('save failed', err);
    if (err.status === 423) {
      state.meta.locked = true;
      applyLockState();
      setSaveStatus('error', 'plazo cerrado');
    } else {
      setSaveStatus('error', 'sin conexion');
    }
    return false;
  } finally {
    saveInFlight = false;
  }
}

function forceSave() {
  if (state.meta.locked) {
    setSaveStatus('error', 'plazo cerrado');
    showToast('Plazo cerrado');
    return;
  }
  clearTimeout(saveTimer);
  doSave().then(saved => { if (saved) showToast('Porra guardada'); });
}

function setSaveStatus(kind, text) {
  if (kind !== 'ok' && saveTicker) {
    clearInterval(saveTicker);
    saveTicker = null;
  }
  const el = document.getElementById('save-status');
  if (!el) return;
  el.className = kind || '';
  el.textContent = text || '';
}

function markSaved(value) {
  const parsed = value ? new Date(value) : new Date();
  lastSavedAt = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  updateRelativeSaveStatus();
  if (saveTicker) clearInterval(saveTicker);
  saveTicker = setInterval(updateRelativeSaveStatus, 5000);
}

function updateRelativeSaveStatus() {
  if (!lastSavedAt) return;
  const diff = Math.max(0, Math.floor((Date.now() - lastSavedAt.getTime()) / 1000));
  let label = `${diff}s`;
  if (diff >= 3600) label = `${Math.floor(diff / 3600)}h`;
  else if (diff >= 60) label = `${Math.floor(diff / 60)}m`;
  setSaveStatus('ok', `guardado hace ${label}`);
}

function updateProgress() {
  let done = 0;
  let total = 0;
  GROUP_ORDER.forEach(group => {
    state.groupPredictions[group].forEach(score => {
      total += 1;
      if (isScoreComplete(score)) done += 1;
    });
  });
  BRACKET_MATCHES.forEach(match => {
    total += 1;
    if (state.bracketWinners[match.id]) done += 1;
  });
  total += 2;
  if (state.topScorerTeam) done += 1;
  if (state.topScorerPlayerId) done += 1;
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('progress-text').textContent = `${pct}%`;
  document.getElementById('progress-fill').style.width = `${pct}%`;
}

function updateScorePanel() {
  document.getElementById('score-total').textContent = state.score || 0;
}

async function refreshRanking() {
  try {
    const [ranking, meta] = await Promise.all([API.getRanking(), API.getMeta()]);
    if (meta) {
      state.meta = meta;
      renderMeta();
      applyLockState();
    }
    const mine = Array.isArray(ranking) ? ranking.find(row => row.id === state.porraId) : null;
    state.score = mine?.total || 0;
    updateScorePanel();
    renderRanking('ranking-container', ranking || []);
    renderRanking('ranking-container-game', ranking || []);
    const updated = meta?.lastScrape?.at ? new Date(meta.lastScrape.at).toLocaleString('es-ES') : 'sin resultados reales';
    setText('ranking-info', `Actualización: ${updated}`);
    setText('ranking-info-game', `Actualización: ${updated}`);
  } catch (err) {
    console.error('ranking failed', err);
    setText('ranking-info', 'No se pudo cargar el ranking.');
    setText('ranking-info-game', 'No se pudo cargar el ranking.');
  }
}

function renderRanking(containerId, ranking) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!ranking.length) {
    container.innerHTML = '<div class="empty-state">Aún no hay participantes en ranking.</div>';
    return;
  }
  container.innerHTML = ranking.map((row, index) => `
    <div class="rank-row ${row.id === state.porraId ? 'me' : ''}">
      <span class="rank-pos">${index + 1}</span>
      <span class="rank-player">${escapeHtml(row.player || '-')}</span>
      <span class="rank-total">${row.total}</span>
    </div>
  `).join('');
}

function showStep(name, btn) {
  document.querySelectorAll('.step-panel').forEach(panel => panel.classList.remove('active'));
  document.querySelectorAll('.step-btn').forEach(button => button.classList.remove('active'));
  document.getElementById(`step-${name}`).classList.add('active');
  if (btn) btn.classList.add('active');
  if (name === 'ranking') refreshRanking();
  if (name === 'bracket') refreshBracket();
}

function renderAll() {
  syncFormFromState();
  refreshRanking();
}

function applyLockState() {
  const locked = Boolean(state.meta?.locked);
  document.body.classList.toggle('locked', locked);
  document.querySelectorAll('.editable').forEach(el => { el.disabled = locked || el.dataset.forceDisabled === 'true'; });
  if (locked) setSaveStatus('error', 'plazo cerrado');
}

function exportPorra() {
  const data = collectPorra();
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `porra_${(state.player || 'jugador').replace(/\s+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function normalizeInput(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

window.loginUser = loginUser;
window.returnHome = returnHome;
window.logoutUser = logoutUser;
window.setGroupScore = setGroupScore;
window.onWinnerSelect = onWinnerSelect;
window.onBracketScore = onBracketScore;
window.onSpecialChange = onSpecialChange;
window.onPlayerSelect = onPlayerSelect;
window.renderPlayerOptions = renderPlayerOptions;
window.showHomeMatches = showHomeMatches;
window.openMatchPredictions = openMatchPredictions;
window.closeMatchModal = closeMatchModal;
window.forceSave = forceSave;
window.exportPorra = exportPorra;
window.refreshRanking = refreshRanking;
window.showStep = showStep;
window.onload = init;

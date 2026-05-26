/* ═══════════════════════════════════════════════════════
   PORRA MUNDIAL 2026 — CLIENT APP
   Globals from fixtures.js: GROUPS, ALL_TEAMS, GROUP_FIXTURES, R32, R16, QF, SF
   Globals from api.js: API
═══════════════════════════════════════════════════════ */

/* ESTADO: resultados de grupos indexed [grp][matchIdx] = '1'|'x'|'2'|null */
const groupResults = {};
Object.keys(GROUPS).forEach(g=>{groupResults[g]=Array(6).fill(null);});

/* Ganadores de cada partido eliminatorio */
const bracketWinners = {};

/* Identidad y meta */
let porraId = null;
let meta = {locked:false, deadline:null};
let autosaveReady = false;

/* ═════════════════════════════════════════
   BUILD GROUPS UI
═════════════════════════════════════════ */
function buildGroups(){
  const cont=document.getElementById('groups-container');
  Object.entries(GROUPS).forEach(([g,{name,teams,flags}])=>{
    const fixtures=GROUP_FIXTURES[g];
    const card=document.createElement('div');
    card.className='group-card';
    card.innerHTML=`
      <div class="group-header">
        <span class="group-letter">${g}</span>
        <div><div style="font-size:0.75rem;font-weight:600;">${name}</div><div class="group-subinfo">${teams.map((t,i)=>flags[i]+' '+t).join(' · ')}</div></div>
      </div>
      <div class="group-body" id="gb-${g}"></div>`;
    cont.appendChild(card);
    const body=document.getElementById(`gb-${g}`);
    let curJ=0;
    fixtures.forEach((fx,idx)=>{
      if(fx.j!==curJ){
        curJ=fx.j;
        const jlbl=document.createElement('div');
        jlbl.className='jornada-label';
        jlbl.textContent=`Jornada ${curJ}`;
        body.appendChild(jlbl);
      }
      const row=document.createElement('div');
      row.className='match-row';
      row.innerHTML=`
        <span class="team-name"><span style="margin-right:3px">${flags[fx.home]}</span>${teams[fx.home]}</span>
        <span class="match-date">${fx.d}</span>
        <div class="result-btns">
          <button class="result-btn" data-g="${g}" data-i="${idx}" data-r="1" onclick="setResult(this)">1</button>
          <button class="result-btn" data-g="${g}" data-i="${idx}" data-r="x" onclick="setResult(this)">X</button>
          <button class="result-btn" data-g="${g}" data-i="${idx}" data-r="2" onclick="setResult(this)">2</button>
        </div>
        <span class="team-name right">${teams[fx.away]}<span style="margin-left:3px">${flags[fx.away]}</span></span>`;
      body.appendChild(row);
    });
  });
}

/* ═════════════════════════════════════════
   ESTIMAR POSICIÓN EN GRUPO (basado en 1X2, sin diferencia de goles)
═════════════════════════════════════════ */
function estimateGroupOrder(g){
  const teams=GROUPS[g].teams;
  const pts=[0,0,0,0];
  GROUP_FIXTURES[g].forEach((fx,idx)=>{
    const r=groupResults[g][idx];
    if(r==='1') pts[fx.home]+=3;
    else if(r==='x'){pts[fx.home]+=1;pts[fx.away]+=1;}
    else if(r==='2') pts[fx.away]+=3;
  });
  const order=[0,1,2,3].sort((a,b)=>pts[b]-pts[a]);
  return order.map(i=>({team:teams[i],pts:pts[i],idx:i}));
}

function getGroupPos(g,pos){
  const order=estimateGroupOrder(g);
  const item=order[pos-1];
  return item?item.team:'';
}

/* ═════════════════════════════════════════
   BUILD BRACKET UI
═════════════════════════════════════════ */
function buildBracketMatch(m, containerId){
  const cont=document.getElementById(containerId);
  const div=document.createElement('div');
  div.className='bm';
  div.id=`bm-${m.id}`;
  div.innerHTML=`
    <div class="bm-label">${m.lbl}</div>
    <div class="bm-sub">${m.sl1||''} vs ${m.sl2||''}</div>
    <div class="bm-slot" id="slot-${m.id}-1">
      <span class="bm-slot-lbl">1</span>
      <span class="bm-slot-auto" id="auto-${m.id}-1">—</span>
    </div>
    <div class="bm-slot winner" id="slot-${m.id}-w">
      <span class="bm-slot-lbl">🏅</span>
      <select id="sel-${m.id}-w" onchange="onWinnerSelect('${m.id}')">
        <option value="">— Ganador —</option>
        ${ALL_TEAMS.map(t=>`<option value="${t}">${t}</option>`).join('')}
      </select>
    </div>
    <div class="bm-slot" id="slot-${m.id}-2">
      <span class="bm-slot-lbl">2</span>
      <span class="bm-slot-auto" id="auto-${m.id}-2">—</span>
    </div>`;
  cont.appendChild(div);
}

function buildGenericMatch(m, containerId){
  const cont=document.getElementById(containerId);
  const div=document.createElement('div');
  div.className='bm';
  div.id=`bm-${m.id}`;
  div.innerHTML=`
    <div class="bm-label">${m.lbl}</div>
    <div class="bm-sub">${m.sub}</div>
    <div class="bm-slot" id="slot-${m.id}-1">
      <span class="bm-slot-lbl">1</span>
      <span class="bm-slot-auto" id="auto-${m.id}-1">—</span>
    </div>
    <div class="bm-slot winner">
      <span class="bm-slot-lbl">🏅</span>
      <select id="sel-${m.id}-w" onchange="onWinnerSelect('${m.id}')">
        <option value="">— Ganador —</option>
        ${ALL_TEAMS.map(t=>`<option value="${t}">${t}</option>`).join('')}
      </select>
    </div>
    <div class="bm-slot" id="slot-${m.id}-2">
      <span class="bm-slot-lbl">2</span>
      <span class="bm-slot-auto" id="auto-${m.id}-2">—</span>
    </div>`;
  cont.appendChild(div);
}

function buildAllBrackets(){
  R32.forEach(m=>buildBracketMatch(m,'br-r32'));
  R16.forEach(m=>buildGenericMatch(m,'br-r16'));
  QF.forEach(m=>buildGenericMatch(m,'br-qf'));
  SF.forEach(m=>buildGenericMatch(m,'br-sf'));

  ['finalist1','finalist2','champion','top-scorer-team','best-defense-team'].forEach(id=>{
    const sel=document.getElementById(id);
    if(sel) sel.innerHTML='<option value="">— Selecciona —</option>'+ALL_TEAMS.map(t=>`<option value="${t}">${t}</option>`).join('');
  });
}

/* ═════════════════════════════════════════
   AUTO-FILL BRACKET FROM GROUP RESULTS
═════════════════════════════════════════ */
function refreshBracketAuto(){
  R32.forEach(m=>{
    const t1=m.g1?getGroupPos(m.g1,m.p1):'';
    const t2=m.g2?getGroupPos(m.g2,m.p2):'Mejor 3º';
    const el1=document.getElementById(`auto-${m.id}-1`);
    const el2=document.getElementById(`auto-${m.id}-2`);
    if(el1){el1.textContent=t1||'—';el1.classList.toggle('filled',!!t1);}
    if(el2){el2.textContent=t2||'—';el2.classList.toggle('filled',!!t2);}
    const sel=document.getElementById(`sel-${m.id}-w`);
    if(sel){
      const prev=sel.value;
      sel.innerHTML='<option value="">— Ganador —</option>';
      if(t1)sel.innerHTML+=`<option value="${t1}">${t1}</option>`;
      if(t2&&t2!=='Mejor 3º')sel.innerHTML+=`<option value="${t2}">${t2}</option>`;
      else sel.innerHTML+=ALL_TEAMS.filter(t=>t!==t1).map(t=>`<option value="${t}">${t}</option>`).join('');
      if(prev)sel.value=prev;
    }
  });

  const r32W=R32.map(m=>bracketWinners[m.id]||'');
  R16.forEach((m,i)=>{
    const w1=r32W[i*2]||'';
    const w2=r32W[i*2+1]||'';
    const el1=document.getElementById(`auto-${m.id}-1`);
    const el2=document.getElementById(`auto-${m.id}-2`);
    if(el1){el1.textContent=w1||'—';el1.classList.toggle('filled',!!w1);}
    if(el2){el2.textContent=w2||'—';el2.classList.toggle('filled',!!w2);}
    const sel=document.getElementById(`sel-${m.id}-w`);
    if(sel){
      const prev=sel.value;
      sel.innerHTML='<option value="">— Ganador —</option>';
      [w1,w2].filter(Boolean).forEach(t=>sel.innerHTML+=`<option value="${t}">${t}</option>`);
      if(!w1&&!w2)sel.innerHTML+= ALL_TEAMS.map(t=>`<option value="${t}">${t}</option>`).join('');
      if(prev)sel.value=prev;
    }
  });

  const r16W=R16.map(m=>bracketWinners[m.id]||'');
  QF.forEach((m,i)=>{
    const w1=r16W[i*2]||''; const w2=r16W[i*2+1]||'';
    const el1=document.getElementById(`auto-${m.id}-1`);
    const el2=document.getElementById(`auto-${m.id}-2`);
    if(el1){el1.textContent=w1||'—';el1.classList.toggle('filled',!!w1);}
    if(el2){el2.textContent=w2||'—';el2.classList.toggle('filled',!!w2);}
    const sel=document.getElementById(`sel-${m.id}-w`);
    if(sel){
      const prev=sel.value;
      sel.innerHTML='<option value="">— Ganador —</option>';
      [w1,w2].filter(Boolean).forEach(t=>sel.innerHTML+=`<option value="${t}">${t}</option>`);
      if(!w1&&!w2)sel.innerHTML+=ALL_TEAMS.map(t=>`<option value="${t}">${t}</option>`).join('');
      if(prev)sel.value=prev;
    }
  });

  const qfW=QF.map(m=>bracketWinners[m.id]||'');
  SF.forEach((m,i)=>{
    const w1=qfW[i*2]||''; const w2=qfW[i*2+1]||'';
    const el1=document.getElementById(`auto-${m.id}-1`);
    const el2=document.getElementById(`auto-${m.id}-2`);
    if(el1){el1.textContent=w1||'—';el1.classList.toggle('filled',!!w1);}
    if(el2){el2.textContent=w2||'—';el2.classList.toggle('filled',!!w2);}
    const sel=document.getElementById(`sel-${m.id}-w`);
    if(sel){
      const prev=sel.value;
      sel.innerHTML='<option value="">— Ganador —</option>';
      [w1,w2].filter(Boolean).forEach(t=>sel.innerHTML+=`<option value="${t}">${t}</option>`);
      if(!w1&&!w2)sel.innerHTML+=ALL_TEAMS.map(t=>`<option value="${t}">${t}</option>`).join('');
      if(prev)sel.value=prev;
    }
  });

  ['finalist1','finalist2','champion'].forEach(id=>{
    const sel=document.getElementById(id);
    if(!sel)return;
    const prev=sel.value;
    sel.innerHTML='<option value="">— Selecciona —</option>'+ALL_TEAMS.map(t=>`<option value="${t}">${t}</option>`).join('');
    if(prev)sel.value=prev;
  });
}

/* ═════════════════════════════════════════
   INTERACTIONS
═════════════════════════════════════════ */
function setResult(btn){
  if(meta.locked)return;
  const g=btn.dataset.g,i=parseInt(btn.dataset.i),r=btn.dataset.r;
  // toggle: si vuelves a pulsar el mismo, lo deselecciona
  if(groupResults[g][i]===r){
    groupResults[g][i]=null;
    document.querySelectorAll(`[data-g="${g}"][data-i="${i}"]`).forEach(b=>b.classList.remove('active-1','active-x','active-2'));
  } else {
    groupResults[g][i]=r;
    document.querySelectorAll(`[data-g="${g}"][data-i="${i}"]`).forEach(b=>{
      b.classList.remove('active-1','active-x','active-2');
      if(b.dataset.r===r)b.classList.add(`active-${r}`);
    });
  }
  refreshBracketAuto();
  calcTotal();
  updateProgress();
  updatePtsTab();
  scheduleSave();
}

function onWinnerSelect(matchId){
  if(meta.locked)return;
  const sel=document.getElementById(`sel-${matchId}-w`);
  if(sel&&sel.value)bracketWinners[matchId]=sel.value;
  else delete bracketWinners[matchId];
  refreshBracketAuto();
  calcTotal();
  updateProgress();
  updatePtsTab();
  scheduleSave();
}

function showTab(name,btn){
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  btn.classList.add('active');
  if(name==='puntuacion')updatePtsTab();
  if(name==='cuadro')refreshBracketAuto();
  if(name==='ranking')refreshRanking();
}

function updatePlayerDisplay(){
  const n=document.getElementById('player-name').value.trim();
  document.getElementById('display-player').textContent=n||'—';
  document.getElementById('pts-player-name-big').textContent=n||'— Introduce tu nombre —';
  scheduleSave();
}

/* ═════════════════════════════════════════
   SCORING (estimación cliente — server-side hace lo mismo con resultados reales)
═════════════════════════════════════════ */
function getScoreBreakdown(){
  const bd={grupos:0,r32:0,r16:0,qf:0,sf:0,finalists:0,champion:0};
  Object.keys(GROUPS).forEach(g=>{
    groupResults[g].forEach(r=>{if(r)bd.grupos++;});
  });
  const cw=(matches,key,pts)=>matches.forEach(m=>{const w=bracketWinners[m.id];if(w)bd[key]+=pts;});
  cw(R32,'r32',2); cw(R16,'r16',3); cw(QF,'qf',4); cw(SF,'sf',6);
  if(document.getElementById('finalist1')?.value)bd.finalists+=8;
  if(document.getElementById('finalist2')?.value)bd.finalists+=8;
  if(document.getElementById('champion')?.value)bd.champion+=10;
  bd.total=Object.values(bd).reduce((a,b)=>a+b,0);
  return bd;
}

function calcTotal(){
  const bd=getScoreBreakdown();
  document.getElementById('total-pts-panel').textContent=bd.total;
  document.getElementById('pts-total-big').textContent=bd.total;
  const rows=[['Grupos',bd.grupos],['1/16',bd.r32],['Octavos',bd.r16],['Cuartos',bd.qf],['Semis',bd.sf],['Final',bd.finalists],['Campeón',bd.champion]];
  document.getElementById('score-breakdown').innerHTML=rows.filter(([,v])=>v>0)
    .map(([k,v])=>`<div class="score-breakdown-row"><span>${k}</span><span>+${v}</span></div>`).join('');
  validateChampion();
  if(autosaveReady){
    updateProgress();
    updatePtsTab();
    scheduleSave();
  }
}

function validateChampion(){
  const f1=document.getElementById('finalist1')?.value||'';
  const f2=document.getElementById('finalist2')?.value||'';
  const champ=document.getElementById('champion');
  if(!champ)return true;
  const invalid=!!(champ.value&&f1&&f2&&champ.value!==f1&&champ.value!==f2);
  const card=champ.closest('.final-card');
  champ.classList.toggle('invalid',invalid);
  champ.setAttribute('aria-invalid',invalid?'true':'false');
  champ.title=invalid?'El campeón debe ser uno de los finalistas.':'';
  if(card)card.classList.toggle('invalid',invalid);
  return !invalid;
}

function updatePtsTab(){
  const bd=getScoreBreakdown();
  document.getElementById('pts-total-big').textContent=bd.total;
  const groupFilled=Object.values(groupResults).flat().filter(Boolean).length;
  const groupTotal=Object.keys(GROUPS).length*6;
  const r32filled=R32.filter(m=>bracketWinners[m.id]).length;
  const r16filled=R16.filter(m=>bracketWinners[m.id]).length;
  const qffilled=QF.filter(m=>bracketWinners[m.id]).length;
  const sffilled=SF.filter(m=>bracketWinners[m.id]).length;
  const tsTeam=document.getElementById('top-scorer-team')?.value||'';
  const bdTeam=document.getElementById('best-defense-team')?.value||'';
  const tsPlayer=document.getElementById('top-scorer-player')?.value?.trim()||'';

  document.getElementById('pts-breakdown-cards').innerHTML=[
    {icon:'⚽',title:'Fase de Grupos',pts:bd.grupos,rows:[
      ['Partidos pronosticados',`${groupFilled} / ${groupTotal}`],
      ['Puntos (1 pt/acierto)',`${bd.grupos} pts`],
    ]},
    {icon:'🗓️',title:'1/16 de Final',pts:bd.r32,rows:[
      ['Ganadores elegidos',`${r32filled} / 16`],
      ['Puntos (2 pts/eq.)',`${bd.r32} pts`],
    ]},
    {icon:'🏟️',title:'Octavos → Semis',pts:bd.r16+bd.qf+bd.sf,rows:[
      ['Octavos (3 pts)',`${bd.r16} pts · ${r16filled}/8`],
      ['Cuartos (4 pts)',`${bd.qf} pts · ${qffilled}/4`],
      ['Semis (6 pts)',`${bd.sf} pts · ${sffilled}/2`],
    ]},
    {icon:'🏆',title:'Final & Campeón',pts:bd.finalists+bd.champion,rows:[
      ['Finalista 1 (8)',document.getElementById('finalist1')?.value||'—'],
      ['Finalista 2 (8)',document.getElementById('finalist2')?.value||'—'],
      ['Campeón (10)',document.getElementById('champion')?.value||'—'],
    ]},
    {icon:'⭐',title:'Especiales',pts:'?',rows:[
      ['Más goleadora',tsTeam||'—'],
      ['Menos goleada',bdTeam||'—'],
      ['Máx. goleador',tsPlayer||'—'],
      ['Puntos','1 pto/gol (tras torneo)'],
    ]},
  ].map(c=>`<div class="pts-card">
    <div class="pts-card-header">
      <span class="pts-card-icon">${c.icon}</span>
      <span class="pts-card-title">${c.title}</span>
      <span class="pts-card-value">${c.pts}</span>
    </div>
    <div class="pts-card-rows">
      ${c.rows.map(([k,v])=>`<div class="pts-card-row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
    </div>
  </div>`).join('');
}

function updateProgress(){
  let f=0,t=0;
  Object.values(groupResults).flat().forEach(r=>{t++;if(r)f++;});
  [...R32,...R16,...QF,...SF].forEach(m=>{t++;if(bracketWinners[m.id])f++;});
  ['finalist1','finalist2','champion','top-scorer-team','best-defense-team'].forEach(id=>{
    t++;const el=document.getElementById(id);if(el&&el.value)f++;
  });
  t++;if(document.getElementById('top-scorer-player')?.value?.trim())f++;
  const pct=t?Math.round(f/t*100):0;
  document.getElementById('prog-fill').style.width=pct+'%';
  document.getElementById('prog-text').textContent=`${f} / ${t} (${pct}%)`;
}

/* ═════════════════════════════════════════
   SUMMARY MODAL
═════════════════════════════════════════ */
function showSummary(){
  const player=document.getElementById('player-name').value.trim()||'Sin nombre';
  const bd=getScoreBreakdown();
  const gf=Object.values(groupResults).flat().filter(Boolean).length;
  const gt=Object.keys(GROUPS).length*6;
  document.getElementById('modal-content').innerHTML=`
    <div class="summary-row"><span class="key">Jugador</span><span class="val">${player}</span></div>
    <div class="summary-row"><span class="key">Partidos grupos pronosticados</span><span class="val">${gf} / ${gt}</span></div>
    <div class="summary-row"><span class="key">Pts grupos (1X2)</span><span class="val">${bd.grupos} pts</span></div>
    <div class="summary-row"><span class="key">Pts 1/16 de final</span><span class="val">${bd.r32} pts</span></div>
    <div class="summary-row"><span class="key">Pts Octavos</span><span class="val">${bd.r16} pts</span></div>
    <div class="summary-row"><span class="key">Pts Cuartos</span><span class="val">${bd.qf} pts</span></div>
    <div class="summary-row"><span class="key">Pts Semifinales</span><span class="val">${bd.sf} pts</span></div>
    <div class="summary-row"><span class="key">Finalistas</span><span class="val">${document.getElementById('finalist1')?.value||'—'} · ${document.getElementById('finalist2')?.value||'—'}</span></div>
    <div class="summary-row"><span class="key">Campeón</span><span class="val">🏆 ${document.getElementById('champion')?.value||'—'}</span></div>
    <div class="summary-row"><span class="key">Equipo más goleador</span><span class="val">⚽ ${document.getElementById('top-scorer-team')?.value||'—'}</span></div>
    <div class="summary-row"><span class="key">Equipo menos goleado</span><span class="val">🛡️ ${document.getElementById('best-defense-team')?.value||'—'}</span></div>
    <div class="summary-row"><span class="key">Máx. goleador</span><span class="val">👟 ${document.getElementById('top-scorer-player')?.value?.trim()||'—'}</span></div>
    <div class="summary-total"><span class="key">TOTAL PUNTOS BASE</span><span class="val">${bd.total}</span></div>`;
  document.getElementById('modal').classList.add('active');
}
function closeModal(e){if(e.target===document.getElementById('modal'))closeModalBtn();}
function closeModalBtn(){document.getElementById('modal').classList.remove('active');}

/* ═════════════════════════════════════════
   PORRA PAYLOAD ⇄ FORM
═════════════════════════════════════════ */
function collectPorra(){
  const bw={};
  [...R32,...R16,...QF,...SF].forEach(m=>{if(bracketWinners[m.id])bw[m.id]=bracketWinners[m.id];});
  return {
    id: porraId || undefined,
    player:document.getElementById('player-name').value,
    groupResults:JSON.parse(JSON.stringify(groupResults)),
    bracketWinners:bw,
    finalist1:document.getElementById('finalist1')?.value||'',
    finalist2:document.getElementById('finalist2')?.value||'',
    champion:document.getElementById('champion')?.value||'',
    topScorerTeam:document.getElementById('top-scorer-team')?.value||'',
    bestDefenseTeam:document.getElementById('best-defense-team')?.value||'',
    topScorerPlayer:document.getElementById('top-scorer-player')?.value||'',
  };
}

function applyData(data){
  if(data.player){document.getElementById('player-name').value=data.player;}
  document.getElementById('display-player').textContent=(data.player||'').trim()||'—';
  document.getElementById('pts-player-name-big').textContent=(data.player||'').trim()||'— Introduce tu nombre —';
  if(data.groupResults){
    Object.entries(data.groupResults).forEach(([g,arr])=>{
      if(!groupResults[g])return;
      arr.forEach((r,i)=>{
        groupResults[g][i]=r;
        if(r){
          document.querySelectorAll(`[data-g="${g}"][data-i="${i}"]`).forEach(b=>{
            b.classList.remove('active-1','active-x','active-2');
            if(b.dataset.r===r)b.classList.add(`active-${r}`);
          });
        }
      });
    });
  }
  if(data.bracketWinners){
    Object.entries(data.bracketWinners).forEach(([id,v])=>{bracketWinners[id]=v;});
  }
  refreshBracketAuto();
  if(data.bracketWinners){
    Object.entries(data.bracketWinners).forEach(([id,v])=>{
      const sel=document.getElementById(`sel-${id}-w`);
      if(sel)sel.value=v;
    });
  }
  ['finalist1','finalist2','champion'].forEach(id=>{const el=document.getElementById(id);if(el&&data[id])el.value=data[id];});
  if(data.topScorerTeam&&document.getElementById('top-scorer-team'))document.getElementById('top-scorer-team').value=data.topScorerTeam;
  if(data.bestDefenseTeam&&document.getElementById('best-defense-team'))document.getElementById('best-defense-team').value=data.bestDefenseTeam;
  if(data.topScorerPlayer&&document.getElementById('top-scorer-player'))document.getElementById('top-scorer-player').value=data.topScorerPlayer;
  calcTotal();updateProgress();updatePtsTab();
}

/* ═════════════════════════════════════════
   AUTO-SAVE (debounced)
═════════════════════════════════════════ */
let saveTimer=null;
let saveInFlight=false;
let lastSavedAt=null;
let saveStatusTicker=null;
function scheduleSave(){
  if(meta.locked)return;
  setSaveStatus('pending','· editando');
  clearTimeout(saveTimer);
  saveTimer=setTimeout(doSave,800);
}

async function doSave(){
  if(meta.locked){
    clearTimeout(saveTimer);
    setSaveStatus('err','🔒 plazo cerrado');
    return false;
  }
  if(saveInFlight){ saveTimer=setTimeout(doSave,300); return false; }
  saveInFlight=true;
  setSaveStatus('pending','💾 Guardando…');
  try{
    const data=collectPorra();
    const res=await API.savePorra(data);
    if(res&&res.id){
      porraId=res.id;
      try{ localStorage.setItem('porraId', porraId); }catch{}
    }
    markSaved(res?.updatedAt);
    return true;
  }catch(err){
    console.error('save failed', err);
    if(err.status===423){
      setSaveStatus('err','🔒 plazo cerrado');
      enterLockedMode();
    } else {
      setSaveStatus('err','⚠ sin conexión');
    }
    return false;
  } finally {
    saveInFlight=false;
  }
}

function forceSave(){
  if(meta.locked){
    clearTimeout(saveTimer);
    setSaveStatus('err','🔒 plazo cerrado');
    showToast('🔒 Plazo cerrado');
    return;
  }
  clearTimeout(saveTimer);
  doSave().then(saved=>{if(saved)showToast('💾 Guardado');});
}

function setSaveStatus(cls,text){
  if(cls!=='ok'&&saveStatusTicker){
    clearInterval(saveStatusTicker);
    saveStatusTicker=null;
  }
  const el=document.getElementById('save-status');
  if(!el)return;
  el.className='save-status '+cls;
  el.textContent=text||'';
}

function markSaved(value){
  const parsed=value?new Date(value):new Date();
  lastSavedAt=Number.isNaN(parsed.getTime())?new Date():parsed;
  updateRelativeSaveStatus();
  if(saveStatusTicker)clearInterval(saveStatusTicker);
  saveStatusTicker=setInterval(updateRelativeSaveStatus,5000);
}

function updateRelativeSaveStatus(){
  if(!lastSavedAt)return;
  const diff=Math.max(0,Math.floor((Date.now()-lastSavedAt.getTime())/1000));
  let label=`${diff}s`;
  if(diff>=3600)label=`${Math.floor(diff/3600)}h`;
  else if(diff>=60)label=`${Math.floor(diff/60)}m`;
  const el=document.getElementById('save-status');
  if(!el)return;
  el.className='save-status ok';
  el.textContent=`✓ guardado hace ${label}`;
}

/* ═════════════════════════════════════════
   EXPORT / RESET / LOCK
═════════════════════════════════════════ */
function exportPorra(){
  const data=collectPorra();
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  a.download=`porra_mundial_${(data.player||'jugador').replace(/\s+/g,'_')}.json`;
  a.click();
  showToast('⬇️ Descargado');
}

function resetAll(){
  if(!confirm('¿Reiniciar toda la porra? Se desvincula este boleto y se recargará la página.'))return;
  try{ localStorage.removeItem('porraId'); }catch{}
  location.reload();
}

function enterLockedMode(){
  meta.locked=true;
  document.body.classList.add('locked');
  clearTimeout(saveTimer);
  setSaveStatus('err','🔒 plazo cerrado');
}

function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}

/* ═════════════════════════════════════════
   RANKING TAB
═════════════════════════════════════════ */
async function refreshRanking(){
  const info=document.getElementById('ranking-info');
  const cont=document.getElementById('ranking-container');
  info.textContent='Cargando…';
  try{
    const [ranking, m] = await Promise.all([API.getRanking(), API.getMeta()]);
    const updated = m?.lastScrape?.at ? new Date(m.lastScrape.at).toLocaleString('es-ES') : 'nunca';
    const okFlag = m?.lastScrape?.ok===false ? ' ⚠️' : '';
    info.textContent=`Última actualización de resultados: ${updated}${okFlag}`;
    if(!ranking||!ranking.length){
      cont.innerHTML=`<div class="ranking-empty">Aún no hay porras registradas o resultados disponibles.</div>`;
      return;
    }
    const myId = porraId;
    cont.innerHTML=`
      <table class="ranking-table">
        <thead><tr><th>#</th><th>Jugador</th><th>Grupos</th><th>1/16</th><th>Octavos</th><th>Cuartos</th><th>Semis</th><th>Final</th><th>Camp.</th><th>Esp.</th><th class="pts">Total</th></tr></thead>
        <tbody>
          ${ranking.map((r,i)=>`
            <tr class="${r.id===myId?'me':''}">
              <td class="pos">${i+1}</td>
              <td>${escapeHtml(r.player||'—')}</td>
              <td>${r.breakdown?.grupos||0}</td>
              <td>${r.breakdown?.r32||0}</td>
              <td>${r.breakdown?.r16||0}</td>
              <td>${r.breakdown?.qf||0}</td>
              <td>${r.breakdown?.sf||0}</td>
              <td>${r.breakdown?.finalists||0}</td>
              <td>${r.breakdown?.champion||0}</td>
              <td>${r.breakdown?.especiales||0}</td>
              <td class="pts">${r.total}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }catch(err){
    console.error('ranking failed',err);
    info.textContent='No se pudo cargar el ranking.';
    cont.innerHTML=`<div class="ranking-empty">⚠️ Error al cargar el ranking. ¿Está el servidor activo?</div>`;
  }
}

function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

/* ═════════════════════════════════════════
   INIT
═════════════════════════════════════════ */
async function init(){
  buildGroups();
  buildAllBrackets();

  // Cargar meta y porra existente desde servidor
  try{
    meta = await API.getMeta();
    if(meta?.locked) enterLockedMode();
    porraId = localStorage.getItem('porraId');
    if(porraId){
      try{
        const data = await API.getPorra(porraId);
        if(data) applyData(data);
      }catch(err){
        if(err.status===404){
          localStorage.removeItem('porraId');
          porraId=null;
        } else throw err;
      }
    }
  }catch(err){
    console.warn('init API offline:', err);
    setSaveStatus('err','⚠ sin conexión');
  }

  refreshBracketAuto();
  calcTotal();
  updateProgress();
  updatePtsTab();
  autosaveReady=true;
}

// Expose globals para los onclick=  del HTML
window.showTab = showTab;
window.setResult = setResult;
window.onWinnerSelect = onWinnerSelect;
window.calcTotal = calcTotal;
window.updatePlayerDisplay = updatePlayerDisplay;
window.showSummary = showSummary;
window.closeModal = closeModal;
window.closeModalBtn = closeModalBtn;
window.forceSave = forceSave;
window.exportPorra = exportPorra;
window.resetAll = resetAll;
window.refreshRanking = refreshRanking;

document.addEventListener('DOMContentLoaded', init);

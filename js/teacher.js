/*
  교사 대시보드 (3단계)
  - Google 로그인 → 학급 만들기/고르기
  - 학생 카드 격자(실시간), 상태 색(작성 중 / 통과 / 막힘 / 완료 / 대기), 힌트 표시
  - 상단 요약: 참여·접속·완료·막힘, 난이도별 단계 분포, 자주 놓친 표현
  - 카드 크게 보기: 단계별 처음→마지막 문장, 시간순 시도 기록
  - 내려받기: 엑셀(xlsx), CSV(시도 기록 / 학생 요약), 학생별 결과 인쇄
*/
'use strict';
const $ = s => document.querySelector(s);
const T = $('#t-app');
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0 O 1 I 제외
const ONLINE_MS = 75 * 1000;   // 마지막 신호가 75초 안이면 접속 중
const IDLE_MS = 2 * 60 * 1000; // 2분 동안 입력이 없으면 막힘
const STUCK_TRIES = 3;         // 3번 연속 통과 못 하면 막힘
const LEVELS = window.LEVELS;
const byMission = new Map((window.MISSIONS || []).map(m => [m.id, m]));

const STATUS = {
  stuck: { label: '막힘', order: 0 },
  writing: { label: '작성 중', order: 1 },
  pass: { label: '통과', order: 2 },
  done: { label: '완료', order: 3 },
  wait: { label: '대기', order: 4 },
};

let auth, db, user = null;
let unsubs = [], tick = null;
let cls = null;            // { code, name, open, ... }
let students = [];         // 학생 상태 문서
let attempts = [];         // 시도 기록 문서 (학급 전체)
let filter = 'all';
let sortBy = 'number';
let detailSid = null;
let cols = Number(readPref('cols', 5));

/* ───────── 공통 도구 ───────── */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const loadScript = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); });
const ms = v => (v && v.toMillis ? v.toMillis() : (typeof v === 'string' ? Date.parse(v) || 0 : 0));
function readPref(k, d) { try { return localStorage.getItem('swysTeacher:' + k) ?? d; } catch { return d; } }
function writePref(k, v) { try { localStorage.setItem('swysTeacher:' + k, v); } catch { /* 무시 */ } }
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 3500); }
function ago(t) {
  if (!t) return '-';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return s + '초 전';
  if (s < 3600) return Math.floor(s / 60) + '분 전';
  return fmtTime(t);
}
const fmtTime = t => new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtFull = t => (t ? new Date(t).toLocaleString('ko-KR') : '');
const levelName = d => (LEVELS[d] ? LEVELS[d].name : '');
const studentName = s => `${s.number}번 ${s.nickname}`;
const today = () => new Date().toISOString().slice(0, 10);
const missionImg = id => `<img src="assets/photos/${esc(id)}.webp" onerror="this.onerror=null;this.src='assets/svg/${esc(id)}.svg'" alt="">`;

function isOnline(s, now = Date.now()) { return s.online !== false && now - ms(s.lastActive) < ONLINE_MS; }

/* 학생 한 명의 현재 상태와 이유 */
function statusOf(s, now = Date.now()) {
  if (s.view === 'complete') return { key: 'done', why: '4단계 완료' };
  if (s.view !== 'game' || !s.difficulty) return { key: 'wait', why: s.completedCount ? '완료 후 대기' : '시작 전' };
  const i = (s.stage || 1) - 1;
  if (Array.isArray(s.passed) && s.passed[i]) return { key: 'pass', why: (s.stage || 1) + '단계 통과' };
  if ((s.failStreak || 0) >= STUCK_TRIES) return { key: 'stuck', why: s.failStreak + '번 연속 미통과' };
  const li = ms(s.lastInputAt);
  if (isOnline(s, now) && li && now - li > IDLE_MS) return { key: 'stuck', why: Math.floor((now - li) / 60000) + '분째 입력 없음' };
  return { key: 'writing', why: '작성 중' };
}

/* ───────── 로그인 · 학급 목록 ───────── */
function renderSetupNeeded(reason) {
  T.innerHTML = `<section class="t-card notice"><h2>학급 모드가 아직 꺼져 있어요</h2>
  <p>${reason}</p><p><code>js/firebase-config.js</code>에 Firebase 설정을 넣고, 웹 주소(https://)로 이 페이지를 열어 주세요. 자세한 방법은 <b>README.md</b>에 있어요.</p></section>`;
}

function renderLogin() {
  $('#teacherName').hidden = true; $('#signOut').hidden = true;
  T.innerHTML = `<section class="t-card" style="max-width:480px;margin:40px auto;text-align:center">
    <h1>선생님 로그인</h1><p class="muted">학급을 만들고 학생들의 연습 과정을 실시간으로 확인해요.</p>
    <button class="primary" id="google">Google 계정으로 로그인</button></section>`;
  $('#google').onclick = async () => {
    try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
    catch (e) { console.warn(e); toast('로그인하지 못했어요. 팝업 차단을 확인해 주세요.'); }
  };
}

async function renderClasses() {
  stopLive();
  T.innerHTML = `<section class="t-card"><h1>내 학급</h1>
    <form class="t-row" id="createForm"><input id="className" maxlength="30" placeholder="학급 이름 (예: 6학년 6반)" required><button class="primary">새 학급 만들기 +</button></form>
    <div class="class-list" id="classList"><p class="muted">불러오는 중…</p></div></section>`;
  $('#createForm').onsubmit = async e => { e.preventDefault(); await createClass($('#className').value.trim()); };
  try {
    const snap = await db.collection('classes').where('teacherUid', '==', user.uid).get();
    const list = snap.docs.map(d => ({ code: d.id, ...d.data() })).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
    $('#classList').innerHTML = list.length
      ? list.map(c => `<button class="class-item" data-code="${c.code}"><b>${esc(c.name)}</b><span class="code">${c.code}</span><br><small class="muted">${c.open === false ? '참여 닫힘' : '참여 열림'}</small></button>`).join('')
      : '<p class="muted">아직 만든 학급이 없어요. 위에서 학급을 만들어 보세요.</p>';
    T.querySelectorAll('[data-code]').forEach(b => (b.onclick = () => (location.hash = b.dataset.code)));
  } catch (e) { console.warn(e); $('#classList').innerHTML = '<p class="form-error">학급 목록을 불러오지 못했어요. 보안 규칙(firestore.rules)이 게시되었는지 확인해 주세요.</p>'; }
}

async function createClass(name) {
  if (!name) return;
  for (let t = 0; t < 5; t++) {
    const r = new Uint32Array(6); crypto.getRandomValues(r);
    const code = Array.from(r, x => CODE_CHARS[x % CODE_CHARS.length]).join('');
    const ref = db.collection('classes').doc(code);
    try {
      if ((await ref.get()).exists) continue;
      await ref.set({ name, teacherUid: user.uid, open: true, settings: { passRatio: 0.8 }, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      location.hash = code;
      return;
    } catch (e) { console.warn(e); toast('학급을 만들지 못했어요. 보안 규칙을 확인해 주세요.'); return; }
  }
  toast('코드를 만들지 못했어요. 다시 시도해 주세요.');
}

function stopLive() {
  unsubs.forEach(u => u()); unsubs = [];
  clearInterval(tick); tick = null;
  students = []; attempts = []; cls = null; detailSid = null;
}

/* ───────── 학급 대시보드 ───────── */
async function openClass(code) {
  stopLive();
  let info = null;
  try { const s = await db.collection('classes').doc(code).get(); info = s.exists ? s.data() : null; } catch (e) { console.warn(e); }
  if (!info || info.teacherUid !== user.uid) { toast('내 학급이 아니거나 없는 코드예요.'); location.hash = ''; return; }
  cls = { code, ...info };
  renderShell();
  const ref = db.collection('classes').doc(code);
  unsubs.push(ref.collection('students').onSnapshot(snap => {
    students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const changed = new Set(snap.docChanges().filter(c => c.type === 'modified').map(c => c.doc.id));
    refresh(changed);
  }, liveError));
  unsubs.push(ref.collection('attempts').onSnapshot(snap => {
    attempts = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(a.time) - ms(b.time));
    drawInsights();
    if (detailSid) drawDetail();
  }, liveError));
  tick = setInterval(() => refresh(new Set()), 10000); // 접속·막힘 상태는 시간이 지나면 바뀌어요
}
function liveError(err) { console.warn(err); toast('실시간 연결에 실패했어요. 보안 규칙을 확인해 주세요.'); }

function renderShell() {
  T.innerHTML = `
  <div class="dash-top">
    <div>
      <a href="#" class="text-button">← 내 학급</a>
      <h1 class="dash-title">${esc(cls.name)}</h1>
    </div>
    <div class="join-box">
      <span class="muted tiny">학생 참여 코드</span>
      <span class="code code-big">${cls.code}</span>
      <label class="tiny"><input type="checkbox" id="openToggle" ${cls.open === false ? '' : 'checked'}> 참여 허용</label>
    </div>
  </div>

  <section class="summary" id="summary"></section>

  <section class="toolbar">
    <div class="filters" id="filters" role="tablist" aria-label="상태로 거르기"></div>
    <div class="tools">
      <select id="sortBy" aria-label="정렬">
        <option value="number">번호순</option><option value="status">상태순(막힘 먼저)</option><option value="progress">진행순</option><option value="recent">최근 활동순</option>
      </select>
      <div class="zoom" aria-label="한 줄에 보이는 카드 수"><button type="button" id="colMinus" aria-label="카드 크게">−</button><span id="colCount">${cols}</span><button type="button" id="colPlus" aria-label="카드 작게">+</button></div>
      <div class="menu-wrap">
        <button class="outline compact" id="downloadBtn" type="button" aria-haspopup="true" aria-expanded="false">내려받기 ↓</button>
        <div class="menu" id="downloadMenu" hidden>
          <button type="button" data-dl="xlsx">엑셀 파일 (.xlsx) <small>학생 요약 · 시도 기록 · 처음과 마지막</small></button>
          <button type="button" data-dl="csv-attempts">CSV · 시도 기록 전체</button>
          <button type="button" data-dl="csv-summary">CSV · 학생 요약</button>
          <button type="button" data-dl="print">학생별 결과 인쇄 / PDF</button>
        </div>
      </div>
    </div>
  </section>

  <section class="grid" id="grid" style="--cols:${cols}"></section>

  <section class="t-card insights">
    <h2>자주 놓친 표현</h2>
    <p class="muted tiny">학생들이 점검했을 때 빠져 있던 표현이에요. 다 같이 짚어 줄 부분을 찾는 데 써 보세요.</p>
    <div id="missed"></div>
  </section>

  <dialog id="detailDialog" class="detail-dialog"><div id="detailBody"></div></dialog>`;

  $('#openToggle').onchange = e => db.collection('classes').doc(cls.code).update({ open: e.target.checked })
    .then(() => toast(e.target.checked ? '참여를 열었어요.' : '참여를 닫았어요.')).catch(() => toast('바꾸지 못했어요.'));
  $('#sortBy').value = sortBy;
  $('#sortBy').onchange = e => { sortBy = e.target.value; drawGrid(new Set()); };
  $('#colMinus').onclick = () => setCols(cols - 1);
  $('#colPlus').onclick = () => setCols(cols + 1);
  const menu = $('#downloadMenu'), btn = $('#downloadBtn');
  btn.onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); };
  menu.querySelectorAll('[data-dl]').forEach(b => (b.onclick = () => download(b.dataset.dl)));
  const dlg = $('#detailDialog');
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { detailSid = null; });
  refresh(new Set());
  drawInsights();
}

function setCols(n) {
  cols = Math.min(8, Math.max(2, n));
  writePref('cols', cols);
  $('#colCount').textContent = cols;
  $('#grid').style.setProperty('--cols', cols);
}

function refresh(changed) {
  if (!cls || !$('#grid')) return;
  drawSummary();
  drawFilters();
  drawGrid(changed);
  if (detailSid) drawDetailHeader();
}

function drawSummary() {
  const now = Date.now();
  const n = students.length;
  const online = students.filter(s => isOnline(s, now)).length;
  const done = students.filter(s => (s.completedCount || 0) > 0).length;
  const stuck = students.filter(s => statusOf(s, now).key === 'stuck').length;
  const checks = attempts.filter(a => a.type === '점검').length;
  // 난이도별로 지금 몇 단계에 몇 명이 있는지
  const dist = Object.keys(LEVELS).map(k => {
    const inLv = students.filter(s => s.difficulty === k && (s.view === 'game' || s.view === 'complete'));
    if (!inLv.length) return '';
    const cells = [1, 2, 3, 4].map(st => inLv.filter(s => s.view === 'game' && s.stage === st).length);
    const fin = inLv.filter(s => s.view === 'complete').length;
    const max = Math.max(1, ...cells, fin);
    const bar = (v, label, cls2 = '') => `<div class="dist-cell ${cls2}" title="${label} ${v}명"><div class="dist-bar"><span style="height:${(v / max) * 100}%"></span></div><b>${v}</b><small>${label}</small></div>`;
    return `<div class="dist-row"><span class="pill ${k}">${LEVELS[k].name}</span>${cells.map((v, i) => bar(v, i + 1 + '단계')).join('')}${bar(fin, '완료', 'fin')}</div>`;
  }).join('');
  $('#summary').innerHTML = `
    <div class="kpis">
      <div class="kpi"><small>참여</small><b>${n}<span>명</span></b></div>
      <div class="kpi"><small>접속 중</small><b>${online}<span>/${n}</span></b></div>
      <div class="kpi ok"><small>4단계 완료</small><b>${done}<span>/${n}</span></b></div>
      <div class="kpi warn"><small>막힘</small><b>${stuck}<span>명</span></b></div>
      <div class="kpi"><small>점검 횟수</small><b>${checks}<span>번</span></b></div>
    </div>
    <div class="dist">${dist || '<p class="muted tiny">학생이 도전을 시작하면 단계별 인원이 여기에 나타나요.</p>'}</div>`;
}

function drawFilters() {
  const now = Date.now();
  const counts = { all: students.length };
  students.forEach(s => { const k = statusOf(s, now).key; counts[k] = (counts[k] || 0) + 1; });
  const items = [['all', '전체'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])];
  $('#filters').innerHTML = items.map(([k, label]) =>
    `<button type="button" role="tab" class="f-chip ${k} ${filter === k ? 'on' : ''}" aria-selected="${filter === k}" data-f="${k}">${label} <b>${counts[k] || 0}</b></button>`).join('');
  $('#filters').querySelectorAll('[data-f]').forEach(b => (b.onclick = () => { filter = b.dataset.f; refresh(new Set()); }));
}

function progressScore(s) {
  if (s.view === 'complete') return 100 + (s.completedCount || 0);
  const lv = { easy: 0, medium: 10, hard: 20 }[s.difficulty] || 0;
  const passed = Array.isArray(s.passed) ? s.passed.filter(Boolean).length : 0;
  return lv + passed;
}

function drawGrid(changed) {
  const now = Date.now();
  let list = students.map(s => ({ s, st: statusOf(s, now) }));
  if (filter !== 'all') list = list.filter(x => x.st.key === filter);
  const byNum = (a, b) => (a.s.number - b.s.number) || String(a.s.nickname).localeCompare(b.s.nickname);
  const sorters = {
    number: byNum,
    status: (a, b) => (STATUS[a.st.key].order - STATUS[b.st.key].order) || byNum(a, b),
    progress: (a, b) => (progressScore(b.s) - progressScore(a.s)) || byNum(a, b),
    recent: (a, b) => ms(b.s.lastActive) - ms(a.s.lastActive),
  };
  list.sort(sorters[sortBy] || byNum);
  const grid = $('#grid');
  if (!students.length) { grid.innerHTML = `<div class="empty-grid">학생이 <b>${cls.code}</b> 코드로 들어오면 카드가 바로 나타나요.</div>`; return; }
  if (!list.length) { grid.innerHTML = '<div class="empty-grid">이 상태인 학생이 없어요.</div>'; return; }
  grid.innerHTML = list.map(({ s, st }) => card(s, st, now, changed.has(s.id))).join('');
  grid.querySelectorAll('[data-sid]').forEach(b => (b.onclick = () => openDetail(b.dataset.sid)));
}

function stepsHtml(s) {
  const passed = Array.isArray(s.passed) ? s.passed : [];
  return [0, 1, 2, 3].map(i => {
    const ok = passed[i];
    const cur = s.view === 'game' && s.stage === i + 1;
    return `<span class="step ${ok ? 'ok' : ''} ${cur ? 'cur' : ''}" title="${i + 1}단계${ok ? ' 통과' : ''}">${ok ? '✓' : i + 1}</span>`;
  }).join('');
}

function card(s, st, now, flash) {
  const on = isOnline(s, now);
  const text = s.currentDraft || s.lastPrompt || '';
  const pct = s.latestPercent;
  const hint = Array.isArray(s.hintUsed) && s.hintUsed[(s.stage || 1) - 1];
  const lv = levelName(s.difficulty);
  return `<button type="button" class="s-card st-${st.key} ${flash ? 'flash' : ''}" data-sid="${esc(s.id)}" aria-label="${esc(studentName(s))}, ${STATUS[st.key].label}">
    <div class="s-head">
      <span class="dot ${on ? 'on' : ''}" title="${on ? '접속 중' : '접속 안 함'}"></span>
      <b class="s-name">${esc(s.number)}. ${esc(s.nickname)}</b>
      <span class="s-badge">${STATUS[st.key].label}</span>
    </div>
    <div class="s-meta">
      ${lv ? `<span class="pill ${s.difficulty}">${lv}</span>` : '<span class="muted">난이도 선택 전</span>'}
      ${s.view === 'game' ? `<span>${s.stage}단계</span>` : ''}
      ${hint ? '<span class="hint-flag" title="이 단계에서 힌트를 봤어요">💡힌트</span>' : ''}
      ${s.completedCount ? `<span class="done-flag" title="4단계 완료 횟수">🏅${s.completedCount}</span>` : ''}
    </div>
    ${s.difficulty ? `<div class="steps">${stepsHtml(s)}</div>` : ''}
    <p class="s-text ${text ? '' : 'muted'}">${esc(text) || '아직 쓴 문장이 없어요.'}</p>
    <div class="s-foot">
      <div class="meter small"><div style="width:${pct || 0}%"></div></div>
      <span>${pct == null ? '-' : pct + '%'}</span>
    </div>
    <small class="s-why">${esc(st.why)} · 점검 ${s.attemptsCount || 0}번 · ${ago(ms(s.lastActive))}</small>
  </button>`;
}

/* 자주 놓친 표현: 점검 기록의 missed 라벨을 종류별로 모아요 */
function drawInsights() {
  const box = $('#missed'); if (!box) return;
  const checks = attempts.filter(a => a.type === '점검');
  if (!checks.length) { box.innerHTML = '<p class="muted">아직 점검 기록이 없어요.</p>'; return; }
  const byCat = new Map(), byLabel = new Map();
  checks.forEach(a => (a.missed || []).forEach(label => {
    const cat = String(label).split(' · ')[0];
    byCat.set(cat, (byCat.get(cat) || 0) + 1);
    byLabel.set(label, (byLabel.get(label) || 0) + 1);
  }));
  const cats = [...byCat].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const labels = [...byLabel].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(1, ...cats.map(c => c[1]));
  box.innerHTML = `<div class="missed-grid">
    <div><h3>종류별</h3>${cats.map(([k, v]) => `<div class="mbar"><span class="mlabel">${esc(k)}</span><span class="mtrack"><span style="width:${(v / max) * 100}%"></span></span><b>${v}</b></div>`).join('') || '<p class="muted">없음</p>'}</div>
    <div><h3>표현별 상위</h3><ol class="mlist">${labels.map(([k, v]) => `<li>${esc(k)} <b>${v}번</b></li>`).join('') || '<li class="muted">없음</li>'}</ol></div>
  </div><p class="muted tiny">점검 ${checks.length}번 기준</p>`;
}

/* ───────── 학생 자세히 보기 ───────── */
function studentAttempts(sid) { return attempts.filter(a => a.uid === sid); }

/* 도전(세션)·단계별로 처음 점검 문장과 마지막 문장을 묶어요 */
function stageSummaries(list) {
  const sessions = new Map();
  list.filter(a => a.type === '점검').forEach(a => {
    const key = a.session || 'unknown';
    if (!sessions.has(key)) sessions.set(key, { session: key, difficulty: a.difficulty, stages: new Map() });
    const ses = sessions.get(key);
    const k = a.stage + ':' + a.missionId;
    if (!ses.stages.has(k)) ses.stages.set(k, { stage: a.stage, missionId: a.missionId, mission: a.mission, first: a, last: a, tries: 0, passed: false, hint: false });
    const g = ses.stages.get(k);
    g.last = a; g.tries += 1; g.passed = g.passed || !!a.pass; g.hint = g.hint || !!a.hintUsed;
  });
  return [...sessions.values()]
    .map(x => ({ ...x, stages: [...x.stages.values()].sort((a, b) => a.stage - b.stage) }))
    .sort((a, b) => ms(b.session) - ms(a.session));
}

function openDetail(sid) {
  detailSid = sid;
  drawDetail();
  const d = $('#detailDialog');
  if (!d.open) d.showModal();
}

function drawDetailHeader() {
  const s = students.find(x => x.id === detailSid); const h = $('#detailHead');
  if (!s || !h) return;
  const st = statusOf(s);
  h.innerHTML = `<div><h2>${esc(studentName(s))}</h2>
    <span class="s-badge st-${st.key}">${STATUS[st.key].label}</span> <span class="muted tiny">${esc(st.why)} · 점검 ${s.attemptsCount || 0}번 · 4단계 완료 ${s.completedCount || 0}번 · 마지막 활동 ${ago(ms(s.lastActive))}</span></div>`;
}

function drawDetail() {
  const s = students.find(x => x.id === detailSid);
  if (!s) return;
  const list = studentAttempts(s.id);
  const sums = stageSummaries(list);
  $('#detailBody').innerHTML = `
    <div class="detail-top"><div id="detailHead"></div>
      <div class="t-row"><button class="outline compact" id="printOne" type="button">인쇄 / PDF</button><button class="dialog-close" type="button" id="closeDetail" aria-label="닫기">✕</button></div></div>
    ${s.currentDraft && s.view === 'game' ? `<div class="live-draft"><small>지금 쓰고 있는 문장</small><p>${esc(s.currentDraft)}</p></div>` : ''}
    <h3>단계별 처음 → 마지막</h3>
    ${sums.length ? sums.map(ses => `
      <div class="ses">
        <div class="ses-head"><span class="pill ${ses.difficulty}">${levelName(ses.difficulty)}</span> <span class="muted tiny">${fmtFull(ms(ses.session))} 시작</span></div>
        <div class="ses-stages">${ses.stages.map(g => `
          <article class="cmp">
            <div class="cmp-head">${missionImg(g.missionId)}<div><small>${g.stage}단계 · ${esc(LEVELS[ses.difficulty]?.stages[g.stage - 1]?.title || '')}</small><b>${esc(g.mission)}</b>
              <small>${g.passed ? '✅ 통과' : '⏳ 진행 중'} · 점검 ${g.tries}번${g.hint ? ' · 💡힌트' : ''}</small></div></div>
            <div class="cmp-row"><small>처음 (${g.first.percent}%)</small><p class="first">${esc(g.first.prompt)}</p></div>
            ${g.tries > 1 ? `<div class="cmp-row"><small>마지막 (${g.last.percent}%)</small><p class="final">${esc(g.last.prompt)}</p></div>` : ''}
          </article>`).join('')}</div>
      </div>`).join('') : '<p class="muted">아직 점검한 기록이 없어요.</p>'}
    <h3>시간순 기록 <small class="muted">(${list.length}개)</small></h3>
    <ol class="timeline">${list.slice().reverse().map(a => `
      <li class="${a.pass ? 'ok' : ''}">
        <div class="tl-meta"><b>${fmtTime(ms(a.time))}</b> · ${levelName(a.difficulty)} ${a.stage}단계 · ${esc(a.mission)} · <span class="tl-type">${esc(a.type)}</span>
          ${a.type === '점검' ? ` · ${a.count}/${a.total} (${a.percent}%)${a.pass ? ' ✓통과' : ''}` : ''}${a.hintUsed ? ' · 💡' : ''}</div>
        <p>${esc(a.prompt)}</p>
        ${a.type === '점검' && a.missed && a.missed.length ? `<small class="missed-tags">놓친 표현: ${a.missed.map(esc).join(', ')}</small>` : ''}
      </li>`).join('') || '<li class="muted">기록이 없어요.</li>'}</ol>`;
  drawDetailHeader();
  $('#closeDetail').onclick = () => $('#detailDialog').close();
  $('#printOne').onclick = () => { $('#detailDialog').close(); printStudents([s]); };
}

/* ───────── 내려받기 ───────── */
// 엑셀에서 수식으로 실행되지 않도록 = + - @ 로 시작하는 칸은 앞에 ' 를 붙여요
const safeCell = v => (typeof v === 'string' && /^[=+\-@\t\r]/.test(v) ? "'" + v : v);
const sortedStudents = () => students.slice().sort((a, b) => (a.number - b.number) || String(a.nickname).localeCompare(b.nickname));

function summaryRows() {
  const now = Date.now();
  return sortedStudents().map(s => {
    const st = statusOf(s, now);
    const checks = attempts.filter(a => a.uid === s.id && a.type === '점검');
    const passes = checks.filter(a => a.pass).length;
    return {
      '번호': s.number, '별명': s.nickname, '상태': STATUS[st.key].label, '상태 이유': st.why,
      '현재 난이도': levelName(s.difficulty), '현재 단계': s.view === 'game' ? s.stage : '',
      '현재 도전 통과 단계 수': Array.isArray(s.passed) ? s.passed.filter(Boolean).length : 0,
      '4단계 완료 횟수': s.completedCount || 0, '점검 횟수': checks.length, '통과한 점검 수': passes,
      '평균 표현 확인률(%)': checks.length ? Math.round(checks.reduce((x, a) => x + (a.percent || 0), 0) / checks.length) : '',
      '최근 표현 확인률(%)': s.latestPercent ?? '', '최근 문장': s.lastPrompt || s.currentDraft || '',
      '참여 시각': fmtFull(ms(s.joinedAt)), '마지막 활동': fmtFull(ms(s.lastActive)),
    };
  });
}

function attemptRows() {
  const numOf = new Map(students.map(s => [s.id, s]));
  return attempts.slice().sort((a, b) => (a.number - b.number) || (ms(a.time) - ms(b.time))).map(a => ({
    '번호': a.number, '별명': (numOf.get(a.uid) || a).nickname, '시각': fmtFull(ms(a.time)),
    '난이도': levelName(a.difficulty), '단계': a.stage, '그림': a.mission, '그림 ID': a.missionId,
    '기록 종류': a.type, '단계 안 점검 순서': a.tryNo ?? '', '문장': a.prompt, '글자 수': (a.prompt || '').length,
    '찾은 표현 수': a.count, '전체 표현 수': a.total, '표현 확인률(%)': a.percent, '통과': a.pass ? 'O' : '',
    '힌트 사용': a.hintUsed ? 'O' : '', '놓친 표현': (a.missed || []).join(', '),
  }));
}

function firstLastRows() {
  const rows = [];
  sortedStudents().forEach(s => stageSummaries(studentAttempts(s.id)).forEach(ses => ses.stages.forEach(g => rows.push({
    '번호': s.number, '별명': s.nickname, '도전 시작': fmtFull(ms(ses.session)), '난이도': levelName(ses.difficulty),
    '단계': g.stage, '그림': g.mission, '점검 횟수': g.tries, '통과': g.passed ? 'O' : '', '힌트': g.hint ? 'O' : '',
    '처음 문장': g.first.prompt, '처음 확인률(%)': g.first.percent, '마지막 문장': g.last.prompt, '마지막 확인률(%)': g.last.percent,
    '확인률 변화(%p)': g.last.percent - g.first.percent,
  }))));
  return rows;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const head = Object.keys(rows[0]);
  const cell = v => { v = safeCell(v ?? ''); const t = String(v); return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  return [head.map(cell).join(','), ...rows.map(r => head.map(h => cell(r[h])).join(','))].join('\r\n');
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const fileBase = () => `${cls.name}_${cls.code}_${today()}`.replace(/[\\/:*?"<>|]/g, '_');

async function download(kind) {
  $('#downloadMenu').hidden = true;
  if (!students.length) return toast('아직 학생 기록이 없어요.');
  if (kind === 'print') return printStudents(sortedStudents());
  if (kind === 'csv-attempts') {
    const rows = attemptRows(); if (!rows.length) return toast('아직 시도 기록이 없어요.');
    return saveBlob(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }), fileBase() + '_시도기록.csv');
  }
  if (kind === 'csv-summary') return saveBlob(new Blob(['﻿' + toCsv(summaryRows())], { type: 'text/csv;charset=utf-8' }), fileBase() + '_학생요약.csv');
  if (kind === 'xlsx') {
    try { if (!window.XLSX) { toast('엑셀 도구를 불러오는 중…'); await loadScript(XLSX_URL); } }
    catch { return toast('엑셀 도구를 불러오지 못했어요. CSV로 받아 주세요.'); }
    const wb = XLSX.utils.book_new();
    const add = (rows, name, widths) => {
      const clean = rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safeCell(v)])));
      const ws = clean.length ? XLSX.utils.json_to_sheet(clean) : XLSX.utils.aoa_to_sheet([['기록 없음']]);
      if (clean.length) ws['!cols'] = Object.keys(clean[0]).map(k => ({ wch: widths[k] || Math.max(8, k.length * 2) }));
      XLSX.utils.book_append_sheet(wb, ws, name);
    };
    add(summaryRows(), '학생 요약', { '별명': 12, '상태 이유': 16, '최근 문장': 60, '참여 시각': 22, '마지막 활동': 22 });
    add(firstLastRows(), '처음과 마지막', { '별명': 12, '도전 시작': 22, '그림': 18, '처음 문장': 50, '마지막 문장': 50 });
    add(attemptRows(), '시도 기록', { '별명': 12, '시각': 22, '그림': 18, '문장': 60, '놓친 표현': 40 });
    XLSX.writeFile(wb, fileBase() + '_프롬프트기록.xlsx');
  }
}

/* 학생별 결과 인쇄: 학생 1명 = 1쪽 (브라우저 인쇄에서 "PDF로 저장"도 가능) */
function printStudents(list) {
  let area = $('#printArea');
  if (!area) { area = document.createElement('div'); area.id = 'printArea'; document.body.append(area); }
  area.innerHTML = list.map(s => {
    const sums = stageSummaries(studentAttempts(s.id));
    return `<section class="p-page">
      <header class="p-head"><div><small>${esc(cls.name)} · 보이는 걸 말해 봐</small><h1>${esc(studentName(s))}</h1></div>
        <div class="p-stats">점검 ${s.attemptsCount || 0}번 · 4단계 완료 ${s.completedCount || 0}번<br><small>${today()} 출력</small></div></header>
      ${sums.length ? sums.map(ses => `<h2>${levelName(ses.difficulty)} 도전 <small>${fmtFull(ms(ses.session))}</small></h2>
        <table class="p-table"><thead><tr><th>단계</th><th>그림</th><th>처음 쓴 문장</th><th>마지막 문장</th><th>결과</th></tr></thead><tbody>
        ${ses.stages.map(g => `<tr><td>${g.stage}</td><td>${esc(g.mission)}</td><td>${esc(g.first.prompt)}<br><small>${g.first.percent}%</small></td><td>${g.tries > 1 ? esc(g.last.prompt) + '<br><small>' + g.last.percent + '%</small>' : '<small>(처음과 같음)</small>'}</td><td>${g.passed ? '통과' : '진행 중'}<br><small>점검 ${g.tries}번${g.hint ? ', 힌트' : ''}</small></td></tr>`).join('')}
        </tbody></table>`).join('') : '<p>아직 점검 기록이 없어요.</p>'}
      <div class="p-reflect"><b>스스로 돌아보기</b><p>처음 문장과 마지막 문장을 비교해 보세요. 무엇을 더 자세히 쓰게 되었나요?</p><div class="p-lines"></div></div>
    </section>`;
  }).join('');
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 50);
}

/* ───────── 시작 ───────── */
function route() {
  if (!user) return;
  const code = location.hash.replace('#', '').toUpperCase();
  code ? openClass(code) : renderClasses();
}

/* 미리보기: teacher.html?demo — 로그인 없이 가짜 학생 데이터로 대시보드를 보여 줘요 */
function startDemo() {
  const names = ['하늘', '도윤', '서아', '지호', '민준', '하린', '시우', '예린', '준서', '수아', '은우', '지안'];
  const lvKeys = ['easy', 'easy', 'easy', 'medium', 'medium', 'hard'];
  const now = Date.now();
  const stamp = t => ({ toMillis: () => t });
  const pick = (arr, i) => arr[i % arr.length];
  students = []; attempts = [];
  names.forEach((nick, i) => {
    const uid = 'demo' + i, difficulty = pick(lvKeys, i);
    const pool = window.MISSIONS.filter(m => m.difficulty === difficulty);
    const stage = 1 + (i % 4), finished = i % 5 === 4;
    const passed = [0, 1, 2, 3].map(n => finished || n < stage - 1);
    const session = new Date(now - 30 * 60000 + i * 1000).toISOString();
    let t = now - 25 * 60000 + i * 20000;
    for (let st = 1; st <= (finished ? 4 : stage); st++) {
      const m = pool.find(x => x.stage === st);
      const tries = st === stage && i % 3 === 0 ? 3 : 2;
      for (let k = 1; k <= tries; k++) {
        const pass = (st < stage || finished) && k === tries;
        const count = pass ? m.criteria.length : Math.max(1, m.criteria.length - 2 - (k === 1 ? 1 : 0));
        const missed = m.criteria.slice(count).map(c => c.label);
        attempts.push({ uid, number: i + 1, nickname: nick, session, difficulty, stage: st, missionId: m.id, mission: m.title,
          prompt: k === 1 ? `${m.title.split(' ').pop()}이 있어요.` : `${m.title}이(가) 보여요. ${pass ? '색과 위치도 자세히 썼어요.' : '조금 더 써 볼게요.'}`,
          count, total: m.criteria.length, percent: Math.round(count / m.criteria.length * 100), pass, missed,
          hintUsed: i % 4 === 1 && st === stage, tryNo: k, type: '점검', time: new Date(t += 70000).toISOString() });
      }
    }
    const last = attempts.filter(a => a.uid === uid).at(-1);
    students.push({ id: uid, uid, number: i + 1, nickname: nick, difficulty, stage: finished ? 4 : stage, passed,
      view: i === 11 ? 'lobby' : finished ? 'complete' : 'game', hintUsed: passed.map((_, n) => i % 4 === 1 && n === stage - 1),
      failStreak: i % 3 === 0 && !finished ? 3 : 0, attemptsCount: attempts.filter(a => a.uid === uid).length,
      completedCount: finished ? 1 : 0, latestPercent: last ? last.percent : null, latestPass: last ? last.pass : false,
      currentDraft: i % 2 ? '빨간 풍선 하나가 하늘에 떠 있고 아래에 줄이' : '', lastPrompt: last ? last.prompt : '',
      online: i !== 7, lastActive: stamp(now - (i === 7 ? 600000 : 5000)), lastInputAt: stamp(now - (i === 2 ? 180000 : 20000)),
      joinedAt: stamp(now - 31 * 60000) });
  });
  if (students[11]) { students[11].difficulty = null; students[11].passed = null; }
  if (students[5]) { students[5].passed[students[5].stage - 1] = true; students[5].latestPass = true; students[5].latestPercent = 100; } // "통과" 예시
  attempts.sort((a, b) => ms(a.time) - ms(b.time));
  cls = { code: 'DEMO42', name: '미리보기 학급', open: true };
  $('#teacherName').textContent = '미리보기 모드'; $('#teacherName').hidden = false;
  renderShell();
  $('#openToggle').disabled = true;
  document.addEventListener('click', () => { const m = $('#downloadMenu'); if (m) m.hidden = true; });
  tick = setInterval(() => refresh(new Set()), 10000);
}

(async () => {
  if (new URLSearchParams(location.search).has('demo')) return startDemo();
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) return renderSetupNeeded('Firebase 설정이 비어 있어요.');
  if (location.protocol === 'file:') return renderSetupNeeded('파일을 직접 열면 로그인이 되지 않아요.');
  try {
    await loadScript(SDK + 'firebase-app-compat.js');
    await loadScript(SDK + 'firebase-auth-compat.js');
    await loadScript(SDK + 'firebase-firestore-compat.js');
  } catch { return renderSetupNeeded('Firebase를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'); }
  if (!firebase.apps.length) firebase.initializeApp(cfg);
  auth = firebase.auth(); db = firebase.firestore();
  $('#signOut').onclick = () => { stopLive(); auth.signOut(); };
  document.addEventListener('click', () => {
    const m = $('#downloadMenu'); if (m && !m.hidden) { m.hidden = true; $('#downloadBtn').setAttribute('aria-expanded', 'false'); }
  });
  window.addEventListener('hashchange', route);
  auth.onAuthStateChanged(u => {
    user = u && !u.isAnonymous ? u : null;
    if (!user) { stopLive(); return renderLogin(); }
    $('#teacherName').textContent = user.displayName || user.email; $('#teacherName').hidden = false; $('#signOut').hidden = false;
    route();
  });
})();

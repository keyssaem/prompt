/*
  교사 화면 (2단계 확인용 최소 버전)
  - Google 로그인 → 학급 만들기(코드 생성) → 학생 상태 실시간 표
  - 격자 카드 대시보드·내려받기·통계는 3단계에서 이 파일을 확장해요.
*/
'use strict';
const $ = s => document.querySelector(s);
const T = $('#t-app');
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0 O 1 I 제외
const ONLINE_MS = 75000;

let auth, db, user = null, unsubscribe = null, students = [], tick = null;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const loadScript = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); });
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 3500); }
const ms = v => (v && v.toMillis ? v.toMillis() : 0);
function ago(t) {
  if (!t) return '-';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return s + '초 전';
  if (s < 3600) return Math.round(s / 60) + '분 전';
  return new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

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
  } catch (e) { console.warn(e); $('#classList').innerHTML = '<p class="form-error">학급 목록을 불러오지 못했어요. 보안 규칙(firestore.rules)이 배포되었는지 확인해 주세요.</p>'; }
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

function stopLive() { if (unsubscribe) unsubscribe(); unsubscribe = null; clearInterval(tick); tick = null; students = []; }

async function renderClass(code) {
  stopLive();
  let info;
  try { const s = await db.collection('classes').doc(code).get(); info = s.exists ? s.data() : null; } catch (e) { console.warn(e); }
  if (!info || info.teacherUid !== user.uid) { toast('내 학급이 아니거나 없는 코드예요.'); location.hash = ''; return; }
  T.innerHTML = `
  <p><a href="#" class="text-button">← 내 학급 목록</a></p>
  <section class="t-card">
    <div class="t-row" style="justify-content:space-between">
      <div><h1 style="margin:0">${esc(info.name)}</h1><p class="muted" style="margin:0">학생 화면 주소에 접속해 아래 코드를 입력하게 하세요.</p></div>
      <div style="text-align:right"><div class="code code-big">${code}</div>
        <label class="muted"><input type="checkbox" id="openToggle" ${info.open === false ? '' : 'checked'}> 학생 참여 허용</label></div>
    </div>
  </section>
  <section class="t-card">
    <div class="stats" id="stats"></div>
    <div class="table-wrap"><table class="live"><thead><tr><th>접속</th><th>번호</th><th>별명</th><th>난이도</th><th>단계</th><th>점검</th><th>최근</th><th>완료</th><th>쓰는 중 / 마지막 문장</th><th>활동</th></tr></thead><tbody id="rows"><tr><td colspan="10" class="muted">학생이 들어오면 여기에 바로 나타나요.</td></tr></tbody></table></div>
    <p class="muted tiny">3단계에서 카드 격자 대시보드, 학생별 시도 타임라인, 엑셀 내려받기를 추가할 예정이에요.</p>
  </section>`;
  $('#openToggle').onchange = e => db.collection('classes').doc(code).update({ open: e.target.checked }).then(() => toast(e.target.checked ? '참여를 열었어요.' : '참여를 닫았어요.')).catch(() => toast('바꾸지 못했어요.'));
  const prev = new Map();
  unsubscribe = db.collection('classes').doc(code).collection('students').onSnapshot(snap => {
    const changed = new Set(snap.docChanges().filter(c => c.type !== 'removed').map(c => c.doc.id));
    students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    drawRows(changed, prev);
  }, err => { console.warn(err); toast('실시간 연결에 실패했어요. 보안 규칙을 확인해 주세요.'); });
  tick = setInterval(() => drawRows(new Set(), prev), 15000);
}

function drawRows(changed) {
  const now = Date.now();
  const list = students.slice().sort((a, b) => (a.number - b.number) || String(a.nickname).localeCompare(b.nickname));
  const isOn = s => s.online !== false && now - ms(s.lastActive) < ONLINE_MS;
  const on = list.filter(isOn).length;
  const done = list.filter(s => (s.completedCount || 0) > 0).length;
  const tries = list.reduce((a, s) => a + (s.attemptsCount || 0), 0);
  $('#stats').innerHTML = `<div class="stat"><span>${list.length}</span>명 참여</div><div class="stat"><span>${on}</span>명 접속 중</div><div class="stat"><span>${done}</span>명 4단계 완료</div><div class="stat"><span>${tries}</span>번 점검</div>`;
  if (!list.length) return;
  $('#rows').innerHTML = list.map(s => {
    const lv = window.LEVELS[s.difficulty];
    const steps = Array.isArray(s.passed) ? s.passed.map((p, i) => (p ? '✓' : (s.stage === i + 1 ? '▶' : '·'))).join(' ') : '-';
    const text = s.currentDraft || s.lastPrompt || '';
    return `<tr class="${changed.has(s.id) ? 'flash' : ''}">
      <td><span class="dot ${isOn(s) ? 'on' : ''}" title="${isOn(s) ? '접속 중' : '자리 비움'}"></span></td>
      <td>${esc(s.number)}</td><td><b>${esc(s.nickname)}</b></td>
      <td>${lv ? lv.name : '-'}</td>
      <td class="steps">${steps}${s.view === 'complete' ? ' 🎉' : ''}</td>
      <td>${s.attemptsCount || 0}</td>
      <td>${s.latestPercent == null ? '-' : s.latestPercent + '%' + (s.latestPass ? ' ✓' : '')}</td>
      <td>${s.completedCount || 0}</td>
      <td class="draft">${esc(text.length > 120 ? text.slice(0, 120) + '…' : text) || '-'}</td>
      <td class="muted">${ago(ms(s.lastActive))}</td></tr>`;
  }).join('');
}

function route() {
  if (!user) return;
  const code = location.hash.replace('#', '').toUpperCase();
  code ? renderClass(code) : renderClasses();
}

(async () => {
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
  window.addEventListener('hashchange', route);
  auth.onAuthStateChanged(u => {
    user = u && !u.isAnonymous ? u : null;
    if (!user) { stopLive(); return renderLogin(); }
    $('#teacherName').textContent = user.displayName || user.email; $('#teacherName').hidden = false; $('#signOut').hidden = false;
    route();
  });
})();

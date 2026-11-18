/* 학생용 화면: 참여 → 난이도 선택 → 4단계 도전 → 결과 */
'use strict';
const $ = s => document.querySelector(s);
const APP = $('#app');
const LEVELS = window.LEVELS;
const MISSIONS = window.MISSIONS;
const byId = new Map(MISSIONS.map(m => [m.id, m]));
const STATE_PREFIX = 'swysKoStateV1:';

let state = blankState();
let view = 'join';

function blankState() { return { history: [], session: null, last: {}, completed: [] }; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function newId() { const a = new Uint32Array(3); crypto.getRandomValues(a); return Array.from(a, x => x.toString(16).padStart(8, '0')).join(''); }
function imageTag(m, alt, attrs = '') {
  // 실제 사진(assets/photos/{id}.webp)이 있으면 그 사진을, 없으면 SVG 그림을 보여 줘요.
  return `<img src="assets/photos/${m.id}.webp" onerror="this.onerror=null;this.src='assets/svg/${m.id}.svg'" alt="${esc(alt)}" ${attrs}>`;
}
function toast(t) {
  const el = $('#toast'); el.textContent = t; el.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => (el.hidden = true), 3500);
}
function stateKey() { const p = Store.profile; return STATE_PREFIX + p.classCode + ':' + p.number + ':' + p.nickname; }
function save() { try { localStorage.setItem(stateKey(), JSON.stringify(state)); } catch { /* 저장 공간 없음 */ } }
function load() {
  state = blankState();
  try {
    const d = JSON.parse(localStorage.getItem(stateKey()));
    if (d && Array.isArray(d.history)) state = { ...blankState(), ...d };
    const s = state.session;
    if (s && (!LEVELS[s.difficulty] || !Array.isArray(s.ids) || s.ids.some(id => !byId.has(id)))) state.session = null;
  } catch { /* 무시 */ }
}
function selected() { const s = state.session; return byId.get(s.ids[s.current]); }
function scrollTop() { window.scrollTo({ top: 0, behavior: 'auto' }); }

function pickImage(difficulty, stage, avoid) {
  const pool = MISSIONS.filter(m => m.difficulty === difficulty && m.stage === stage);
  const k = difficulty + '-' + stage;
  let bag = pool.filter(m => m.id !== state.last[k] && m.id !== avoid);
  if (!bag.length) bag = pool.filter(m => m.id !== avoid);
  if (!bag.length) bag = pool;
  const r = new Uint32Array(1); crypto.getRandomValues(r);
  const id = bag[r[0] % bag.length].id;
  state.last[k] = id;
  return id;
}

/* 교사 화면으로 보낼 현재 상태 요약 */
function liveStatus(extra = {}) {
  const s = state.session;
  if (!s) return { view, ...extra };
  return {
    view, difficulty: s.difficulty, stage: s.current + 1, missionId: s.ids[s.current],
    passed: s.passed, hintUsed: s.hints, sessionStartedAt: s.startedAt, finished: !!s.finishedAt,
    failStreak: (s.streak || [])[s.current] || 0, ...extra,
  };
}

/* ───────── 화면 전환 ───────── */
function render() {
  updateHeader();
  if (!Store.profile) return renderJoin();
  if (view === 'game' && state.session) return renderGame();
  if (view === 'complete' && state.session && state.session.finishedAt) return renderComplete();
  view = 'lobby';
  renderLobby();
}

function updateHeader() {
  const p = Store.profile;
  $('#whoami').hidden = !p;
  $('#historyButton').hidden = !p;
  $('#leaveButton').hidden = !p;
  if (p) $('#whoami').textContent = (Store.mode === 'cloud' ? (Store.className || p.classCode) + ' · ' : '') + p.number + '번 ' + p.nickname;
  const net = $('#netBadge');
  net.hidden = false;
  if (Store.mode === 'cloud') {
    const on = navigator.onLine;
    net.className = 'net ' + (on ? 'on' : 'off');
    net.textContent = on ? '● 학급 연결됨' : '● 연결 끊김';
  } else {
    net.className = 'net local';
    net.textContent = '혼자 연습 모드';
  }
}

function goHome() {
  if (!Store.profile) return;
  if (view === 'game' && state.session) logDraft('작성 중');
  view = 'lobby'; render(); scrollTop();
  Store.status(liveStatus());
}

/* ───────── 참여 화면 ───────── */
function renderJoin() {
  const cloud = Store.mode === 'cloud';
  const nums = Array.from({ length: 40 }, (_, i) => `<option value="${i + 1}">${i + 1}번</option>`).join('');
  APP.innerHTML = `
  <section class="join-card">
    <span class="eyebrow">한국어로 배우는 이미지 프롬프트</span>
    <h1>자세히 보고,<br><em>내 말로 그려 봐.</em></h1>
    <p class="muted">${cloud ? '선생님이 알려 준 학급 코드와 내 번호, 별명을 입력하세요.' : '번호와 별명을 입력하면 시작할 수 있어요. 기록은 이 기기에만 저장돼요.'}</p>
    <form id="joinForm" class="join-form" autocomplete="off">
      ${cloud ? `<label>학급 코드<input id="classCode" name="classCode" required maxlength="8" placeholder="예: AB12CD" inputmode="latin" autocapitalize="characters"></label>` : ''}
      <label>번호<select id="number" required><option value="">선택</option>${nums}</select></label>
      <label>별명<input id="nickname" required maxlength="10" placeholder="10글자 이하"></label>
      <p class="form-error" id="joinError" role="alert"></p>
      <button class="primary full" id="joinButton">시작하기 →</button>
    </form>
    <p class="tiny muted">실명 대신 별명을 써도 괜찮아요.</p>
  </section>`;
  $('#joinForm').onsubmit = async e => {
    e.preventDefault();
    const number = Number($('#number').value);
    const nickname = $('#nickname').value.replace(/\s+/g, ' ').trim();
    const err = $('#joinError');
    if (!number) return (err.textContent = '번호를 골라 주세요.');
    if (!nickname) return (err.textContent = '별명을 입력해 주세요.');
    const btn = $('#joinButton'); btn.disabled = true; btn.textContent = '확인하는 중…';
    try {
      await Store.join({ classCode: cloud ? $('#classCode').value : '', number, nickname });
      load();
      view = 'lobby';
      render();
      Store.status(liveStatus());
    } catch (ex) {
      const msg = { BAD_CODE: '학급 코드를 다시 확인해 주세요. (영문·숫자 4~8자리)', NO_CLASS: '그런 학급 코드가 없어요. 선생님께 다시 확인해 주세요.', CLOSED: '지금은 이 학급에 참여할 수 없어요.', NETWORK: '인터넷 연결을 확인해 주세요.' }[ex.message];
      err.textContent = msg || '참여하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
      console.warn(ex);
      btn.disabled = false; btn.textContent = '시작하기 →';
    }
  };
}

/* ───────── 난이도 선택 화면 ───────── */
function howTo() {
  return `<section class="how" aria-label="연습 방법">
    <article><b><span>01</span>자세히 보기</b><p>무엇이, 무슨 색으로, 몇 개, 어디에 있는지 찾아요.</p></article>
    <article><b><span>02</span>내 말로 쓰기</b><p>그림을 못 본 사람도 떠올릴 수 있게 설명해요.</p></article>
    <article><b><span>03</span>고쳐 쓰기</b><p>빠진 표현을 찾아 더하면서 더 정확하게 만들어요.</p></article>
  </section>`;
}

function renderLobby() {
  const s = state.session;
  APP.innerHTML = `
  <section class="hero">
    <span class="eyebrow">한국어로 배우는 이미지 프롬프트</span>
    <h1>${esc(Store.profile.nickname)}, 오늘은<br><em>무엇이 보이나요?</em></h1>
    <p class="hero-copy">그림을 자세히 보고, AI가 같은 그림을 그릴 수 있도록 설명해 보세요. 무엇이, 어떤 색으로, 어디에 있는지 쓸수록 프롬프트가 선명해져요.</p>
  </section>
  <section class="definition">
    <div><h2>프롬프트가 뭐예요?</h2><p>AI에게 무엇을 해 달라고 알려 주는 말이에요. 그림을 부탁할 때는 <b>대상 · 색 · 개수 · 위치 · 배경</b>을 담으면 좋아요.</p></div>
    <div class="prompt-example"><small>이렇게 바꿔 볼까요?</small><p class="before">“강아지 그려 줘.”</p><p class="after"><b>→</b> “초록 잔디 위에 앉아 있는 갈색 강아지 한 마리를 그려 줘.”</p></div>
  </section>
  ${s ? `<aside class="resume"><span>${esc(LEVELS[s.difficulty].name)} · ${s.finishedAt ? '지난 도전을 모두 마쳤어요.' : (s.current + 1) + '단계를 하고 있었어요.'}</span><button class="outline compact" id="resume">${s.finishedAt ? '결과 다시 보기' : '이어서 하기'} →</button></aside>` : ''}
  <section aria-labelledby="levelTitle">
    <div class="level-heading"><h2 id="levelTitle">어떤 난이도에 도전할까요?</h2><span class="muted">난이도마다 4단계 · 단계마다 그림이 무작위로 나와요</span></div>
    <div class="level-grid">
      ${Object.entries(LEVELS).map(([k, d]) => `
      <article class="level-card ${k}">
        <div class="card-head"><h3>${d.name}</h3><span class="dots" aria-hidden="true">${d.dots}</span></div>
        <div class="card-body"><p>${d.summary}</p>
          <div class="tagrow">${d.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
          <button class="primary" data-start="${k}">${d.name} 시작하기 →</button>
        </div>
      </article>`).join('')}
    </div>
  </section>
  ${howTo()}`;
  APP.querySelectorAll('[data-start]').forEach(b => (b.onclick = () => start(b.dataset.start)));
  const r = $('#resume');
  if (r) r.onclick = () => { view = state.session.finishedAt ? 'complete' : 'game'; render(); Store.status(liveStatus()); };
}

function start(difficulty) {
  if (state.session && !state.session.finishedAt) logDraft('새 도전 전');
  state.session = {
    difficulty,
    ids: [1, 2, 3, 4].map(n => pickImage(difficulty, n)),
    current: 0,
    drafts: ['', '', '', ''], first: ['', '', '', ''],
    reviews: [null, null, null, null], passed: [false, false, false, false], hints: [false, false, false, false],
    tries: [0, 0, 0, 0], streak: [0, 0, 0, 0],
    startedAt: new Date().toISOString(), finishedAt: null,
  };
  view = 'game'; save(); render(); scrollTop();
  Store.status(liveStatus({ currentDraft: '', latestPercent: null, latestPass: false, lastInputAt: 'now' }));
}

/* ───────── 도전 화면 ───────── */
function unlocked(i) { const s = state.session; return i === 0 || s.passed.slice(0, i).every(Boolean); }

function renderGame() {
  const s = state.session, lv = LEVELS[s.difficulty], i = s.current, st = lv.stages[i], m = selected();
  APP.innerHTML = `
  <div class="game-top">
    <div class="breadcrumb"><span class="pill ${s.difficulty}">${lv.name}</span><span>${i + 1} / 4단계 · ${st.title}</span></div>
    <button class="text-button" id="backLobby">← 난이도 선택</button>
  </div>
  <nav class="progress" aria-label="단계 진행">
    ${lv.stages.map((x, n) => `<button data-stage="${n}" class="${n === i ? 'active' : ''}" ${unlocked(n) ? '' : 'disabled'} ${n === i ? 'aria-current="step"' : ''}><span class="num">${s.passed[n] ? '✓' : '0' + (n + 1)}</span><b>${x.title}</b></button>`).join('')}
  </nav>
  <div class="workspace">
    <section class="panel">
      <div class="panel-head"><span class="panel-label">01 · 그림을 관찰해요</span><small>${lv.name} ${i + 1}단계 그림</small></div>
      <button class="image-button" id="enlarge" aria-label="그림 크게 보기">${imageTag(m, i + 1 + '단계 관찰 그림', 'id="missionImage"')}<span class="expand" aria-hidden="true">⤢</span></button>
      <div class="image-bottom"><span class="muted">그림을 누르면 크게 볼 수 있어요.</span><button class="text-button" id="reroll">다른 그림 ↻</button></div>
    </section>
    <section class="panel">
      <div class="panel-head"><span class="panel-label">02 · 한국어로 설명해요</span><small>힌트를 봐도, 여러 번 고쳐 써도 괜찮아요.</small></div>
      <div class="editor">
        <h1>${st.question}</h1>
        <p class="task">${st.task}</p>
        <div class="chips">${st.chips.map(x => `<span class="chip">${x}</span>`).join('')}</div>
        <label class="input-label" for="prompt">그림을 못 본 친구도 떠올릴 수 있도록 써 보세요.</label>
        <textarea id="prompt" maxlength="1000" placeholder="무엇이 보이나요? 가장 눈에 띄는 것부터 써 보세요.">${esc(s.drafts[i])}</textarea>
        <div class="text-meta"><span>${s.tries[i] ? '점검 ' + s.tries[i] + '번 했어요' : '짧아도 괜찮아요. 구체적으로!'}</span><span id="counter">${s.drafts[i].length} / 1000</span></div>
        <button class="primary full" id="check">내 설명 점검하기 ↗</button>
        <section id="feedback" aria-live="polite"></section>
        <details class="hint" id="hint" ${s.hints[i] ? 'open' : ''}><summary>막막할 땐? 힌트 보기</summary><p>${st.hint}</p></details>
      </div>
    </section>
  </div>`;
  $('#backLobby').onclick = goHome;
  APP.querySelectorAll('[data-stage]').forEach(b => (b.onclick = () => {
    const n = Number(b.dataset.stage);
    if (n === s.current) return;
    logDraft('단계 이동 전');
    s.current = n; save(); renderGame();
    Store.status(liveStatus({ currentDraft: s.drafts[n], latestPercent: s.reviews[n] ? s.reviews[n].percent : null, latestPass: !!s.passed[n], lastInputAt: 'now' }));
  }));
  $('#enlarge').onclick = () => { $('#zoomImage').src = $('#missionImage').src; $('#imageDialog').showModal(); };
  $('#reroll').onclick = reroll;
  $('#prompt').oninput = onType;
  $('#check').onclick = check;
  $('#hint').ontoggle = () => {
    if ($('#hint').open && !s.hints[i]) { s.hints[i] = true; save(); Store.status(liveStatus()); }
  };
  if (s.reviews[i]) renderFeedback(s.reviews[i]);
}

function onType() {
  const s = state.session, i = s.current, v = $('#prompt').value;
  s.drafts[i] = v;
  $('#counter').textContent = v.length + ' / 1000';
  if (s.passed[i] || s.reviews[i]) {
    s.reviews[i] = null; s.passed[i] = false;
    $('#feedback').replaceChildren();
    APP.querySelector(`[data-stage="${i}"] .num`).textContent = '0' + (i + 1);
    APP.querySelectorAll('[data-stage]').forEach(b => (b.disabled = !unlocked(Number(b.dataset.stage))));
    Store.status(liveStatus());
  }
  save();
  Store.draft(v, { stage: i + 1, missionId: s.ids[i] });
}

function reroll() {
  const s = state.session, i = s.current;
  if (s.drafts[i].trim()) { logDraft('그림 바꾸기 전'); toast('쓴 내용은 기록에 남기고 새 그림을 보여 줄게요.'); }
  s.ids[i] = pickImage(s.difficulty, i + 1, s.ids[i]);
  s.drafts[i] = ''; s.first[i] = ''; s.reviews[i] = null; s.passed[i] = false; s.hints[i] = false; s.tries[i] = 0;
  if (s.streak) s.streak[i] = 0;
  save(); renderGame();
  Store.status(liveStatus({ currentDraft: '', latestPercent: null, latestPass: false, lastInputAt: 'now' }));
}

function makeRecord(text, result, type) {
  const s = state.session, i = s.current, m = selected();
  return {
    id: newId(), session: s.startedAt, difficulty: s.difficulty, stage: i + 1,
    missionId: m.id, mission: m.title, prompt: text,
    matches: result.matches, count: result.count, total: result.total, percent: result.percent, pass: result.pass,
    missed: m.criteria.filter((c, n) => !result.matches[n]).map(c => c.label),
    hintUsed: s.hints[i], tryNo: s.tries[i], time: new Date().toISOString(), type,
  };
}

function check() {
  const s = state.session, i = s.current, text = s.drafts[i].trim();
  if (text.length < 5) {
    $('#feedback').innerHTML = '<div class="feedback-box retry"><h2>본 것을 한 문장으로 써 볼까요?</h2><p>다섯 글자 이상 쓰면 핵심 표현을 함께 확인할 수 있어요.</p></div>';
    $('#prompt').focus();
    return;
  }
  const result = evaluatePrompt(text, selected(), Store.passRatio);
  s.tries[i] += 1;
  if (!s.first[i]) s.first[i] = text;
  s.reviews[i] = result;
  if (result.pass) s.passed[i] = true;
  if (!s.streak) s.streak = [0, 0, 0, 0];
  s.streak[i] = result.pass ? 0 : s.streak[i] + 1; // 연속 미통과 횟수 → 교사 화면 "막힘" 표시
  const rec = makeRecord(text, result, '점검');
  state.history.push(rec);
  save();
  Store.attempt(rec, liveStatus({ currentDraft: text, latestPercent: result.percent, latestPass: result.pass, lastPrompt: text, lastInputAt: 'now' }));
  renderFeedback(result);
  $('.text-meta span').textContent = '점검 ' + s.tries[i] + '번 했어요';
  if (result.pass) {
    APP.querySelector(`[data-stage="${i}"] .num`).textContent = '✓';
    APP.querySelectorAll('[data-stage]').forEach(b => (b.disabled = !unlocked(Number(b.dataset.stage))));
  }
}

function renderFeedback(r) {
  const s = state.session, m = selected();
  const need = Math.round(Store.passRatio * 100);
  $('#feedback').innerHTML = `
  <div class="feedback-box ${r.pass ? 'pass' : 'retry'}">
    <h2>${r.pass ? '설명이 선명해졌어요! 🎉' : '조금 더 자세히 써 볼까요?'}</h2>
    <p>핵심 표현 ${r.count} / ${r.total}개 찾음 · ${r.percent}%</p>
    <div class="meter" role="img" aria-label="표현 확인률 ${r.percent}퍼센트"><div style="width:${r.percent}%"></div></div>
    <ul class="feedback-list">${m.criteria.map((c, n) => `<li class="${r.matches[n] ? 'yes' : 'no'}"><span aria-hidden="true">${r.matches[n] ? '✓' : '↗'}</span><span>${esc(r.matches[n] ? c.label + ' 표현을 찾았어요.' : c.hint)}</span></li>`).join('')}</ul>
    ${r.pass ? `<p class="muted">마지막으로 그림과 내 문장을 직접 비교해 보세요.</p><button class="primary full" id="next">${s.current < 3 ? '다음 단계로 →' : '4단계 마무리하기 ✳'}</button>`
             : `<p class="muted">대상 표현은 모두, 전체 표현은 ${need}% 이상 있으면 다음 단계로 갈 수 있어요.</p>`}
  </div>`;
  const next = $('#next');
  if (next) next.onclick = () => {
    if (s.current < 3) { s.current += 1; save(); renderGame(); scrollTop(); Store.status(liveStatus({ currentDraft: s.drafts[s.current], latestPercent: null, latestPass: false, lastInputAt: 'now' })); }
    else complete();
  };
}

function logDraft(type) {
  const s = state.session; if (!s) return;
  const i = s.current, text = s.drafts[i].trim();
  if (!text) return;
  const last = state.history.at(-1);
  if (last && last.session === s.startedAt && last.prompt === text && last.missionId === s.ids[i]) return;
  const rec = makeRecord(text, evaluatePrompt(text, selected(), Store.passRatio), type);
  state.history.push(rec);
  save();
  Store.attempt(rec, liveStatus({ currentDraft: text }));
}

function complete() {
  const s = state.session;
  if (!s.passed.every(Boolean)) return toast('앞 단계부터 차근차근 통과해 주세요.');
  if (!s.finishedAt) {
    s.finishedAt = new Date().toISOString();
    state.completed.push({ difficulty: s.difficulty, ids: [...s.ids], first: [...s.first], drafts: [...s.drafts], finishedAt: s.finishedAt });
    view = 'complete'; save();
    Store.complete(liveStatus({ lastCompletedDifficulty: s.difficulty, lastCompletedAt: s.finishedAt }));
  }
  view = 'complete'; render(); scrollTop();
}

/* ───────── 결과 화면 ───────── */
function renderComplete() {
  const s = state.session, lv = LEVELS[s.difficulty];
  APP.innerHTML = `
  <section class="completion-head">
    <div class="completion-symbol" aria-hidden="true">✳</div>
    <span class="pill ${s.difficulty}">${lv.name} · 4단계 완료</span>
    <h1>보는 눈도, 쓰는 말도 자랐어요!</h1>
    <p class="muted">처음 쓴 문장과 마지막 문장을 비교하며 무엇이 달라졌는지 찾아보세요.</p>
  </section>
  <div class="result-grid">
    ${s.ids.map((id, i) => {
      const m = byId.get(id), r = s.reviews[i];
      return `<article class="result-card">
        <div class="result-head">${imageTag(m, i + 1 + '단계 그림')}<div><small>0${i + 1} · ${lv.stages[i].title}</small><h2>${esc(m.title)}</h2><small>${r ? '핵심 표현 ' + r.count + '/' + r.total + ' · 점검 ' + s.tries[i] + '번' : ''}</small></div></div>
        <small>처음 쓴 설명</small><p class="first">${esc(s.first[i] || s.drafts[i])}</p>
        <small>마지막 설명</small><p class="final">${esc(s.drafts[i])}</p>
      </article>`;
    }).join('')}
  </div>
  <div class="complete-actions">
    <button class="primary" id="again">같은 난이도 다시 도전 ↻</button>
    <button class="outline" id="choose">다른 난이도 고르기</button>
    <button class="outline" id="downloadSession">이번 도전 내려받기 ↓</button>
  </div>`;
  $('#again').onclick = () => start(s.difficulty);
  $('#choose').onclick = goHome;
  $('#downloadSession').onclick = () => download(state.history.filter(x => x.session === s.startedAt));
}

/* ───────── 기록 · 내려받기 ───────── */
function showRecords() {
  const h = state.history;
  $('#recordSummary').textContent = `설명 기록 ${h.length}개 · 4단계 완료 ${state.completed.length}번`;
  $('#recordList').innerHTML = h.length
    ? h.slice().reverse().map(x => `<article class="record-item"><h3>${LEVELS[x.difficulty]?.name || ''} · ${x.stage}단계 · ${esc(x.mission)}</h3><small>${new Date(x.time).toLocaleString('ko-KR')} · ${esc(x.type)} · 표현 ${x.count}/${x.total}${x.pass ? ' · 통과' : ''}${x.hintUsed ? ' · 힌트' : ''}</small><p>${esc(x.prompt)}</p></article>`).join('')
    : '<p class="empty">아직 기록이 없어요.<br>첫 설명을 써 볼까요?</p>';
  $('#downloadAll').disabled = !h.length;
  $('#recordDialog').showModal();
}

function download(records) {
  if (!records.length) return toast('아직 내려받을 기록이 없어요.');
  const p = Store.profile;
  const head = `보이는 걸 말해 봐 — ${p.number}번 ${p.nickname}의 프롬프트 연습 기록\n핵심 표현을 찾아 확인한 기록이에요. (AI 이미지 유사도 점수가 아니에요)\n\n`;
  const body = records.map(x => `${new Date(x.time).toLocaleString('ko-KR')} · ${x.type}\n${LEVELS[x.difficulty]?.name} · ${x.stage}단계 · ${x.mission}\n${x.prompt}\n핵심 표현 ${x.count}/${x.total}${x.pass ? ' · 통과' : ''}${x.hintUsed ? ' · 힌트 사용' : ''}`).join('\n\n────────────\n\n');
  const url = URL.createObjectURL(new Blob(['﻿', head + body], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `보이는걸말해봐_${p.number}번_${p.nickname}.txt`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ───────── 공통 버튼 ───────── */
$('#home').onclick = goHome;
$('#historyButton').onclick = () => { if (view === 'game') logDraft('작성 중'); showRecords(); };
$('#aboutButton').onclick = () => $('#aboutDialog').showModal();
$('#leaveButton').onclick = () => $('#confirmDialog').showModal();
$('#confirmLeave').onclick = () => {
  if (view === 'game') logDraft('나가기 전');
  Store.leave();
  state = blankState(); view = 'join';
  $('#confirmDialog').close();
  render();
};
$('#downloadAll').onclick = () => download(state.history);
document.querySelectorAll('[data-close]').forEach(b => (b.onclick = () => $('#' + b.dataset.close).close()));
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
Store.on('error', toast);
Store.on('net', () => updateHeader());

/* ───────── 시작 ───────── */
(async () => {
  APP.innerHTML = '<p class="loading">불러오는 중…</p>';
  const { warning } = await Store.init();
  if (Store.profile) { load(); view = 'lobby'; }
  render();
  if (warning) toast(warning);
})();

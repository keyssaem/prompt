/*
  Store: 학생 기록을 "어디에" 보낼지 담당해요.
  - 혼자 연습 모드(local): FIREBASE_CONFIG 가 비어 있으면 브라우저에만 저장
  - 학급 모드(cloud): Firebase 익명 로그인 + Firestore 에 실시간 저장 → 교사 화면에서 확인

  Firestore 구조
  classes/{classCode}                    교사가 만든 학급 (name, teacherUid, open, settings)
  classes/{classCode}/students/{uid}     학생 한 명의 현재 상태(요약) — 교사 화면 격자용
  classes/{classCode}/attempts/{autoId}  점검할 때마다 쌓이는 시도 기록 — 내려받기·분석용
*/
'use strict';
window.Store = (() => {
  const PROFILE_KEY = 'swysKoProfileV1';
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const DRAFT_INTERVAL = 4000;   // 쓰는 중인 글은 최대 4초에 한 번만 보내요(무료 사용량 절약)
  const HEARTBEAT = 30000;       // 30초마다 "접속 중" 신호

  let mode = 'local';
  let db = null, auth = null, uid = null;
  let profile = null, classInfo = null;
  let draftTimer = null, pendingDraft = null, lastDraftAt = 0, beatTimer = null;
  let errorShown = false, unwatchClass = null;
  const handlers = { error: () => {}, net: () => {}, settings: () => {} };

  /* 교사가 바꾸는 수업 설정을 실시간으로 받아요 (일시정지·난이도 잠금·통과 기준·시도 제한·예시 보내기) */
  function watchClass() {
    if (unwatchClass) unwatchClass();
    unwatchClass = classRef(profile.classCode).onSnapshot(snap => {
      if (!snap.exists) return;
      classInfo = snap.data();
      handlers.settings(settings());
    }, err => console.warn('[Store] class watch', err));
  }
  function settings() {
    const s = (classInfo && classInfo.settings) || {};
    const allowed = s.allowed || {};
    return {
      paused: s.paused === true,
      allowed: { easy: allowed.easy !== false, medium: allowed.medium !== false, hard: allowed.hard !== false },
      passRatio: typeof s.passRatio === 'number' ? s.passRatio : 0.8,
      maxTries: Number(s.maxTries) || 0, // 0 = 제한 없음
      broadcast: (classInfo && classInfo.broadcast) || null,
    };
  }

  const loadScript = src => new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => no(new Error('SDK_LOAD'));
    document.head.append(s);
  });
  const readProfile = () => { try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY)); return p && p.nickname && (p.number || p.solo || p.mode === 'local') ? p : null; /* 혼자 연습은 번호 없이도 OK */ } catch { return null; } };
  const writeProfile = p => { try { p ? localStorage.setItem(PROFILE_KEY, JSON.stringify(p)) : localStorage.removeItem(PROFILE_KEY); } catch { /* 저장 불가 */ } };
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();
  const inc = n => firebase.firestore.FieldValue.increment(n);
  const classRef = code => db.collection('classes').doc(code);
  const studentRef = () => classRef(profile.classCode).collection('students').doc(uid);
  const base = () => ({ uid, number: profile.number, nickname: profile.nickname });
  const live = () => mode === 'cloud' && !!profile && !profile.solo; // 학급 서버로 기록을 보내는 중인가

  function fail(err) {
    console.warn('[Store]', err);
    if (!errorShown) { errorShown = true; handlers.error('선생님 화면으로 기록을 보내지 못했어요. 인터넷 연결을 확인해 주세요.'); setTimeout(() => (errorShown = false), 15000); }
  }

  async function fetchClass(code) {
    const snap = await classRef(code).get();
    return snap.exists ? snap.data() : null;
  }

  /* 시작할 때 한 번 호출. 반환값: { mode, warning? } */
  async function init() {
    profile = readProfile();
    const cfg = window.FIREBASE_CONFIG;
    const wantCloud = !!(cfg && cfg.apiKey);
    let warning = null;
    if (wantCloud && location.protocol === 'file:') {
      warning = '학급 모드는 웹 주소(https://)로 열어야 해요. 지금은 혼자 연습 모드로 열렸어요.';
    } else if (wantCloud) {
      try {
        await loadScript(SDK + 'firebase-app-compat.js');
        await loadScript(SDK + 'firebase-auth-compat.js');
        await loadScript(SDK + 'firebase-firestore-compat.js');
        if (!firebase.apps.length) firebase.initializeApp(cfg);
        auth = firebase.auth();
        db = firebase.firestore();
        const cred = await auth.signInAnonymously();
        uid = cred.user.uid;
        mode = 'cloud';
      } catch (e) {
        console.warn(e);
        warning = '학급 서버에 연결하지 못해 혼자 연습 모드로 열렸어요. 인터넷 연결을 확인해 주세요.';
      }
    }
    if (profile && !profile.solo && profile.mode !== mode) { profile = null; writeProfile(null); }
    if (profile && !profile.solo && mode === 'cloud') {
      try { classInfo = await fetchClass(profile.classCode); } catch (e) { console.warn(e); }
      if (!classInfo) { profile = null; writeProfile(null); }
      else { profile.uid = uid; writeProfile(profile); startBeat(); watchClass(); status({ online: true }); }
    }
    window.addEventListener('online', () => handlers.net(true));
    window.addEventListener('offline', () => handlers.net(false));
    return { mode, warning };
  }

  /* 학생 참여: 학급 코드 확인 → 학생 문서 만들기 */
  async function join({ classCode, number, nickname, solo }) {
    if (mode === 'local' || solo) { // 학급 코드 없이 혼자 연습: 이 기기에만 저장
      profile = { mode: 'local', solo: mode === 'cloud', classCode: 'LOCAL', number, nickname };
      writeProfile(profile);
      return profile;
    }
    const code = String(classCode || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(code)) throw new Error('BAD_CODE');
    let info;
    try { info = await fetchClass(code); } catch (e) { console.warn(e); throw new Error('NETWORK'); }
    if (!info) throw new Error('NO_CLASS');
    if (info.open === false) throw new Error('CLOSED');
    classInfo = info;
    profile = { mode, classCode: code, number, nickname, uid };
    await studentRef().set({ ...base(), joinedAt: ts(), lastActive: ts(), online: true }, { merge: true });
    writeProfile(profile);
    startBeat();
    watchClass();
    return profile;
  }

  function leave() {
    if (live()) { flushDraft(); status({ online: false }); }
    stopBeat();
    if (unwatchClass) { unwatchClass(); unwatchClass = null; }
    profile = null; classInfo = null;
    writeProfile(null);
  }

  /* 학생 상태(요약) 덮어쓰기 — 교사 화면 격자가 이 값을 실시간으로 봐요 */
  function status(partial) {
    if (!live()) return;
    const data = { ...base(), ...partial, lastActive: ts() };
    // lastInputAt: 'now' → 서버 시각 (교사 화면의 "2분째 입력 없음" 판단에 사용)
    if (data.lastInputAt === 'now') data.lastInputAt = ts();
    studentRef().set(data, { merge: true }).catch(fail);
  }

  /* 쓰는 중인 글: 너무 자주 보내지 않도록 모아서 보내요 */
  function draft(text, meta) {
    if (!live()) return;
    pendingDraft = { currentDraft: String(text).slice(0, 1000), ...meta, lastInputAt: 'now' };
    const wait = DRAFT_INTERVAL - (Date.now() - lastDraftAt);
    if (wait <= 0) flushDraft();
    else if (!draftTimer) draftTimer = setTimeout(flushDraft, wait);
  }
  function flushDraft() {
    clearTimeout(draftTimer); draftTimer = null;
    if (!pendingDraft) return;
    lastDraftAt = Date.now();
    const d = pendingDraft; pendingDraft = null;
    status(d);
  }

  /* 점검 1회 기록 + 요약 갱신 */
  function attempt(rec, summary) {
    if (!live()) return;
    flushDraft();
    classRef(profile.classCode).collection('attempts')
      .add({ ...rec, ...base(), classCode: profile.classCode, createdAt: ts() })
      .catch(fail);
    status({ ...summary, attemptsCount: inc(1) });
  }

  function complete(summary) {
    if (!live()) return;
    status({ ...summary, completedCount: inc(1) });
  }

  function startBeat() {
    stopBeat();
    beatTimer = setInterval(() => { if (document.visibilityState === 'visible') status({ online: true }); }, HEARTBEAT);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
  }
  function stopBeat() {
    clearInterval(beatTimer); beatTimer = null;
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onHide);
  }
  function onVisibility() { flushDraft(); status({ online: document.visibilityState === 'visible' }); }
  function onHide() { flushDraft(); status({ online: false }); }

  return {
    init, join, leave, status, draft, flushDraft, attempt, complete,
    on: (name, fn) => { handlers[name] = fn; },
    get mode() { return profile && profile.solo ? 'local' : mode; }, // 혼자 연습을 고르면 학급 서버로 보내지 않아요
    get cloudAvailable() { return mode === 'cloud'; },
    get profile() { return profile; },
    get passRatio() { return settings().passRatio; },
    get settings() { return settings(); },
    get className() { return classInfo ? classInfo.name : ''; },
  };
})();

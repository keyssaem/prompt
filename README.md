# 보이는 걸 말해 봐 · 우리 반 프롬프트 교실

그림을 보고 한국어로 설명(프롬프트)을 쓰는 연습 웹앱이에요. 선생님은 학생들의 과정을 실시간 대시보드로 보며 수업을 이끌어요.

- 학생 화면: `https://keyssaem.github.io/prompt/`
- 교사 화면: `https://keyssaem.github.io/prompt/teacher.html` (미리보기: `teacher.html?demo`)
- **교사용 사용 설명서: [`guide.html`](guide.html)** ← 수업에서 쓰는 방법은 여기에 모두 있어요.
- **6학년 활동지(A4 2쪽): [`worksheet.html`](worksheet.html)**, 인쇄용 [`활동지_보이는걸말해봐_6학년.pdf`](활동지_보이는걸말해봐_6학년.pdf)
  - 앞장: 웹앱 미션 그림을 보고 처음 쓰기 → 스스로 점검 → 고쳐 쓰기, 웹앱 도전 기록
  - 뒷장: 웹앱 규칙을 분석해 교육용 게임을 설계하고, 빈칸 공식으로 바이브코딩 프롬프트 완성
  - 교사 화면의 🖨 활동지로 열면 QR에 학급 코드가 들어가요. (`worksheet.html?code=학급코드`)

## 기능
| 단계 | 기능 |
|---|---|
| 1 | 학생 연습: 난이도 3 × 4단계, 그림 24장, 핵심 표현 점검·힌트·처음/마지막 비교 |
| 2 | 학급 참여(코드·QR), 익명 로그인, Firestore 실시간 기록 |
| 3 | 교사 대시보드: 카드 격자, 상태(작성 중·통과·막힘·완료·대기), 학생별 기록, 엑셀·CSV·인쇄 |
| 4 | 수업 제어(일시정지·난이도 잠금·통과 기준·점검 횟수 제한), 좋은 예시 보내기(이름 가림), 놓친 표현 비율·교수 포인트, 전자칠판 큰 화면·이름 가리기 |
| 6 | 보안 규칙 강화, 30명 동시 접속 시험, 학생·학급 기록 지우기, 교사용 사용 설명서 |

## 폴더 구조
```
index.html            학생 화면
teacher.html          교사 대시보드
guide.html            교사용 사용 설명서
css/style.css         공통 디자인
css/teacher.css       교사 화면 디자인
js/missions.js        관찰 미션 24개 (난이도 3 × 단계 4 × 그림 2)  ← 문제 추가·수정은 여기
js/levels.js          난이도·단계 문구, 점검(채점), 형광펜 표시, 교수 포인트 문구
js/store.js           기록 저장 + 선생님 설정 실시간 수신 (혼자 연습 모드 / 학급 모드)
js/app.js             학생 화면 동작
js/teacher.js         교사 화면 동작
js/firebase-config.js Firebase 설정 (비우면 혼자 연습 모드)
firestore.rules       데이터 보안 규칙  ← 바꾸면 Firebase 콘솔에 다시 게시해야 해요
firebase.json         Firebase Hosting 배포 설정 (선택)
assets/svg/           기본 그림 (직접 그린 SVG)
assets/photos/        실제 사진을 넣는 곳 (선택)
```

## 처음 설치 (Firebase, 무료 Spark 요금제로 충분)
1. https://console.firebase.google.com 에서 **프로젝트 만들기**를 해요.
2. **Authentication → 로그인 방법**에서 **익명**과 **Google**을 사용 설정해요.
3. **Firestore Database**를 만들어요(위치 `asia-northeast3 (서울)`, 프로덕션 모드).
4. Firestore **규칙** 탭에 `firestore.rules` 내용을 붙여 넣고 **게시**해요.
5. **프로젝트 설정 → 내 앱 → 웹 앱(</>)** 을 추가하고, 나온 `firebaseConfig` 값을 `js/firebase-config.js`의 `window.FIREBASE_CONFIG = { ... }`에 넣어요.
6. GitHub Pages(저장소 Settings → Pages → `main` / root)로 올리고, **Authentication → 설정 → 승인된 도메인**에 `keyssaem.github.io`를 추가해요.

## Firestore에 쌓이는 데이터
```
classes/{학급코드}                 name, teacherUid, open, settings{paused, allowed, passRatio, maxTries}, broadcast(보낸 예시)
classes/{학급코드}/students/{uid}  번호, 별명, 접속, 난이도, 단계, 통과, 쓰는 중인 글, 연속 미통과, 마지막 입력 시각, 점검 수, 완료 수
classes/{학급코드}/attempts/{id}   점검할 때마다 1개: 문장, 찾은/놓친 표현, %, 통과, 힌트, 몇 번째 시도, 시각
```

## 보안 규칙 요약 (`firestore.rules`)
- 학생(익명): 학급 문서 1개 읽기, **자기 상태 문서만** 쓰기(번호 1~40, 별명 1~10자, 글 1000자 이하), 시도 기록 **추가만** 가능
- 학생은 다른 학생 기록, 학급 목록 보기, 학급 설정 바꾸기가 모두 막혀 있어요. (실제 계정으로 시험함)
- 교사(Google): 자기가 만든 학급만 읽기·고치기·지우기

## 30명 동시 접속 시험 (2026-11-18)
가상 학생 30명이 각자 익명 계정으로 동시에 참여하고, 2분 동안 4초마다 글을 쓰고 12초마다 점검했어요.
- 참여 30/30, 쓰기 1,140회, **오류 0**
- 쓰기 지연: 중간값 71ms, 95%가 126ms 이내, 최대 274ms
- 교사 대시보드에 1초 안에 반영, 31명 화면 다시 그리기 1~4ms
- 참고: Firebase는 같은 인터넷 주소(IP)에서 새 익명 계정을 시간당 약 100개까지 만들 수 있어요. 학생 기기는 한 번 만든 계정을 계속 쓰니 여러 반이 이어서 써도 보통 문제없어요.

## 그림을 실제 사진으로 바꾸기
`assets/photos/{id}.webp` 파일을 넣으면 SVG 대신 그 사진이 나와요. 예: `assets/photos/e1a.webp`
`js/missions.js`의 `scene`(영어)을 이미지 생성 도구에 넣으면 비슷한 사진을 만들 수 있어요.

## 문제 추가·수정
`js/missions.js`에서 미션을 추가해요. 각 단계에 그림이 2장 이상 있어야 "다른 그림" 버튼이 동작해요.
`criteria`의 `pattern`은 정규식이에요. `|`는 "또는", `빨[간강갛]`은 빨간·빨강·빨갛을 모두 찾아요.

# 보이는 걸 말해 봐 · 우리 반 프롬프트 교실

그림을 보고 한국어로 설명(프롬프트)을 쓰는 연습 웹앱이에요.
지금 완성된 범위: **1단계(학생 연습 앱) + 2단계(학급 참여와 실시간 기록 저장)**.
교사용 격자 대시보드, 내려받기, 통계는 3단계에서 만들 예정이에요.

## 폴더 구조
```
index.html            학생 화면
teacher.html          교사 화면 (2단계 확인용 최소 버전: 로그인 · 학급 만들기 · 실시간 표)
css/style.css         공통 디자인
css/teacher.css       교사 화면 디자인
js/missions.js        관찰 미션 24개 (난이도 3 × 단계 4 × 그림 2)  ← 문제 추가·수정은 여기
js/levels.js          난이도·단계 안내 문구, 점검(채점) 함수
js/store.js           기록 저장 담당 (혼자 연습 모드 / 학급 모드)
js/app.js             학생 화면 동작
js/teacher.js         교사 화면 동작
js/firebase-config.js Firebase 설정 (비우면 혼자 연습 모드)
firestore.rules       데이터 보안 규칙
firebase.json         Firebase Hosting 배포 설정
assets/svg/           기본 그림 (직접 그린 SVG)
assets/photos/        실제 사진을 넣는 곳 (선택)
```

## 두 가지 모드
| | 혼자 연습 모드 | 학급 모드 |
|---|---|---|
| 조건 | `firebase-config.js`가 비어 있음 | Firebase 설정 입력 + https 주소로 열기 |
| 참여 | 번호 + 별명 | 학급 코드 + 번호 + 별명 |
| 기록 | 이 기기 브라우저에만 저장 | 브라우저 + Firestore (교사 화면에 실시간 표시) |
| 실행 | 웹 주소로 열기 (아래 참고) | 웹 주소로 배포 |

> `index.html`을 더블클릭해 `file://`로 열어도 대부분 동작하지만, 브라우저에 따라 기록 저장이 막힐 수 있어요. 웹 주소로 여는 것을 권장해요.

## 학급 모드 켜기 (Firebase, 무료 Spark 요금제로 충분)
1. https://console.firebase.google.com 에서 **프로젝트 만들기**를 해요. Google 애널리틱스는 꺼도 돼요.
2. **Authentication → 로그인 방법**에서 **익명**과 **Google**을 사용 설정해요.
3. **Firestore Database → 데이터베이스 만들기**를 해요. 위치는 `asia-northeast3 (서울)`, 모드는 프로덕션을 골라요.
4. Firestore의 **규칙** 탭에 `firestore.rules` 내용을 붙여 넣고 **게시**해요.
5. **프로젝트 설정 → 내 앱 → 웹 앱(</>) 추가**를 하면 나오는 `firebaseConfig` 값을 `js/firebase-config.js`에 붙여 넣어요.
6. 웹에 올려요. 아래 둘 중 하나를 고르세요.
   - **Netlify Drop**(설치 없음): https://app.netlify.com/drop 에 이 폴더를 끌어다 놓아요.
   - **Firebase Hosting**: Node.js를 설치한 뒤 `npm i -g firebase-tools` → `firebase login` → `firebase init`(기존 파일 유지) → `firebase deploy`
7. Netlify처럼 Firebase가 아닌 주소에 올렸다면 **Authentication → 설정 → 승인된 도메인**에 그 주소를 추가해요.
8. `주소/teacher.html`에서 Google로 로그인하고 학급을 만들어요. 화면에 나온 **학급 코드**를 학생에게 알려 줘요.

### 테스트할 때 주의
- 같은 브라우저에서 교사 로그인과 학생 참여를 함께 하면 로그인 정보가 섞여요. 학생 화면은 **다른 브라우저나 시크릿 창**에서 열어 주세요.
- 무료 사용량은 하루 쓰기 2만 회예요. 학생 30명이 40분 수업을 하면 대략 3~6천 회라서 충분해요. 쓰는 중인 글은 4초에 한 번만 보내도록 해 두었어요.

## Firestore에 쌓이는 데이터
```
classes/{학급코드}                 name, teacherUid, open(참여 허용), settings.passRatio(통과 기준, 기본 0.8)
classes/{학급코드}/students/{uid}  번호, 별명, 접속 여부, 난이도, 단계, 통과 표시, 쓰는 중인 글, 점검 수, 최근 %, 완료 수
classes/{학급코드}/attempts/{id}   점검할 때마다 1개: 문장, 찾은 표현, 놓친 표현, %, 통과 여부, 힌트 사용, 몇 번째 시도, 시각
```
- 학생은 자기 문서만 쓸 수 있고, 다른 학생의 기록은 읽을 수 없어요.
- 학생 실명 대신 번호와 별명만 저장해요.

## 그림을 실제 사진으로 바꾸기
`assets/photos/{id}.webp` 파일을 넣으면 SVG 대신 그 사진이 나와요. 예: `assets/photos/e1a.webp`
`js/missions.js`의 각 미션에 있는 `scene`(영어)을 Gemini나 ImageFX 같은 이미지 생성 도구에 넣으면 비슷한 사진을 만들 수 있어요.

## 문제 추가·수정
`js/missions.js`에서 미션을 추가해요. 각 단계에 그림이 2장 이상 있어야 "다른 그림" 버튼이 동작해요.
`criteria`의 `pattern`은 정규식이에요. `|`는 "또는"이라는 뜻이고, `빨[간강갛]`은 빨간·빨강·빨갛을 모두 찾아요.

## 다음 단계 (3단계 예정)
- 교사 대시보드: 학생 카드 격자, 상태 색(작성 중 / 통과 / 막힘 / 힌트), 학생별 시도 타임라인
- 내려받기: 학급 전체 CSV·엑셀, 학생별 처음/마지막 비교
- 자주 놓친 표현 통계

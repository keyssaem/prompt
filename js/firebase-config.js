/*
  Firebase 설정
  - 비워 두면(null) "혼자 연습 모드"로 동작해요. 기록은 이 기기 브라우저에만 남아요.
  - Firebase 프로젝트를 만든 뒤 아래 예시처럼 값을 채우면 "학급 모드"가 켜지고,
    학생 기록이 실시간으로 교사 화면(teacher.html)에 모여요.
  - 이 값들은 공개되어도 괜찮은 웹 설정값이에요. 실제 보호는 firestore.rules 가 맡아요.
  - 설정 방법은 README.md 를 보세요.
*/
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAW-hJymHFyxWoXS86FfYHSw4XJu1G3d6w",
  authDomain: "prompt-4a653.firebaseapp.com",
  projectId: "prompt-4a653",
  storageBucket: "prompt-4a653.firebasestorage.app",
  messagingSenderId: "902656090366",
  appId: "1:902656090366:web:2c21410d723da62112c5af",
  measurementId: "G-XQYXXHGXVD"
};

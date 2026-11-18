/* 난이도와 단계 설정 (학생 화면, 교사 화면에서 함께 사용) */
window.LEVELS = {
  easy: {
    name: '쉬움', dots: '● ○ ○',
    summary: '한눈에 보이는 것부터 하나씩 말해요.',
    tags: ['무엇과 색', '개수와 놓인 모양', '장소와 행동'],
    stages: [
      { title: '대상과 색', question: '무엇이 보이나요?', task: '그림의 주인공이 무엇인지, 무슨 색인지 써 보세요.', chips: ['무엇', '색', '눈에 띄는 부분'], hint: '주인공 이름을 먼저 쓰고, 색깔과 함께 붙어 있는 작은 부분도 찾아보세요.' },
      { title: '개수와 놓인 모양', question: '몇 개가, 어떻게 있나요?', task: '하나씩 세어 보고, 어떻게 놓여 있는지 써 보세요.', chips: ['무엇', '색', '몇 개', '놓인 모양'], hint: '손가락으로 하나씩 세어 보세요. 옆으로 줄을 섰나요, 위로 쌓였나요?' },
      { title: '장소와 행동', question: '어디에서 무엇을 하나요?', task: '주인공이 있는 곳과 하고 있는 일을 함께 써 보세요.', chips: ['주인공', '색', '장소', '행동'], hint: '주인공 뒤와 아래를 살펴보세요. 주인공은 움직이고 있나요, 멈춰 있나요?' },
      { title: '자리와 보는 방향', question: '어디서 바라본 모습인가요?', task: '주인공이 화면 어디에, 얼마나 크게 있는지와 바라본 방향을 써 보세요.', chips: ['배경', '자리', '크기', '보는 방향'], hint: '주인공이 가운데 있나요? 앞에서 봤나요, 위에서 내려다봤나요?' },
    ],
  },
  medium: {
    name: '중간', dots: '● ● ○',
    summary: '두 대상을 구별하고 서로의 관계를 말해요.',
    tags: ['두 대상 구별', '위·아래·안', '빛과 날씨'],
    stages: [
      { title: '두 대상 구별하기', question: '둘은 무엇이 다른가요?', task: '두 대상을 모두 쓰고, 각각의 색을 나누어 써 보세요.', chips: ['대상 1', '대상 2', '각각의 색'], hint: '“○○는 □색, △△는 ◇색”처럼 하나씩 따로 써 보세요.' },
      { title: '서로의 자리', question: '무엇이 어디에 있나요?', task: '두 대상의 위·아래, 안·밖, 크기를 비교해 써 보세요.', chips: ['개수', '위와 아래', '안과 밖', '크기'], hint: '어느 것이 더 큰가요? 어느 것이 다른 것 위나 안에 있나요?' },
      { title: '장면과 날씨', question: '어떤 순간인가요?', task: '장소와 행동에 빛이나 날씨 단서를 더해 써 보세요.', chips: ['장소', '행동', '빛', '날씨'], hint: '하늘 색, 떨어지는 물방울처럼 시간과 날씨를 알려 주는 단서를 찾아보세요.' },
      { title: '찍은 각도와 거리', question: '어떻게 바라본 그림인가요?', task: '가까이서 봤는지, 어느 방향에서 봤는지, 주인공이 어디에 있는지 써 보세요.', chips: ['위치', '거리', '보는 각도', '배경'], hint: '올려다봤나요, 멀리서 봤나요? 주인공은 화면 왼쪽인가요, 오른쪽인가요?' },
    ],
  },
  hard: {
    name: '어려움', dots: '● ● ●',
    summary: '작은 차이까지 찾아 정확하게 말해요.',
    tags: ['재질과 무늬', '정확한 배열', '초점과 여백'],
    stages: [
      { title: '재질과 무늬', question: '만지면 어떤 느낌일까요?', task: '무엇으로 만들어졌는지, 표면과 무늬가 어떤지 써 보세요.', chips: ['재질', '표면 느낌', '무늬', '색'], hint: '유리, 나무, 천 중 무엇인가요? 반짝이나요, 투명한가요, 무늬가 있나요?' },
      { title: '정확한 배열', question: '몇 개가 어떤 모양으로 있나요?', task: '전체 개수, 줄과 층, 앞뒤와 크기 관계를 정확히 써 보세요.', chips: ['전체 개수', '줄·층', '앞과 뒤', '크기 차이'], hint: '전부 몇 개인지 먼저 세고, 줄이나 층별로 나누어 설명해 보세요.' },
      { title: '작은 변화 찾기', question: '무슨 일이 일어나고 있나요?', task: '주인공의 움직임, 주변에 생긴 작은 변화, 빛의 방향을 써 보세요.', chips: ['움직임', '주변 변화', '빛의 방향', '관계'], hint: '퍼지는 물결, 펼친 날개, 비추는 햇빛처럼 눈에 보이는 증거를 찾아보세요.' },
      { title: '초점과 여백', question: '그림을 어떻게 구성했나요?', task: '선명한 곳과 흐린 곳, 빈 공간, 주인공의 자리를 써 보세요.', chips: ['초점', '흐림', '여백', '화면 속 자리'], hint: '가장 또렷한 곳은 어디인가요? 비어 있는 넓은 공간이 있나요?' },
    ],
  },
};

/* 핵심 표현 점검: 대상 표현은 모두 + 전체의 passRatio 이상 */
window.evaluatePrompt = function (prompt, mission, passRatio) {
  const ratio = typeof passRatio === 'number' ? passRatio : 0.8;
  const text = String(prompt).normalize('NFKC').replace(/\s+/g, ' ').trim();
  const matches = mission.criteria.map(c => new RegExp(c.pattern, 'u').test(text));
  const count = matches.filter(Boolean).length;
  const total = mission.criteria.length;
  const keysOk = mission.criteria.every((c, i) => !c.key || matches[i]);
  return { matches, count, total, percent: Math.round(count / total * 100), pass: keysOk && count / total >= ratio };
};

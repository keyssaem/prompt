/*
  관찰 미션 데이터 (직접 제작)
  - id: 이미지 파일 이름과 같아요. assets/photos/{id}.webp 가 있으면 그 사진을, 없으면 assets/svg/{id}.svg 그림을 보여 줘요.
  - scene: 실제 사진을 AI로 새로 만들 때 쓸 영어 프롬프트(참고용)
  - criteria: 학생 문장에서 찾을 핵심 표현
      label  : 화면에 보이는 이름
      pattern: 찾을 표현(정규식, | 는 "또는")
      hint   : 표현을 못 찾았을 때 보여 줄 도움말
      key    : true 이면 꼭 써야 통과(주인공·대상)
*/
(function () {
  const COLOR = {
    red: ['색 · 빨강', '빨[간강갛]|붉|레드'],
    yellow: ['색 · 노랑', '노[란랑랗]|샛노|황색|옐로'],
    blue: ['색 · 파랑', '파[란랑랗]|푸른색|하늘색|청색|남색|블루'],
    green: ['색 · 초록', '초록|녹색|연두|풀색|그린'],
    orange: ['색 · 주황', '주황|오렌지색|귤색'],
    pink: ['색 · 분홍', '분홍|핑크'],
    white: ['색 · 하양', '흰|하얀|하양|백색'],
  };
  const key = (name, pattern) => ({ label: '대상 · ' + name, pattern, hint: `사진의 주인공 ‘${name}’을(를) 꼭 써 보세요.`, key: true });
  const color = (c, hint) => ({ label: COLOR[c][0], pattern: COLOR[c][1], hint: hint || '보이는 색깔을 구체적으로 써 보세요.' });
  const item = (label, pattern, hint) => ({ label, pattern, hint });

  const CENTER = '가운데|중앙|한가운데|중간';
  const BOX = '상자|박스';

  window.MISSIONS = [
    // ───────── 쉬움 ─────────
    { id: 'e1a', difficulty: 'easy', stage: 1, title: '노란 우산',
      scene: 'One open bright yellow umbrella with a curved brown J-shaped handle, centered on a plain warm ivory background, front view.',
      criteria: [key('우산', '우산|양산'), color('yellow'), item('특징 · 손잡이', '손잡이|갈고리|구부러|휘어', '아래쪽 손잡이 모양도 살펴보세요.')] },
    { id: 'e1b', difficulty: 'easy', stage: 1, title: '빨간 풍선',
      scene: 'One shiny red balloon with a thin dangling string, centered on a pale sky-blue background.',
      criteria: [key('풍선', '풍선'), color('red'), item('특징 · 줄', '줄|끈|실', '풍선 아래에 무엇이 달려 있나요?')] },
    { id: 'e2a', difficulty: 'easy', stage: 2, title: '파란 컵 세 개',
      scene: 'Exactly three identical blue mugs standing side by side in one row on a light wooden table, front view.',
      criteria: [key('컵', '컵|잔'), color('blue'), item('개수 · 세 개', '세 ?[개잔]|셋|3', '컵이 모두 몇 개인지 세어 보세요.'), item('배치 · 나란히', '나란히|한 ?줄|옆으로|줄지어|일렬', '컵이 어떻게 줄을 서 있나요?')] },
    { id: 'e2b', difficulty: 'easy', stage: 2, title: '쌓인 초록 책',
      scene: 'Two green hardcover books stacked on top of each other on a wooden table, plain ivory wall behind.',
      criteria: [key('책', '책'), color('green'), item('개수 · 두 권', '두 ?[권개]|둘|2', '책이 몇 권인지 세어 보세요.'), item('배치 · 쌓임', '쌓|포개|겹|위에', '책이 어떻게 놓여 있나요?')] },
    { id: 'e3a', difficulty: 'easy', stage: 3, title: '헤엄치는 물고기',
      scene: 'One orange fish swimming in clear blue water with bubbles and green seaweed, sandy bottom.',
      criteria: [key('물고기', '물고기|금붕어|생선|열대어'), color('orange', '물고기의 색을 써 보세요.'), item('배경 · 물속', '물|바다|어항|수족관', '물고기가 있는 곳은 어디인가요?'), item('행동 · 헤엄', '헤엄|수영|떠다|움직', '물고기는 무엇을 하고 있나요?')] },
    { id: 'e3b', difficulty: 'easy', stage: 3, title: '나뭇가지 위 파랑새',
      scene: 'One small blue bird perched on a brown tree branch with a few green leaves, soft pale green background.',
      criteria: [key('새', '새(?!로|롭|벽|싹|끼)|파랑새|참새'), color('blue', '새의 색을 써 보세요.'), item('배경 · 나뭇가지', '나뭇가지|가지|나무', '새 아래에 무엇이 있나요?'), item('행동 · 앉음', '앉|서 ?있|올라|쉬', '새는 어떤 자세인가요?')] },
    { id: 'e4a', difficulty: 'easy', stage: 4, title: '하늘 앞 해바라기',
      scene: 'One large sunflower filling the center of the frame against a bright blue sky with small clouds, straight-on eye-level view.',
      criteria: [key('해바라기', '해바라기|꽃'), item('배경 · 하늘', '하늘', '꽃 뒤에는 무엇이 보이나요?'), item('위치 · 가운데', CENTER, '꽃이 화면 어디에 있나요?'), item('크기 · 크게', '크[게고다]|커다|가득', '꽃이 크게 보이나요, 작게 보이나요?'), item('시점 · 정면', '정면|앞에서|앞모습|눈높이|마주', '꽃을 어느 방향에서 바라봤나요?')] },
    { id: 'e4b', difficulty: 'easy', stage: 4, title: '위에서 본 도넛',
      scene: 'Top-down view of one pink-glazed donut with colorful sprinkles on a white plate, centered, on a wooden table.',
      criteria: [key('도넛', '도넛|도너츠|도나쓰'), item('배경 · 접시', '접시|그릇', '도넛 아래에 무엇이 있나요?'), item('위치 · 가운데', CENTER, '도넛이 화면 어디에 있나요?'), item('시점 · 위에서', '위에서|내려다|위쪽에서|위로부터', '어느 방향에서 바라본 모습인가요?')] },

    // ───────── 중간 ─────────
    { id: 'm1a', difficulty: 'medium', stage: 1, title: '사과와 바나나',
      scene: 'One red apple on the left and one yellow banana on the right, on a light table, plain cream background.',
      criteria: [key('사과', '사과'), key('바나나', '바나나'), color('red', '사과의 색을 따로 써 보세요.'), color('yellow', '바나나의 색을 따로 써 보세요.')] },
    { id: 'm1b', difficulty: 'medium', stage: 1, title: '연필과 지우개',
      scene: 'One green wooden pencil lying diagonally and one pink eraser below right, on a pale blue-gray background.',
      criteria: [key('연필', '연필'), key('지우개', '지우개'), color('green', '연필의 색을 따로 써 보세요.'), color('pink', '지우개의 색을 따로 써 보세요.')] },
    { id: 'm2a', difficulty: 'medium', stage: 2, title: '상자 위의 공',
      scene: 'One small red ball resting on top of one large brown cardboard box, plain beige background.',
      criteria: [key('상자', BOX), key('공', '공(?!간|기|부|책|룡|원|장|짜)|볼(?!펜)'), color('red', '공의 색을 써 보세요.'), item('위치 · 위', '위에|위로|올려|얹', '공은 상자의 어디에 있나요?'), item('크기 · 큰/작은', '큰|작은|커다|조그', '두 대상 중 무엇이 더 큰가요?')] },
    { id: 'm2b', difficulty: 'medium', stage: 2, title: '바구니 속 오렌지',
      scene: 'Exactly three oranges sitting inside a woven brown basket, front view, warm cream background.',
      criteria: [key('바구니', '바구니|광주리|소쿠리'), key('오렌지', '오렌지|귤|한라봉'), item('개수 · 세 개', '세 ?개|셋|3', '오렌지가 몇 개인지 세어 보세요.'), item('안 · 담김', '안에|안쪽|속에|담겨|담긴|들어', '오렌지는 바구니의 어디에 있나요?')] },
    { id: 'm3a', difficulty: 'medium', stage: 3, title: '노을 속 돛단배',
      scene: 'A small sailboat with white sails moving across the sea at sunset, orange and purple sky, sun touching the horizon.',
      criteria: [key('배', '배(?!경|고|꼽|추)|돛단배|요트|보트'), item('배경 · 바다', '바다|물|호수', '배가 떠 있는 곳은 어디인가요?'), item('행동 · 떠감', '떠|항해|나아|지나|움직|가고', '배는 무엇을 하고 있나요?'), item('빛 · 노을', '노을|해질|해 ?질|석양|저녁|해가 지|일몰', '하늘 색을 보면 언제쯤일까요?')] },
    { id: 'm3b', difficulty: 'medium', stage: 3, title: '비 오는 날 개구리',
      scene: 'A green frog sitting on a lily pad in a pond on a rainy day, raindrops falling, gray sky.',
      criteria: [key('개구리', '개구리'), color('green', '개구리의 색을 써 보세요.'), item('배경 · 연잎/연못', '연잎|잎|연못|물', '개구리 아래에 무엇이 있나요?'), item('날씨 · 비', '비가|비 ?오|빗|비 내|소나기|비를|비 ?맞', '하늘에서 무엇이 내리고 있나요?'), item('행동 · 앉음', '앉|쉬|올라', '개구리는 어떤 자세인가요?')] },
    { id: 'm4a', difficulty: 'medium', stage: 4, title: '올려다본 건물',
      scene: 'Low-angle worm’s-eye view looking straight up between tall buildings toward a blue sky.',
      criteria: [key('건물', '건물|빌딩|아파트|타워'), item('각도 · 올려다봄', '올려다|아래에서|밑에서|아래쪽에서|우러러', '어느 쪽에서 바라본 모습인가요?'), item('배경 · 하늘', '하늘', '건물 사이로 무엇이 보이나요?'), item('특징 · 높음', '높|솟|고층', '건물이 얼마나 높아 보이나요?')] },
    { id: 'm4b', difficulty: 'medium', stage: 4, title: '멀리 있는 나무',
      scene: 'Wide shot of green rolling fields under a light blue sky, one tiny tree far away on the left side.',
      criteria: [key('나무', '나무'), item('위치 · 왼쪽', '왼쪽|좌측', '나무는 화면의 어느 쪽에 있나요?'), item('거리 · 멀리', '멀리|먼 |저 ?멀리|작게|조그', '나무가 가까이 있나요, 멀리 있나요?'), item('배경 · 들판', '들판|풀밭|언덕|초원|잔디', '나무 주변 땅은 어떤 모습인가요?')] },

    // ───────── 어려움 ─────────
    { id: 'h1a', difficulty: 'hard', stage: 1, title: '유리병 속 구슬',
      scene: 'A clear glass jar with a metal lid filled with shiny blue glass marbles, on a beige table, soft light.',
      criteria: [key('병', '병|단지|항아리'), key('구슬', '구슬|비즈'), item('재질 · 유리/투명', '유리|투명|비치', '병은 무엇으로 만들어졌나요? 안이 보이나요?'), item('질감 · 반짝임', '반짝|빛나|윤기|매끈|매끄|광택', '구슬 표면은 어떤 느낌인가요?'), color('blue', '구슬의 색을 써 보세요.')] },
    { id: 'h1b', difficulty: 'hard', stage: 1, title: '체크무늬 천',
      scene: 'A red and white gingham checkered cloth laid at an angle on a wooden table with visible wood grain, top view.',
      criteria: [key('천', '천|식탁보|손수건|보자기|테이블보'), item('재질 · 나무', '나무|원목|목재', '천 아래 탁자는 무엇으로 만들어졌나요?'), item('무늬 · 체크', '체크|격자|바둑판|네모 ?무늬|격자무늬', '천에 어떤 무늬가 있나요?'), color('red', '무늬에 쓰인 색을 써 보세요.'), color('white', '무늬에 쓰인 또 다른 색을 써 보세요.')] },
    { id: 'h2a', difficulty: 'hard', stage: 2, title: '두 줄로 놓인 상자',
      scene: 'Five boxes in two rows: three small yellow boxes in the front row and two large blue boxes in the back row, front view.',
      criteria: [key('상자', BOX), item('전체 수 · 다섯', '다섯|5', '상자가 전부 몇 개인가요?'), item('배열 · 두 줄', '두 ?줄|2 ?줄|두 ?열|앞줄|뒷줄', '상자가 몇 줄로 놓여 있나요?'), item('앞과 뒤', '앞|뒤', '어떤 상자가 앞에 있고, 어떤 상자가 뒤에 있나요?'), item('크기 관계', '큰|작은|커다|조그|크고', '앞 상자와 뒤 상자의 크기를 비교해 보세요.'), color('yellow'), color('blue')] },
    { id: 'h2b', difficulty: 'hard', stage: 2, title: '블록 피라미드',
      scene: 'Six toy blocks stacked as a pyramid: three blue on the bottom, two green in the middle, one red on top.',
      criteria: [key('블록', '블록|블럭|큐브|나무토막|정육면체|상자'), item('전체 수 · 여섯', '여섯|6', '블록이 전부 몇 개인가요?'), item('배열 · 층', '층|피라미드|삼각형|계단|탑|쌓', '블록이 어떤 모양으로 쌓여 있나요?'), item('위치 · 맨 위/아래', '맨 ?위|꼭대기|제일 위|맨 ?아래|바닥|가장 위', '맨 위와 맨 아래에는 무엇이 있나요?'), color('red'), color('green'), color('blue')] },
    { id: 'h3a', difficulty: 'hard', stage: 3, title: '빗방울과 물결',
      scene: 'Close view of a rain puddle on dark asphalt, raindrops falling and making circular ripples, sky reflected in the water.',
      criteria: [key('웅덩이', '웅덩이|물'), item('움직임 · 떨어짐', '떨어|튀|내리', '하늘에서 무엇이 어떻게 오고 있나요?'), item('물방울', '빗방울|물방울|비', '떨어지는 것이 무엇인가요?'), item('주변 변화 · 물결', '물결|파문|동그라미|원|퍼지|퍼져|동심원', '물 위에 어떤 모양이 생겼나요?'), item('빛 · 반사', '반사|비치|비쳐|거울', '물 위에 무엇이 비치고 있나요?')] },
    { id: 'h3b', difficulty: 'hard', stage: 3, title: '햇살 속 나비',
      scene: 'An orange butterfly with wings spread wide resting on a pink flower, sunlight coming from the top right corner.',
      criteria: [key('나비', '나비'), key('꽃', '꽃'), item('움직임 · 날개 펼침', '날개.{0,10}(펼|활짝|벌)|(펼|활짝|벌).{0,10}날개', '나비의 날개는 어떤 모양인가요?'), item('빛의 방향', '오른쪽 ?위|햇빛|햇살|빛이|해가', '빛은 어디에서 비추고 있나요?'), item('관계 · 꽃 위', '위에|앉|올라', '나비와 꽃은 어떤 관계인가요?')] },
    { id: 'h4a', difficulty: 'hard', stage: 4, title: '선명한 튤립',
      scene: 'Close-up of one red tulip in sharp focus in the left foreground, background softly blurred with green and pastel bokeh.',
      criteria: [key('꽃', '꽃|튤립'), color('red', '꽃의 색을 써 보세요.'), item('초점 · 선명', '선명|또렷|뚜렷|초점', '가장 또렷한 부분은 어디인가요?'), item('흐림 · 배경', '흐릿|흐리|흐린|뿌옇|번져|블러|아웃포커스', '뒤쪽 배경은 어떻게 보이나요?'), item('거리 · 가까이', '가까|가깝|앞쪽|앞에|크게', '꽃은 가까이 있나요, 멀리 있나요?')] },
    { id: 'h4b', difficulty: 'hard', stage: 4, title: '넓은 하늘의 연',
      scene: 'Minimal composition: wide empty blue sky filling most of the frame, a tiny red kite in the upper right, thin strip of green hill at the bottom.',
      criteria: [key('연', '연(?!못|필|기|습|결|두|잎|꽃|락|극|구|주|휴)|가오리연'), item('여백 · 빈 하늘', '여백|비어|빈|넓은 하늘|텅|하늘이 넓', '화면에 비어 있는 공간이 있나요?'), item('위치 · 오른쪽 위', '오른쪽 ?위|우측 ?상단|오른쪽 위쪽', '연은 화면의 어느 쪽에 있나요?'), item('크기 · 작게', '작[게은]|조그', '연은 크게 보이나요, 작게 보이나요?'), item('배경 · 언덕', '언덕|풀밭|들판|초원|잔디', '화면 아래에는 무엇이 보이나요?')] },
  ];
})();

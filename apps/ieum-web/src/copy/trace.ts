// 변환 과정(로그 상세 · 테스트 실행 결과) 문구 — 옛 js/common/convert.js:166-183 · js/menu/logs.js:46 원문 그대로.
// 단계 데이터는 app/trace/buildTraceSteps가 만들고, 그리는 쪽은 이 문구를 단계에서 받는다

export const TRACE = Object.freeze({
  /** 1단계 제목. 조사 "가"는 고정이다 — 라벨이 받침으로 끝나도 그대로 둔다(convert.js:169) */
  aiPicked: (label: string) => `${label}가 도구를 골랐습니다`,
  /** 모델 목록에 그 클라이언트도 mcp도 없을 때의 라벨(convert.js:168) */
  aiFallback: 'AI',
  /** 1단계 코드 아래 안내(convert.js:170) */
  modelNote: '모델마다 도구 호출 형식이 다릅니다. 2단계부터는 어떤 모델이든 같은 원본 요청으로 바뀝니다.',
  ieumConverted: '이음이 원본 요청으로 바꿨습니다',
  /** 소요 칩 — 쉼표 없는 원값 그대로(convert.js:178,180) */
  ms: (n: number) => `${n}ms`,
  /** 2단계 고정 칩과 그 툴팁(convert.js:179) */
  authInject: '인증 정보 주입',
  authInjectDesc: '원본 시스템 인증 정보를 이음 보관소에서 꺼내 넣습니다',
  sourceReplied: '원본 시스템이 응답했습니다',
  aiResult: 'AI가 읽기 쉬운 결과로 바꿨습니다',
  /** 성공 단계 보조 글(convert.js:181) */
  json: 'JSON',
  /** 성공 단계에 그릴 규칙 칩이 없을 때의 고정 칩 — 툴팁이 없다(convert.js:182) */
  nameFallback: '이름 정리',
  failed: '호출에 실패했습니다',
  /** 실패 단계 보조 글(convert.js:183) */
  error: '오류',
});

export type RuleText = Readonly<{ label: string; description: string }>;

/** 변환 규칙 17종의 이름 · 설명(옛 js/common/rules.js:2-20). 분류(색)는 app/trace/ruleChip */
export const RULES = Object.freeze({
  name: { label: '이름 정리', description: '원본 필드 이름을 AI가 이해하기 쉬운 이름으로 바꿉니다' },
  keep: { label: '그대로', description: '값을 바꾸지 않고 전달합니다' },
  date: { label: '날짜 형식', description: 'YYYYMMDD, epoch 같은 원본 형식과 ISO 8601 날짜를 서로 바꿉니다' },
  time: { label: '시각 형식', description: 'HHMM 형식을 HH:MM으로 바꿉니다' },
  num: { label: '숫자 변환', description: '문자열로 온 숫자를 숫자 타입으로 바꿉니다' },
  code: { label: '코드값 변환', description: '원본 코드값과 AI가 읽는 값을 코드표로 서로 바꿉니다' },
  geo: { label: '지역명 변환', description: '지역명을 원본 시스템이 요구하는 좌표나 지역 코드로 바꿉니다' },
  unit: { label: '단위 변환', description: '만 원 단위 금액 문자열을 원 단위 숫자로 바꿉니다' },
  strip: { label: 'HTML 정리', description: 'HTML 태그를 지우고 텍스트만 남깁니다' },
  md: { label: '서식 변환', description: 'AI가 쓴 마크다운을 원본이 받는 HTML로 바꿉니다' },
  filter: { label: '결과 필터', description: '원본에는 없는 조건으로, 응답에서 필요한 부분만 골라냅니다' },
  inject: { label: '자동 주입', description: 'AI에게 보이지 않고 이음이 설정값을 넣어 보냅니다' },
  page: { label: '페이지 수집', description: '이음이 여러 페이지를 모두 받아 하나로 합칩니다' },
  calc: { label: '자동 계산', description: '요청 시각을 기준으로 이음이 값을 계산해 넣습니다' },
  ctx: { label: '로그인 사용자', description: 'AI를 쓰는 사용자 정보를 이음이 넣어 보냅니다' },
  pad: { label: '자릿수 맞춤', description: '한 자리 숫자를 두 자리로 맞춰 보냅니다' },
  mask: { label: '마스킹', description: '개인정보 일부를 가려서 AI에 전달합니다' },
} satisfies Record<string, RuleText>);

/** 표에 있는 규칙 키 17종 */
export type RuleKey = keyof typeof RULES;

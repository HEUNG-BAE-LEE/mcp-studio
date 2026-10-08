// 변환 과정 단계 데이터 — buildTraceSteps가 만들고 변환 과정 보기(ui)가 그린다. 그리는 데 필요한 것을 문자열 · 수로만 담는다
import type { RuleKey } from '../../copy/trace';

/** 코드 상자 언어. 객체는 이미 JSON 글(2칸 들여쓰기)로 바뀌어 온다 */
export type CodeLang = 'json' | 'xml' | 'http' | 'plain';

export type TraceCode = Readonly<{
  text: string;
  lang: CodeLang;
  /**
   * http 글의 본문 언어 — 처음 나오는 빈 줄('\n\n')에서 머리와 본문을 나누고, 본문이 '<'로 시작하면(앞뒤 공백 제외) xml,
   * 아니면 json이다. 본문이 빈 글이면 없다(옛 hlHTTP — js/common/convert.js:148-158). http가 아니면 없다
   */
  bodyLang?: 'json' | 'xml';
}>;

/** 규칙 칩 색 분류 — 옛 클래스 nm · cv · ij · mk(js/common/rules.js:2-20 두 번째 값) */
export type RuleCategory = 'name' | 'convert' | 'inject' | 'mask';

export type TraceChip = Readonly<{
  /** 규칙 키. 고정 칩("인증 정보 주입" · 그릴 칩이 없을 때의 "이름 정리")에는 없다 */
  rule?: RuleKey;
  label: string;
  /** 툴팁 설명. 없으면 툴팁 · 도움말 커서가 없다(고정 "이름 정리") */
  description?: string;
  category: RuleCategory;
}>;

/**
 * 단계 머리. who는 제목 옆 보조 글이다(실패 단계는 "오류"). msLabel은 소요 칩 글자이고 null이면 칩을 그리지 않는다 —
 * ui가 문구 파일을 읽지 않도록 글자를 미리 만들어 둔다. 번호 원은 hold가 아닌 단계만 1부터 센다(옛 traceHTML — js/common/convert.js:186-196)
 */
type StepHead = Readonly<{ title: string; who: string; msLabel: string | null }>;

/** 1단계 — AI가 보낸 도구 호출. 원 색 ai. 코드 아래에 안내(note)를 정보 아이콘과 함께 */
export type AiStep = StepHead & Readonly<{ kind: 'ai'; ms: null; code: TraceCode; note: string }>;

/** 이음 단계 — 원본 요청 변환(ms 있음) · 결과 변환(ms 없음). 원 색 기본. 규칙 칩 줄 다음 코드 */
export type IeumStep = StepHead & Readonly<{ kind: 'ieum'; ms: number | null; chips: readonly TraceChip[]; code: TraceCode }>;

/** 원본 응답 단계. 원 색 source */
export type SourceStep = StepHead & Readonly<{ kind: 'src'; ms: number; code: TraceCode }>;

/** 실패 단계 — 경고 알림 하나에 서버 문장(빈 글일 수 있음). 원 색은 이음 단계와 같은 기본이다(옛 k:'ieum') */
export type FailStep = StepHead & Readonly<{ kind: 'fail'; ms: null; error: string }>;

/** 사용자 확인 대기(테스트 실행이 채운다). 번호를 세지 않는다. 본문(승인 상자)은 그리는 쪽의 슬롯이고 args는 보낸 인자다 */
export type HoldStep = StepHead & Readonly<{ kind: 'hold'; ms: null; args: Readonly<Record<string, unknown>> }>;

export type TraceStep = AiStep | IeumStep | SourceStep | FailStep | HoldStep;

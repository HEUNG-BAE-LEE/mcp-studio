// 카탈로그 TraceView 절 — 성공(ai → ieum → src → ieum) · 실패(빈 서버 문장 포함) · 사용자 확인 대기(hold — 번호를 세지 않음) × 그릇(box · drawer).
// 단계 데이터는 앱 층(buildTraceSteps)과 같은 모양으로 여기서 직접 만든다 — 글자는 copy/trace 그대로
import { Button, TraceView } from '../../ui';
import { httpCode, httpRequestText, httpResponseText } from '../../app/trace/httpText';
import { modelCall } from '../../app/trace/modelCall';
import { AUTH_INJECT_CHIP, NAME_FALLBACK_CHIP, ruleChips } from '../../app/trace/ruleChip';
import type { AiStep, FailStep, HoldStep, IeumStep, SourceStep, TraceStep } from '../../app/trace/types';
import { TRACE } from '../../copy/trace';
import catalog from './catalog.module.css';
import styles from './TraceViewSection.module.css';

const ARGS = { empNo: '20240117', year: 2026 };

const AI_STEP: AiStep = {
  kind: 'ai',
  title: TRACE.aiPicked('Claude'),
  who: 'get_employee',
  ms: null,
  msLabel: null,
  code: { text: JSON.stringify(modelCall('claude', 'get_employee', ARGS), null, 2), lang: 'json' },
  note: TRACE.modelNote,
};

const REQUEST_STEP: IeumStep = {
  kind: 'ieum',
  title: TRACE.ieumConverted,
  who: 'SOAP 1.1',
  ms: 3,
  msLabel: TRACE.ms(3),
  chips: [...ruleChips(['date', 'code', 'inject']), AUTH_INJECT_CHIP],
  code: httpCode(
    httpRequestText({
      method: 'POST',
      url: '/hr/EmployeeService?wsdl=1&ver=2',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'getEmployee' },
      body: '<soap:Envelope><soap:Body><getEmployee empNo="20240117"/></soap:Body></soap:Envelope>',
    }),
  ),
};

const RESPONSE_STEP: SourceStep = {
  kind: 'src',
  title: TRACE.sourceReplied,
  who: '인사 시스템',
  ms: 182,
  msLabel: TRACE.ms(182),
  code: httpCode(
    httpResponseText({
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
      body: '<!-- 원본 응답 -->\n<getEmployeeResponse><name>홍길동</name><joined>20240117</joined></getEmployeeResponse>',
    }),
  ),
};

const RESULT_STEP: IeumStep = {
  kind: 'ieum',
  title: TRACE.aiResult,
  who: TRACE.json,
  ms: null,
  msLabel: null,
  chips: [NAME_FALLBACK_CHIP],
  code: { text: JSON.stringify({ name: '홍길동', joinedAt: '2024-01-17', retired: false }, null, 2), lang: 'json' },
};

const failStep = (error: string): FailStep => ({ kind: 'fail', title: TRACE.failed, who: TRACE.error, ms: null, msLabel: null, error });

const HOLD_STEP: HoldStep = { kind: 'hold', title: '사용자 확인', who: '쓰기 작업', ms: null, msLabel: null, args: ARGS };

const SUCCESS: readonly TraceStep[] = [AI_STEP, REQUEST_STEP, RESPONSE_STEP, RESULT_STEP];
const FAILED: readonly TraceStep[] = [AI_STEP, REQUEST_STEP, failStep('원본 시스템이 500 응답을 돌려줬습니다: Internal Server Error')];
const FAILED_EMPTY: readonly TraceStep[] = [AI_STEP, failStep('')];
const HOLDING: readonly TraceStep[] = [AI_STEP, HOLD_STEP];

export function TraceViewSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        단계 머리는 title · who · msLabel(오른쪽 소요 칩, null이면 없음)만 그린다. 번호 원은 hold가 아닌 단계만 1부터 세고 색은 ai
        · src · hold가 단계 쪽 색, 이음 · 실패 단계는 기본이다. 코드 상자의 이름은 그 단계 제목이다. 입장 모션은 없다.
      </p>

      <h3 className={catalog.heading}>성공 — box</h3>
      <div className={styles.box}>
        <TraceView steps={SUCCESS} container="box" />
      </div>

      <h3 className={catalog.heading}>실패 — drawer(바깥 여백 없음)</h3>
      <div className={`${catalog.frame} ${styles.fit}`}>
        <TraceView steps={FAILED} container="drawer" />
      </div>

      <h3 className={catalog.heading}>실패 — 빈 서버 문장</h3>
      <div className={`${catalog.frame} ${styles.fit}`}>
        <TraceView steps={FAILED_EMPTY} container="drawer" />
      </div>

      <h3 className={catalog.heading}>사용자 확인 대기 — hold(번호 대신 user 아이콘 · 본문은 holdSlot)</h3>
      <div className={styles.box}>
        <TraceView
          steps={HOLDING}
          container="box"
          holdSlot={
            <div className={styles.hold}>
              <b>이 작업을 실행할까요?</b>
              <div className={catalog.row}>
                <Button variant="primary" size="sm">
                  실행
                </Button>
                <Button size="sm">그만두기</Button>
              </div>
            </div>
          }
        />
      </div>

      <h3 className={catalog.heading}>빈 단계 목록</h3>
      <p className={catalog.note}>
        steps가 비면 빈 목록이다 — 변환 과정이 없을 때는 쓰는 곳이 EmptyState를 그린다(로그 상세 panel · 테스트 실행 area).
      </p>
      <div className={`${catalog.frame} ${styles.fit}`}>
        <TraceView steps={[]} container="drawer" />
      </div>
    </div>
  );
}

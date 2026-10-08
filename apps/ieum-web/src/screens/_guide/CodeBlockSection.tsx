// 카탈로그 CodeBlock 절 — 언어 다섯(json · xml · http · java · plain) × http 본문(json · xml · 없음), java 경계, 변형 log, 빈 글 · 긴 줄 · 최대 높이.
// 상자는 Tab으로 닿고(안쪽 링) 이름은 labelledBy(보이는 소제목) 또는 label이다
import { useId } from 'react';
import { CodeBlock } from '../../ui';
import { httpCode } from '../../app/trace/httpText';
import catalog from './catalog.module.css';
import styles from './CodeBlockSection.module.css';

const JSON_TEXT = JSON.stringify(
  { name: 'get_employee', arguments: { empNo: '20240117', year: 2026, ratio: -0.5, active: true, manager: null } },
  null,
  2,
);

const XML_TEXT = `<?xml version="1.0" encoding="UTF-8"?>
<!-- 인사 조회 응답 <emp/> -->
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <getEmployeeResponse empNo="20240117" dept="인사팀">
      <name>홍길동</name>
      <joined/>
    </getEmployeeResponse>
  </soap:Body>
</soap:Envelope>`;

const HTTP_REQUEST = httpCode(`POST /hr/api/employees?dept=HR&year=2026 HTTP/1.1
Content-Type: application/json
Authorization: Bearer ****

{
  "empNo": "20240117",
  "includeRetired": false
}`);

const HTTP_RESPONSE_XML = httpCode(`HTTP/1.1 200
Content-Type: text/xml; charset=utf-8

<getEmployeeResponse empNo="20240117"><name>홍길동</name></getEmployeeResponse>`);

const HTTP_QUERY_LINES = httpCode(`GET /openapi/weather/getVilageFcst HTTP/1.1
    ?serviceKey=****
    &base_date=20261008
    &nx=60
Accept: application/json`);

// 자동 탐색 근거의 소스 조각 모양(시연 구매관리 PoController.poList + 주석 한 줄)
const JAVA_SNIPPET = `    @RequestMapping(value = "/poList.do", method = RequestMethod.GET)
    public @ResponseBody Map<String, Object> poList(@ModelAttribute("searchVO") PoSearchVO searchVO) throws Exception {
        // 발주 목록 — 기간 · 거래처 조건으로 조회
        Map<String, Object> result = new HashMap<String, Object>();
        result.put("list", poService.selectPoList(searchVO));
        result.put("RSLT", "0000");
        return result;
    }`;

// 옛 hlJava와 같은 경계 — 먼저 시작한 것이 이긴다 · 낱말 경계 · 문자 리터럴 '"'은 따로 보지 않아 다음 "까지 문자열이 된다
const JAVA_EDGE = `String url = "http://erp.local/po"; // 문자열 안 //는 문자열
// 주석 안 "문자열" · public · @Override도 주석
private static final List<? extends PoVO> ROWS = new ArrayList<>();
if (newValue != null) { return className; } else { return ""; }
char quote = '"'; String next = "다음 따옴표까지";`;

const LOG_TEXT = Array.from(
  { length: 40 },
  (_, i) =>
    `2026-10-08 09:${String(i).padStart(2, '0')}:00 INFO  uvicorn.access 127.0.0.1 "POST /mcp/ HTTP/1.1" 200 — 아주 긴 줄은 log 변형에서 접힌다 ${'x'.repeat(i * 3)}`,
).join('\n');

const LONG_LINE = JSON.stringify({ description: '줄바꿈 없음 — 긴 줄은 상자 안에서 가로 스크롤한다. '.repeat(6) });

export function CodeBlockSection() {
  const ids = {
    json: useId(),
    xml: useId(),
    request: useId(),
    response: useId(),
    query: useId(),
    java: useId(),
    javaEdge: useId(),
    plain: useId(),
    empty: useId(),
    long: useId(),
  };
  const titled = (id: string, title: string) => (
    <p id={id} className={catalog.frameLabel}>
      {title}
    </p>
  );
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        --surface-sub 상자 · 고정폭 · 줄바꿈 없음 · 최대 높이 420(넘치면 상자 안 스크롤). 강조는 옛 하이라이터와 같은 자리에서
        나눈다 — JSON 키 · 문자열 · 수 · 예약 값, XML 주석 · 태그 · 속성, HTTP 메서드 · 쿼리 키 · 헤더 이름, Java 줄 주석 · 문자열 ·
        @이름 · 예약어. 상자는 Tab으로 닿고 안쪽 링이 보인다. 상태는 없다.
      </p>

      <h3 className={catalog.heading}>json · xml · plain</h3>
      <div className={styles.grid}>
        <div className={styles.cell}>
          {titled(ids.json, 'json — labelledBy')}
          <CodeBlock code={{ text: JSON_TEXT, lang: 'json' }} labelledBy={ids.json} />
        </div>
        <div className={styles.cell}>
          {titled(ids.xml, 'xml — 주석 안 태그도 칠한다')}
          <CodeBlock code={{ text: XML_TEXT, lang: 'xml' }} labelledBy={ids.xml} />
        </div>
        <div className={styles.cell}>
          {titled(ids.plain, 'plain — 나누지 않는다')}
          <CodeBlock code={{ text: 'tools/call get_employee {"empNo": "20240117"}', lang: 'plain' }} labelledBy={ids.plain} />
        </div>
      </div>

      <h3 className={catalog.heading}>http — 본문 json · xml · 쿼리 이어진 줄(본문 없음)</h3>
      <div className={styles.grid}>
        <div className={styles.cell}>
          {titled(ids.request, 'http 요청 + json 본문')}
          <CodeBlock code={HTTP_REQUEST} labelledBy={ids.request} />
        </div>
        <div className={styles.cell}>
          {titled(ids.response, 'http 응답 + xml 본문')}
          <CodeBlock code={HTTP_RESPONSE_XML} labelledBy={ids.response} />
        </div>
        <div className={styles.cell}>
          {titled(ids.query, 'http 쿼리 이어진 줄')}
          <CodeBlock code={HTTP_QUERY_LINES} labelledBy={ids.query} />
        </div>
      </div>

      <h3 className={catalog.heading}>java — 자동 탐색 근거의 소스 조각 · 경계</h3>
      <div className={styles.grid}>
        <div className={styles.cell}>
          {titled(ids.java, 'java 소스 조각')}
          <CodeBlock code={{ text: JAVA_SNIPPET, lang: 'java' }} labelledBy={ids.java} />
        </div>
        <div className={styles.cell}>
          {titled(ids.javaEdge, "java 경계 — 문자열 안 // · 주석 안 예약어 · 낱말 경계 · 문자 리터럴 '\"'")}
          <CodeBlock code={{ text: JAVA_EDGE, lang: 'java' }} labelledBy={ids.javaEdge} />
        </div>
      </div>

      <h3 className={catalog.heading}>빈 글 · 긴 줄 · log 변형(label)</h3>
      <div className={styles.cell}>
        {titled(ids.empty, '빈 글 — 여백만 남는다')}
        <CodeBlock code={{ text: '', lang: 'json' }} labelledBy={ids.empty} />
      </div>
      <div className={styles.cell}>
        {titled(ids.long, '긴 줄 — 가로 스크롤')}
        <CodeBlock code={{ text: LONG_LINE, lang: 'json' }} labelledBy={ids.long} />
      </div>
      <div className={styles.cell}>
        <p className={catalog.frameLabel}>log — 강조 없음 · 긴 줄 접음 · 최대 높이 56vh</p>
        <CodeBlock code={{ text: LOG_TEXT, lang: 'plain' }} variant="log" label="인사 도구 서버 로그" />
      </div>
    </div>
  );
}

// 카탈로그 CompareGrid 절 — 두 칸(source · tool 캡션 + CodeBlock), 캡션 단독(traffic + 보조 글 + id → CodeBlock labelledBy), 색 네모 셋.
// 760 이하 한 열은 뷰어 폭을 바꿔 본다
import { useId } from 'react';
import { httpCode } from '../../app/trace/httpText';
import { CodeBlock, CompareCaption, CompareGrid, type CompareTone } from '../../ui';
import catalog from './catalog.module.css';
import styles from './CompareGridSection.module.css';

const TONES: readonly CompareTone[] = ['source', 'tool', 'traffic'];
const TONE_LABEL: Readonly<Record<CompareTone, string>> = {
  source: '원본 응답',
  tool: 'AI에게 전달하는 결과',
  traffic: '캡처한 요청 · 응답',
};

const SOURCE_RESPONSE = httpCode(`HTTP/1.1 200
Content-Type: application/json

{
  "ORD_NO": "A-20261008-0017",
  "ORD_STS": "02",
  "ORD_DT": "20261008"
}`);

const TOOL_RESULT = {
  text: JSON.stringify({ orderNo: 'A-20261008-0017', status: 'shipped', orderedAt: '2026-10-08' }, null, 2),
  lang: 'json',
} as const;

const TRAFFIC_REQUEST = httpCode(`GET /api/orders/search?dept=HR&year=2026 HTTP/1.1
Accept: application/json
Authorization: Bearer ****`);

const TRAFFIC_RESPONSE = httpCode(`HTTP/1.1 200
Content-Type: application/json

{ "total": 3 }`);

export function CompareGridSection() {
  const ids = { source: useId(), tool: useId(), request: useId(), response: useId() };
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        같은 일의 두 쪽을 나란히. 두 칸은 같은 폭(최소 0)이고 760 이하에서 한 열이 된다. 칸마다 CompareCaption + CodeBlock을 쓰는 곳이
        넣고, 캡션 id를 CodeBlock labelledBy로 잇는다. 색 네모는 장식(aria-hidden)이고 뜻은 캡션 글이 전한다.
      </p>

      <h3 className={catalog.heading}>두 칸 — source · tool</h3>
      <CompareGrid>
        <div>
          <CompareCaption tone="source" id={ids.source}>
            원본 응답
          </CompareCaption>
          <CodeBlock code={SOURCE_RESPONSE} labelledBy={ids.source} />
        </div>
        <div>
          <CompareCaption tone="tool" id={ids.tool}>
            AI에게 전달하는 결과
          </CompareCaption>
          <CodeBlock code={TOOL_RESULT} labelledBy={ids.tool} />
        </div>
      </CompareGrid>

      <h3 className={catalog.heading}>캡션 단독 — traffic · 보조 글 · 둘째 캡션 위 여백은 쓰는 곳</h3>
      <div className={styles.standalone}>
        <CompareCaption tone="traffic" id={ids.request} description="관찰 3건 중 1건">
          캡처한 요청
        </CompareCaption>
        <CodeBlock code={TRAFFIC_REQUEST} labelledBy={ids.request} />
        <CompareCaption tone="traffic" id={ids.response} className={styles.second}>
          캡처한 응답
        </CompareCaption>
        <CodeBlock code={TRAFFIC_RESPONSE} labelledBy={ids.response} />
      </div>

      <h3 className={catalog.heading}>색 네모 — tone 셋</h3>
      <div className={catalog.row}>
        {TONES.map((tone) => (
          <CompareCaption key={tone} tone={tone} description="보조 글">
            {TONE_LABEL[tone]}
          </CompareCaption>
        ))}
      </div>
    </div>
  );
}

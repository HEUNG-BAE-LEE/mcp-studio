// 미리보기 — 소절 제목 오른쪽 탭 셋(MCP 도구 정의 · 원본 요청 · 응답 변환)과 탭 자리 하나(옛 previewHTML — js/menu/studio.js:52-56,113-116)
// 고른 탭은 도구 · 메뉴를 옮겨도 남고 새로고침이면 MCP 도구 정의다(app/studio/studioUi). 세 탭 모두 초안을 덮은 도구에서 바로 만든다
// (옛은 입력 중에 MCP 탭만 다시 그렸다 — 이식 기간 허용 차이). 생성기 출력은 옛 화면과 글자 단위로 같다(app/convert — _meta 확인 표시 포함, 보존).
// 코드 상자의 이름은 새 문구 없이 탭 글자(정의 · 요청) · 칸 머리 글자(응답 변환 두 칸)를 가리킨다. 탭에 화살표 키 이동은 두지 않는다(옛 그대로)
import { useId } from 'react';
import type { Source, Tool } from '../../api/types';
import { aiResult } from '../../app/convert/aiResult';
import { jsonText } from '../../app/convert/jsonText';
import { mcpDef } from '../../app/convert/mcpDef';
import { origReq } from '../../app/convert/origReq';
import { origResp } from '../../app/convert/origResp';
import { PREVIEW_TABS, setPreviewTab, usePreviewTab, type PreviewTab } from '../../app/studio/studioUi';
import { httpCode } from '../../app/trace/httpText';
import { STUDIO } from '../../copy/studio';
import {
  CodeBlock,
  CompareCaption,
  CompareGrid,
  HelpText,
  SectionTitle,
  SegmentedTabPanel,
  SegmentedTabs,
  type SegmentedItem,
} from '@/ui';

const V = STUDIO.preview;
/** 탭 · 패널 id 앞부분 — 화면에 미리보기는 하나다 */
const TABS_ID = 'studio-preview';
const tabIdOf = (tab: PreviewTab) => `${TABS_ID}-tab-${tab}`;

const TAB_ITEMS: readonly SegmentedItem[] = PREVIEW_TABS.map((tab) => ({ value: tab, label: V.tabs[tab] }));

const isPreviewTab = (value: string): value is PreviewTab => (PREVIEW_TABS as readonly string[]).includes(value);

type PreviewSectionProps = Readonly<{ tool: Tool; source: Source }>;

function ResponseCompare({ tool, source }: PreviewSectionProps) {
  const originId = useId();
  const resultId = useId();
  return (
    <CompareGrid>
      <>
        <CompareCaption tone="source" id={originId}>
          {V.origResp}
        </CompareCaption>
        <CodeBlock code={httpCode(origResp(tool, source))} labelledBy={originId} />
      </>
      <>
        <CompareCaption tone="tool" id={resultId}>
          {V.aiResult}
        </CompareCaption>
        <CodeBlock code={{ text: jsonText(aiResult(tool)), lang: 'json' }} labelledBy={resultId} />
      </>
    </CompareGrid>
  );
}

function PreviewBody({ tab, tool, source }: PreviewSectionProps & Readonly<{ tab: PreviewTab }>) {
  if (tab === 'req') {
    return (
      <>
        <CodeBlock code={httpCode(origReq(tool, source))} labelledBy={tabIdOf(tab)} />
        <HelpText variant="note">{V.reqNote}</HelpText>
      </>
    );
  }
  if (tab === 'res') return <ResponseCompare tool={tool} source={source} />;
  return (
    <>
      <CodeBlock code={{ text: jsonText(mcpDef(tool)), lang: 'json' }} labelledBy={tabIdOf(tab)} />
      <HelpText variant="note">{V.mcpNote}</HelpText>
    </>
  );
}

export function PreviewSection({ tool, source }: PreviewSectionProps) {
  const tab = usePreviewTab();
  return (
    <div>
      <SectionTitle
        level="sub"
        title={V.title}
        actions={
          <SegmentedTabs
            idPrefix={TABS_ID}
            items={TAB_ITEMS}
            value={tab}
            onValueChange={(value) => {
              if (isPreviewTab(value)) setPreviewTab(value);
            }}
          />
        }
      />
      <SegmentedTabPanel idPrefix={TABS_ID} value={tab}>
        <PreviewBody tab={tab} tool={tool} source={source} />
      </SegmentedTabPanel>
    </div>
  );
}

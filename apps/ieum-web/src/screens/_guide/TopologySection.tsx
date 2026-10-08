// 카탈로그 Topology 절 — 기본(원본 상태 넷 + 모르는 값) · 긴 이름 말줄임 · AI 영역 실패(aiSlot ErrorBlock) · 빈 목록.
// 원본 노드는 버튼이다 — 누르면 아래 줄에 onSourceClick이 받은 id가 보인다. 뷰어 폭을 1100 이하로 바꾸면 한 열 세로가 된다
import { Fragment, useState } from 'react';
import {
  ErrorBlock,
  SourceStatus,
  Topology,
  type TopologyAiNode,
  type TopologyLabels,
  type TopologySourceNode,
} from '../../ui';
import catalog from './catalog.module.css';

const LABELS: TopologyLabels = {
  aiHeading: 'AI 모델, 에이전트',
  aiCallsHeading: '24시간 호출',
  aiCallsTitle: '최근 24시간 호출',
  aiLink: 'MCP, 함수 호출',
  hubTitle: '이음 게이트웨이',
  sourceLink: 'SOAP, REST, XML',
  sourceHeading: '원본 시스템',
};

const AI: readonly TopologyAiNode[] = [
  { id: 'claude', label: 'Claude', via: 'MCP', calls: '1,284' },
  { id: 'gpt', label: 'GPT', via: '함수 호출', calls: '312' },
  { id: 'agent', label: '사내 에이전트', via: 'MCP', calls: '0' },
];

const HUB_ITEMS = [
  <Fragment key="published">
    공개 도구 <b>12개</b>
  </Fragment>,
  <Fragment key="formats">
    AI 호출 형식 <b>4종</b> 변환
  </Fragment>,
  '사용자 확인, 마스킹, 호출 한도',
];

const source = (id: string, name: string, detail: string, status: string, gov = false): TopologySourceNode => ({
  id,
  name,
  detail,
  icon: gov ? 'globe' : 'server',
  status: <SourceStatus status={status} variant="dot" />,
});

const SOURCES: readonly TopologySourceNode[] = [
  source('hr', '인사 시스템', 'SOAP, 도구 5개', 'ok'),
  source('erp', 'ERP 회계', 'REST, 도구 3개', 'review'),
  source('gov', '공공 데이터 포털', '공공 API, 도구 2개', 'drift', true),
  source('legacy', '레거시 주문', 'XML, 도구 0개', 'err'),
  source('busy', '분석 중 원본(모르는 값 busy)', 'REST, 도구 1개', 'busy'),
];

const LONG_SOURCES: readonly TopologySourceNode[] = [
  source('long', '아주 긴 이름의 원본 시스템 — 한 줄에서 말줄임으로 잘린다', 'SOAP, 도구 12개', 'ok'),
];

export function TopologySection() {
  const [clicked, setClicked] = useState<string | null>(null);

  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        AI 열 · 연결(FlowLine verticalAt=1100) · 이음 허브 · 연결 · 원본 열. 원본 노드만 버튼(Enter · Space)이고 이름은 노드
        글자 전체(상태 점의 시각 숨김 글자 포함)다. AI 노드는 hover 모양이 없다. 1100 이하에서 한 열 세로가 된다.
      </p>
      <p className={catalog.note}>onSourceClick — {clicked ?? '아직 누르지 않음'}</p>

      <h3 className={catalog.heading}>기본 — 원본 상태 넷 + 모르는 값</h3>
      <div className={catalog.frame}>
        <Topology labels={LABELS} ai={AI} hubItems={HUB_ITEMS} sources={SOURCES} onSourceClick={setClicked} />
      </div>

      <h3 className={catalog.heading}>긴 이름 — 말줄임</h3>
      <div className={catalog.frame}>
        <Topology labels={LABELS} ai={AI.slice(0, 1)} hubItems={HUB_ITEMS} sources={LONG_SOURCES} onSourceClick={setClicked} />
      </div>

      <h3 className={catalog.heading}>aiSlot — 모델 조회 실패(열 머리는 남는다)</h3>
      <div className={catalog.frame}>
        <Topology
          labels={LABELS}
          ai={[]}
          aiSlot={<ErrorBlock message="요청에 실패했습니다 (500)" />}
          hubItems={HUB_ITEMS}
          sources={SOURCES.slice(0, 2)}
          onSourceClick={setClicked}
        />
      </div>

      <h3 className={catalog.heading}>빈 목록 — AI · 원본 없음(옛 그대로 머리만)</h3>
      <div className={catalog.frame}>
        <Topology labels={LABELS} ai={[]} hubItems={HUB_ITEMS} sources={[]} onSourceClick={setClicked} />
      </div>
    </div>
  );
}

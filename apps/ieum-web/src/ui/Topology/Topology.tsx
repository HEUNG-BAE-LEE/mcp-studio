// Topology — 대시보드 연결 구조도(이음 js/menu/dashboard.js:17-28, .topo · .tp-* css/console.css:541-565,880-882).
// AI 열 · 연결 · 이음 허브 · 연결 · 원본 열. 글자는 모두 props로 받고(고정 글자 labels · 원본 보조 줄 detail은 copy/가 만든다), 상태 점은 쓰는 곳이 slot으로 넣는다.
// 원본 노드만 <button>이다(옛 그대로) — 이름은 노드 글자 전체(이름 · 보조 줄 · 상태 점의 시각 숨김 글자). AI 노드 · 허브 · 연결 라벨은 글자일 뿐 포커스를 받지 않는다
import type { ReactNode } from 'react';
import { FlowLine } from '../FlowLine';
import { Icon } from '../icons/Icon';
import { Logo } from '../icons/Logo';
import type { IconName } from '../icons/names';
import styles from './Topology.module.css';

/** 고정 글자(copy/) — 열 머리 · 수 툴팁 · 연결 라벨 · 허브 제목 */
export type TopologyLabels = {
  /** AI 열 머리 */
  aiHeading: string;
  /** AI 열 머리 오른쪽 — 수 칸의 머리 */
  aiCallsHeading: string;
  /** AI 노드 수의 마우스 툴팁(title) */
  aiCallsTitle: string;
  /** AI ↔ 허브 연결 라벨 */
  aiLink: string;
  /** 허브 머리 */
  hubTitle: string;
  /** 허브 ↔ 원본 연결 라벨 */
  sourceLink: string;
  /** 원본 열 머리 */
  sourceHeading: string;
};

/** AI 노드(누를 수 없다) */
export type TopologyAiNode = {
  id: string;
  label: string;
  /** 연결 방식 — 보조 줄 */
  via: string;
  /** 24시간 호출 수 — 서식된 글자. null이면 받는 중 — 칸을 비우고 aria-busy(첫 로딩 규칙) */
  calls: string | null;
};

/** 원본 노드(버튼) */
export type TopologySourceNode = {
  id: string;
  name: string;
  /** 보조 줄 완성 문자열 — copy/가 만든다 */
  detail: string;
  icon: IconName;
  /** 오른쪽 상태 점 — SourceStatus variant="dot" */
  status: ReactNode;
};

export type TopologyProps = {
  labels: TopologyLabels;
  ai: readonly TopologyAiNode[];
  /** 있으면 AI 노드 대신 그 자리에 그린다 — 모델 조회 실패의 ErrorBlock(열 머리는 남는다) */
  aiSlot?: ReactNode;
  /** 허브 목록 줄 — 굵은 수는 <b> */
  hubItems: readonly ReactNode[];
  sources: readonly TopologySourceNode[];
  /** 원본 노드를 누름 — 무엇을 할지는 쓰는 곳이 정한다 */
  onSourceClick: (id: string) => void;
};

function AiNode({ node, callsTitle }: { node: TopologyAiNode; callsTitle: string }) {
  return (
    <div className={styles.node} data-kind="ai">
      <span className={styles.icon}>
        <Icon name="bot" size="md" />
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{node.label}</span>
        <small className={styles.detail}>{node.via}</small>
      </span>
      <span className={styles.calls} title={callsTitle} aria-busy={node.calls === null || undefined}>
        {node.calls}
      </span>
    </div>
  );
}

function SourceNode({ node, onSourceClick }: { node: TopologySourceNode; onSourceClick: (id: string) => void }) {
  return (
    <button type="button" className={styles.node} data-kind="source" onClick={() => onSourceClick(node.id)}>
      <span className={styles.icon}>
        <Icon name={node.icon} size="md" />
      </span>
      <span className={styles.text}>
        <span className={styles.name}>{node.name}</span>
        <small className={styles.detail}>{node.detail}</small>
      </span>
      {node.status}
    </button>
  );
}

function Link({ label }: { label: string }) {
  return (
    <div className={styles.link}>
      <FlowLine verticalAt={1100} />
      <span className={styles.linkLabel}>{label}</span>
    </div>
  );
}

export function Topology({ labels, ai, aiSlot, hubItems, sources, onSourceClick }: TopologyProps) {
  return (
    <div className={styles.root}>
      <div className={styles.column}>
        <div className={styles.head}>
          {labels.aiHeading} <span className={styles.headAside}>{labels.aiCallsHeading}</span>
        </div>
        {aiSlot ?? ai.map((node) => <AiNode key={node.id} node={node} callsTitle={labels.aiCallsTitle} />)}
      </div>
      <Link label={labels.aiLink} />
      <div className={styles.hub}>
        <div className={styles.hubHead}>
          <Logo size={24} />
          {labels.hubTitle}
        </div>
        <ul className={styles.hubList}>
          {hubItems.map((item, index) => (
            // 고정 줄 목록 — 순서가 바뀌거나 줄이 끼어들지 않아 자리 번호를 키로 쓴다
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
      <Link label={labels.sourceLink} />
      <div className={styles.column}>
        <div className={styles.head}>{labels.sourceHeading}</div>
        {sources.map((node) => (
          <SourceNode key={node.id} node={node} onSourceClick={onSourceClick} />
        ))}
      </div>
    </div>
  );
}

// 원본 선택줄 — 라벨 · 원본 선택(최대 280) · 연결 방식 배지 · "{명세}, 마지막 동기화 {sync}" · 명세 다시 읽기(옛 js/menu/studio.js:126-132)
// 명세 · 동기화는 서버 문자열 그대로("방금"은 시간이 지나도 받은 그대로). 자동 탐색 원본에는 다시 읽기가 없다(studio.js:131).
// 다시 읽기 요청 중에는 버튼을 잠근다(pending — 글자는 그대로, 옛은 잠그지 않았다). 결과 토스트 · 캐시 · 초안 지우기는 useRereadSource가 한다
import type { Source } from '../../api/types';
import { PROTOCOL_LABEL, protocolLabel } from '../../copy/protocol';
import { STUDIO } from '../../copy/studio';
import { Button, HelpText, ProtocolBadge, Select, Toolbar, ToolbarSpacer, type ProtocolKind } from '@/ui';
import styles from './StudioScreen.module.css';

const DISC_PROTO = 'disc';

/** 모르는 연결 방식은 배지가 모르는 값 모양이다(글자는 protocolLabel이 값 그대로) */
const protocolKindOf = (proto: string): ProtocolKind =>
  Object.hasOwn(PROTOCOL_LABEL, proto) ? (proto as ProtocolKind) : 'unknown';

type SourceBarProps = Readonly<{
  /** 선택지 — 도구가 있는 원본(서버 순서) */
  options: readonly Source[];
  source: Source;
  onSource: (sourceId: string) => void;
  /** 이 원본의 다시 읽기 요청 중 */
  rereading: boolean;
  onReread: () => void;
}>;

export function SourceBar({ options, source, onSource, rereading, onReread }: SourceBarProps) {
  return (
    <Toolbar label={STUDIO.bar.label} className={styles.toolbar}>
      <Select
        variant="toolbar"
        width="wide"
        aria-label={STUDIO.bar.selectLabel}
        value={source.id}
        onValueChange={onSource}
      >
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <ProtocolBadge kind={protocolKindOf(source.proto)} label={protocolLabel(source.proto)} />
      <HelpText size="md">{STUDIO.bar.syncLine(source.spec, source.sync)}</HelpText>
      <ToolbarSpacer />
      {source.proto === DISC_PROTO ? null : (
        <Button icon="refresh" pending={rereading} onClick={onReread}>
          {STUDIO.bar.reread}
        </Button>
      )}
    </Toolbar>
  );
}

// 카탈로그 ProtocolBadge 절 — kind 여섯(rest · soap · gov · disc · sample · unknown). 높이 22 · Tag lg와 같은 모양
import { ProtocolBadge, type ProtocolKind } from '../../ui';
import catalog from './catalog.module.css';

const KINDS: readonly { kind: ProtocolKind; label: string }[] = [
  { kind: 'rest', label: 'REST' },
  { kind: 'soap', label: 'SOAP' },
  { kind: 'gov', label: '공공데이터' },
  { kind: 'disc', label: '자동 탐색' },
  { kind: 'sample', label: '샘플 추론' },
  { kind: 'unknown', label: 'unknown' },
];

export function ProtocolBadgeSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        원본 시스템의 연결 방식 배지. 색은 도메인 색(--proto-*)이고 sample은 점선, unknown은 모르는 값(mute)이다. 글자는 쓰는 곳이 넘긴다.
      </p>
      <div className={catalog.row}>
        {KINDS.map(({ kind, label }) => (
          <ProtocolBadge key={kind} kind={kind} label={label} />
        ))}
      </div>
    </div>
  );
}

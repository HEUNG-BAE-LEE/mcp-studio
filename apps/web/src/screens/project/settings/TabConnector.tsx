// apps/web/src/screens/project/settings/TabConnector.tsx — 커넥터 만들기 탭: 수집 완료만 — 이름 · 담을 도구(Field group + Checkbox `label` 묶음) · 안내(Notice) · 커넥터 구성 · 파이프라인 링크. 그 밖은 잠김 안내(EmptyState not-created)
import { Link } from 'react-router';
import { Button, Checkbox, EmptyState, Field, Notice } from '@/ui';
import type { SourceDetail, ToolGroupKind } from '../../../api/types';
import { connectorPath, screenPath } from '../../../app/nav';
import { SETTINGS, lockOf, toolLabel } from '../../../copy/sourceSettings';
import { NameField } from './NameField';
import styles from './settings.module.css';

const NEW_CONNECTOR_ID = 'new';
type Props = {
  projectId: string;
  detail: SourceDetail;
  name: string;
  onName: (v: string) => void;
  selected: ReadonlySet<ToolGroupKind>;
  onToggle: (kind: ToolGroupKind, on: boolean) => void;
  /** 만들기 권한 없음 — 이름은 읽기 전용 · 도구 체크는 비활성(사유는 발 메모) */
  readOnly: boolean;
};

export function TabConnector({
  projectId,
  detail,
  name,
  onName,
  selected,
  onToggle,
  readOnly,
}: Props) {
  const lock = lockOf(detail.status);
  const C = SETTINGS.connector;
  if (lock)
    return <EmptyState kind="not-created" title={lock.title} body={lock.body} hint={lock.hint} />;
  return (
    <div className={styles.stack}>
      <NameField
        label={C.nameLabel}
        value={name}
        placeholder={detail.suggestedConnectorName ?? C.namePlaceholder(detail.name)}
        onChange={onName}
        readOnly={readOnly}
      />
      <Field group label={C.toolsLabel}>
        <div className={styles.tools}>
          {detail.toolGroups.map((g) => (
            <Checkbox
              key={g.kind}
              label={toolLabel(g.kind, g.count)}
              checked={selected.has(g.kind)}
              disabled={readOnly}
              onCheckedChange={(on) => onToggle(g.kind, on === true)}
            />
          ))}
        </div>
      </Field>
      <Notice tone="info" body={C.note} />
      <div className={styles.links}>
        <Button variant="link" asChild>
          <Link to={connectorPath(projectId, NEW_CONNECTOR_ID)}>{C.openConnector}</Link>
        </Button>
        <Button variant="link" asChild>
          <Link to={screenPath('pipe')}>{C.openPipeline}</Link>
        </Button>
      </div>
    </div>
  );
}

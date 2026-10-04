// apps/web/src/screens/project/ConnectorInfoDialog.tsx — 커넥터 연결 정보(Modal info): 이름 · 상태 태그 · 부제 · 복사 행 3(platform.copyText) / 미발행 안내(Notice) · 닫기 · 커넥터 열기
import { Link } from 'react-router';
import { Button, CopyField, Modal, Notice, StatusChip } from '@/ui';
import type { Connector } from '../../api/types';
import { useFrameContainer } from '../../app/frame';
import { connectorPath } from '../../app/nav';
import { PROJECT } from '../../copy/project';
import { connectorStatusOf } from '../../copy/status';
import { platform } from '../../platform';

type FieldKey = 'endpoint' | 'protocol' | 'authKeyMasked';
const FIELDS: readonly { key: FieldKey; label: string }[] = [
  { key: 'endpoint', label: PROJECT.connection.endpoint },
  { key: 'protocol', label: PROJECT.connection.protocol },
  { key: 'authKeyMasked', label: PROJECT.connection.authKey },
];

type Props = { connector: Connector | null; projectName: string; onClose: () => void };

/** 부모가 key={connector.id}로 다시 만들어 복사 상태(CopyField 안)가 커넥터마다 새로 시작한다 */
export function ConnectorInfoDialog({ connector, projectName, onClose }: Props) {
  const container = useFrameContainer();
  const status = connector ? connectorStatusOf(connector.status) : null;
  const isPublished = connector !== null && connector.status !== 'unpublished';
  const fields =
    connector && isPublished ? FIELDS.filter(({ key }) => connector[key] !== undefined) : [];
  return (
    <Modal
      kind="info"
      open={connector !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      container={container}
      kicker={PROJECT.connection.kicker}
      title={connector?.name ?? ''}
      marker={
        status ? (
          <StatusChip tier={status.tier} size="lg">
            {status.label}
          </StatusChip>
        ) : null
      }
      subtitle={
        connector
          ? PROJECT.connection.subtitle(projectName, connector.sourceName, connector.toolCount)
          : undefined
      }
      footer={{
        actions: (
          <>
            <Button onClick={onClose}>{PROJECT.connection.close}</Button>
            {connector ? (
              <Button variant="primary" asChild>
                <Link to={connectorPath(connector.projectId, connector.id)}>
                  {PROJECT.connection.open}
                </Link>
              </Button>
            ) : null}
          </>
        ),
      }}
    >
      {connector &&
        fields.map(({ key, label }) => {
          const value = connector[key] ?? '';
          return (
            <CopyField
              key={key}
              label={label}
              value={value}
              copyLabel={PROJECT.connection.copy}
              copiedLabel={PROJECT.connection.copied}
              failedLabel={PROJECT.connection.copyFailed}
              // copyText는 실패를 false로 돌려준다(사유는 platform이 경고로 남긴다) — 그때는 `복사 안 됨`.
              // 복사됨은 다이얼로그가 열린 동안 유지한다(부모가 커넥터마다 key로 다시 만든다)
              copiedMs={null}
              onCopy={() => platform.copyText(value)}
            />
          );
        })}
      {connector && isPublished && fields.length === 0 ? (
        <Notice tone="warn" body={PROJECT.connection.noFields} />
      ) : null}
      {connector && !isPublished ? (
        <Notice tone="info" body={PROJECT.connection.unpublished} />
      ) : null}
    </Modal>
  );
}

// apps/web/src/screens/project/settings/TabInfo.tsx — 소스 정보 탭: 이름(저장은 발 주 액션 · 권한 없으면 읽기 전용) · 태그 · 연결 해제(SettingRow + Button danger → Dialog 확인). 권한 사유는 발 메모(reasonId)
import { useId, useState, type Ref } from 'react';
import { Button, Field, SettingRow, Tag } from '@/ui';
import type { SourceDetail } from '../../../api/types';
import { useFrameContainer } from '../../../app/frame';
import type { PermissionState } from '../../../app/user/usePermission';
import { SETTINGS } from '../../../copy/sourceSettings';
import { DisconnectDialog } from './DisconnectDialog';
import { NameField } from './NameField';
import styles from './settings.module.css';

type Props = {
  detail: SourceDetail;
  name: string;
  onName: (v: string) => void;
  /** 저장 권한 없음 — 이름 칸 읽기 전용 */
  readOnly: boolean;
  /** 이름 입력 — 저장 성공 뒤 포커스를 돌려받는다 */
  nameRef: Ref<HTMLInputElement>;
  /** 발 메모(권한 사유) id — 비활성 연결 해제가 가리킨다 */
  reasonId: string;
  canDisconnect: PermissionState;
  /** 해제 요청 중 — 다시 열지 못하게 잠근다 */
  isRemoving: boolean;
  /** 해제 요청 실패 — 확인 Dialog 안에 보인다 */
  removeFailure: unknown;
  /** 확인 Dialog를 열 때 앞의 실패를 지운다 */
  onOpenDisconnect: () => void;
  /** 확인 Dialog에서 연결 해제를 누름 */
  onDisconnect: () => void;
};

export function TabInfo({
  detail,
  name,
  onName,
  readOnly,
  nameRef,
  reasonId,
  canDisconnect,
  isRemoving,
  removeFailure,
  onOpenDisconnect,
  onDisconnect,
}: Props) {
  const I = SETTINGS.info;
  const container = useFrameContainer();
  const [confirming, setConfirming] = useState(false);
  const noteId = useId();
  const isDenied = !canDisconnect.allowed;
  return (
    <div className={styles.stack}>
      <NameField
        label={I.nameLabel}
        value={name}
        onChange={onName}
        readOnly={readOnly}
        inputRef={nameRef}
      />
      <Field group label={I.tagsLabel}>
        <div className={styles.tags}>
          {detail.tags.map((t) => (
            <Tag key={t} variant="project">
              {t}
            </Tag>
          ))}
        </div>
      </Field>
      <SettingRow
        title={I.disconnectTitle}
        description={I.disconnectNote}
        descriptionId={noteId}
        control={
          <Button
            variant="danger"
            disabled={isDenied || isRemoving}
            aria-describedby={isDenied ? `${noteId} ${reasonId}` : noteId}
            title={canDisconnect.reason ?? undefined}
            onClick={() => {
              onOpenDisconnect();
              setConfirming(true);
            }}
          >
            {I.disconnect}
          </Button>
        }
      />
      <DisconnectDialog
        open={confirming}
        onOpenChange={setConfirming}
        container={container}
        sourceName={detail.name}
        isRemoving={isRemoving}
        failure={removeFailure}
        onConfirm={onDisconnect}
      />
    </div>
  );
}

// apps/web/src/screens/project/settings/DisconnectDialog.tsx — 연결 해제 확인. 비동기 확인(COMPONENTS Dialog `busy`): 성공하면 설정 모달째 닫히고, 실패하면 열어 둔 채 아는 code 한 줄 · 모르는 code 원문을 보인다
import { Button, Dialog } from '@/ui';
import { FailureBlock } from '../../../app/FailureBlock';
import { SETTINGS } from '../../../copy/sourceSettings';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: HTMLElement | null;
  sourceName: string;
  isRemoving: boolean;
  /** 해제 요청 실패 — 없으면 null */
  failure: unknown;
  onConfirm: () => void;
};

export function DisconnectDialog({
  open,
  onOpenChange,
  container,
  sourceName,
  isRemoving,
  failure,
  onConfirm,
}: Props) {
  const I = SETTINGS.info;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      busy={isRemoving}
      container={container}
      title={I.dialogTitle(sourceName)}
      description={I.dialogDescription}
      actions={{
        cancel: <Button variant="secondary">{I.cancel}</Button>,
        confirm: (
          <Button
            variant="danger"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {isRemoving ? I.disconnecting : I.disconnect}
          </Button>
        ),
      }}
    >
      <FailureBlock failure={failure} />
    </Dialog>
  );
}

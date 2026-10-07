// PendingScreen — 아직 옮기지 않은 메뉴의 자리. 3단계에서 메뉴마다 실제 화면으로 바꾼다
import { PENDING_NOTE, SCREEN_LABEL } from '../../copy/shell';
import type { ScreenId } from '../../app/nav';

export function PendingScreen({ id }: { id: ScreenId }) {
  return (
    <section>
      <h2>{SCREEN_LABEL[id]}</h2>
      <p>{PENDING_NOTE}</p>
    </section>
  );
}

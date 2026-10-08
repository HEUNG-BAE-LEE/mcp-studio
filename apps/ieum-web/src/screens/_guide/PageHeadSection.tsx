// 카탈로그 PageHead 절 — 메뉴 화면 머리(제목 + 설명)와 설명 없는 머리. 좁은 폭(760 이하)에서 제목이 한 단계 작아지고 설명이 아래로 접힌다.
// 포커스 대체 예시: 모달을 연 채 층 안 "연 버튼 지우기"로 연 버튼을 없애고 닫는다 — returnFocusFallback이 없으면 지금 화면의 첫 PageHead 제목
// (이 절 맨 위 — 앞 절에는 PageHead가 없다)으로, 있으면 그것이 돌려준 곳으로 포커스가 간다. "되살리기"로 지운 버튼을 다시 그린다
import { useId, useState } from 'react';
import { PAGE_DESCRIPTION, SCREEN_LABEL } from '../../copy/shell';
import { Button, Modal, PageHead } from '../../ui';
import catalog from './catalog.module.css';

type FallbackExample = 'title' | 'custom';

export function PageHeadSection() {
  const [opened, setOpened] = useState<FallbackExample | null>(null);
  const [removed, setRemoved] = useState<readonly FallbackExample[]>([]);
  const customTargetId = useId();
  const isShown = (example: FallbackExample) => !removed.includes(example);
  const removeOpener = (example: FallbackExample) => () =>
    setRemoved((current) => (current.includes(example) ? current : [...current, example]));
  const openChange = (example: FallbackExample) => (open: boolean) => setOpened(open ? example : null);

  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        제목은 h2 — 문서의 h1은 LNB 제목 하나다. 문구는 copy/shell(SCREEN_LABEL · PAGE_DESCRIPTION). 제목은 tabIndex=-1 ·
        data-page-title — 층을 닫았는데 연 컨트롤이 사라졌으면 포커스가 오는 기본 대체 자리다(Tab 순서에는 들지 않는다).
      </p>
      <PageHead title={SCREEN_LABEL.dashboard} description={PAGE_DESCRIPTION.dashboard} />
      <PageHead title={SCREEN_LABEL.sources} description={PAGE_DESCRIPTION.sources} />
      <PageHead title={SCREEN_LABEL.logs} />

      <p className={catalog.note}>
        포커스 대체 — 모달 안 &quot;연 버튼 지우기&quot; 뒤 닫으면, returnFocusFallback이 없을 때는 이 절 첫 제목으로, 있을 때는 그
        곳(&quot;대체 자리&quot; 버튼)으로 간다. 순서는 쓰는 곳이 준 곳 → 화면 제목 → 셸 본문 &lt;main&gt;.
      </p>
      <div className={catalog.row}>
        {isShown('title') ? <Button onClick={() => setOpened('title')}>기본 대체(화면 제목)</Button> : null}
        {isShown('custom') ? <Button onClick={() => setOpened('custom')}>returnFocusFallback</Button> : null}
        <Button id={customTargetId}>대체 자리</Button>
        <Button onClick={() => setRemoved([])} disabled={removed.length === 0}>
          지운 버튼 되살리기
        </Button>
      </div>

      <Modal
        open={opened === 'title'}
        onOpenChange={openChange('title')}
        title="연 버튼이 사라지는 모달"
        cancelLabel="닫기"
        extra={<Button onClick={removeOpener('title')}>연 버튼 지우기</Button>}
      >
        연 버튼을 지운 뒤 닫으면 포커스가 화면 제목(PageHead h2)으로 간다.
      </Modal>
      <Modal
        open={opened === 'custom'}
        onOpenChange={openChange('custom')}
        title="연 버튼이 사라지는 모달"
        cancelLabel="닫기"
        extra={<Button onClick={removeOpener('custom')}>연 버튼 지우기</Button>}
        returnFocusFallback={() => document.getElementById(customTargetId)}
      >
        연 버튼을 지운 뒤 닫으면 포커스가 returnFocusFallback이 돌려준 &quot;대체 자리&quot; 버튼으로 간다.
      </Modal>
    </div>
  );
}

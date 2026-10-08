// 카탈로그 PageHead 절 — 메뉴 화면 머리(제목 + 설명)와 설명 없는 머리. 좁은 폭(760 이하)에서 제목이 한 단계 작아지고 설명이 아래로 접힌다
import { PAGE_DESCRIPTION, SCREEN_LABEL } from '../../copy/shell';
import { PageHead } from '../../ui';
import catalog from './catalog.module.css';

export function PageHeadSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>제목은 h2 — 문서의 h1은 LNB 제목 하나다. 문구는 copy/shell(SCREEN_LABEL · PAGE_DESCRIPTION).</p>
      <PageHead title={SCREEN_LABEL.dashboard} description={PAGE_DESCRIPTION.dashboard} />
      <PageHead title={SCREEN_LABEL.sources} description={PAGE_DESCRIPTION.sources} />
      <PageHead title={SCREEN_LABEL.logs} />
    </div>
  );
}

// 카탈로그 Dock 절 — 도크는 화면 고정(position: fixed)이라 미리보기마다 transform 틀에 가둔다: transform이 새 containing block을 만들어
// 도크가 화면이 아니라 틀 아래에 붙고, 내려가는 모션도 틀 안에서 잘린다(부품에 prop을 늘리지 않는다). 틀 하나에 도크 하나만 둔다 — 겹친다.
// 선택 도크: open 토글(올라옴 · 내려감 모션) · "처음 그릴 때"(key로 다시 마운트 — 열린 채 모션 없이) · "드로어 열기"(data-covered — 열린 동안 모션 없이 가리고
// 닫으면 다시 보인다) · 선택 수 0이면 주 버튼 disabled · 주 버튼을 누르면 1초 pending. 조각 모음: 링크형 · 구분선 · 주 버튼 상태 · 많으면 접힘.
// DockSpacer는 점선 틀로 크기를 본다. 760 이하에서 좌우 꽉 참 · 안쪽 여백 줄어듦은 폭 전환으로 본다
import { useEffect, useState } from 'react';
import { Button, Dock, DockButton, DockLinkButton, DockSeparator, DockSpacer, Drawer, useOpenLayers } from '../../ui';
import catalog from './catalog.module.css';
import styles from './DockSection.module.css';

// 선택 도크의 "추천만 선택"이 고르는 수 · 주 버튼 pending 시간(요청 하나를 흉내 낸다)
const RECOMMENDED_COUNT = 3;
const PENDING_MS = 1000;
const NOOP = () => undefined;

export function DockSection() {
  const [isOpen, setIsOpen] = useState(true);
  const [mountKey, setMountKey] = useState(0);
  const [count, setCount] = useState(RECOMMENDED_COUNT);
  const [isPending, setIsPending] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const openLayers = useOpenLayers();

  // 주 버튼 pending — 끝나면 선택을 비운다(등록을 마친 모양 — 주 버튼이 disabled로 돌아온다)
  useEffect(() => {
    if (!isPending) return;
    const timer = window.setTimeout(() => {
      setIsPending(false);
      setCount(0);
    }, PENDING_MS);
    return () => window.clearTimeout(timer);
  }, [isPending]);

  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        화면 아래 가운데에 떠 있는 일괄 작업 줄. 어두운 고정 면(--inverse-surface)이라 두 테마가 같고, role=&quot;region&quot; + aria-label이다.
        그 자리에 그린다(포털 없음) — 층 목록 밖이라 Esc · closeAllLayers와 상관없다. 처음 그릴 때 open이면 모션 없이 보이고, 바뀌면
        올라오고 내려간다. 드로어가 열려 있는 동안은 open과 상관없이 모션 없이 가린다. 760 이하에서 좌우 --s-3까지 꽉 찬다.
      </p>
      <p className={catalog.note} data-drawer={openLayers.drawer}>
        open {String(isOpen)} · 선택 {count} · pending {String(isPending)} — useOpenLayers 드로어 {openLayers.drawer ? '열림(도크 가림)' : '닫힘'}
      </p>
      <div className={catalog.row}>
        <Button onClick={() => setIsOpen((current) => !current)}>{isOpen ? '내리기(open=false)' : '올리기(open=true)'}</Button>
        <Button onClick={() => setMountKey((key) => key + 1)}>처음 그릴 때(모션 없음)</Button>
        <Button onClick={() => setIsDrawerOpen(true)}>드로어 열기(도크 가림)</Button>
        <Button onClick={() => setCount((current) => current + 1)}>선택 하나 더</Button>
        <Button onClick={() => setCount(0)}>선택 비우기</Button>
      </div>
      <h3 className={catalog.heading}>선택 도크 — 요약 · 링크형 버튼 · 구분선 · 주 버튼</h3>
      <div className={styles.preview}>
        <p className={styles.caption}>표 · 본문 자리 — 도크가 이 틀 아래에 떠 있다(틀이 transform으로 화면 고정의 기준이 된다).</p>
        <Dock
          key={mountKey}
          label="선택한 API"
          open={isOpen}
          summary={
            <>
              <b>{count}</b>개 선택
            </>
          }
        >
          <DockLinkButton onClick={() => setCount(RECOMMENDED_COUNT)}>추천만 선택</DockLinkButton>
          <DockSeparator />
          <DockButton disabled={count === 0} pending={isPending} onClick={() => setIsPending(true)}>
            도구 후보로 등록
          </DockButton>
        </Dock>
      </div>
      <h3 className={catalog.heading}>조각 모음 — 링크형(기본 · disabled) · 주 버튼(기본 · disabled · pending · 아이콘) · 접힘</h3>
      <p className={catalog.note}>
        hover는 마우스를 올려 본다 — 주 버튼은 --inverse-fill-hover, 링크형은 글자 --on-fill. disabled · pending은 흐리고 hover 모양이 바뀌지 않는다.
        pending은 누름을 무시하고 포커스가 버튼에 남는다. 좁으면 줄을 바꾼다(사이 --s-2-5).
      </p>
      <div className={styles.previewTall}>
        <p className={styles.caption}>줄이 길어 폭이 모자라면 접힌다 — 틀 폭은 폭 전환으로 바꾼다.</p>
        <Dock label="조각 모음" open summary={<><b>12</b>개 선택</>}>
          <DockLinkButton onClick={NOOP}>추천만 선택</DockLinkButton>
          <DockLinkButton onClick={NOOP} disabled>
            선택 해제(disabled)
          </DockLinkButton>
          <DockSeparator />
          <DockButton>기본</DockButton>
          <DockButton disabled>disabled</DockButton>
          <DockButton pending>pending</DockButton>
          <DockButton icon="check">아이콘</DockButton>
        </Dock>
      </div>
      <h3 className={catalog.heading}>DockSpacer — 도크가 마지막 행을 가리지 않게 표 아래 두는 빈 칸</h3>
      <div className={catalog.frame}>
        <p className={catalog.frameLabel}>높이 70 · 장식(aria-hidden) — 도크가 없는 때에도 둔다</p>
        <DockSpacer />
      </div>

      <Drawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        title="드로어가 열려 있는 동안"
        footer={
          <Button variant="primary" onClick={() => setIsDrawerOpen(false)}>
            닫기
          </Button>
        }
      >
        위 미리보기의 도크는 열려 있어도 보이지 않는다 — 모션 없이 가려지고, 드로어를 닫으면 그 자리에서 다시 보인다(data-covered).
      </Drawer>
    </div>
  );
}

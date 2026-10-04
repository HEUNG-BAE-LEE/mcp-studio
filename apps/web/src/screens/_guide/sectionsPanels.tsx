// 층 절 뒤쪽 — 검색 · 알림 · 안내 패널 · 팝오버(SearchOverlay · AlertPanel · HelperPanel · Popover). sections.tsx가 BASE_SECTIONS에 순서대로 잇는다
import { useState } from 'react';
import {
  AlertPanel,
  Button,
  HelperPanel,
  Notice,
  Popover,
  SearchOverlay,
  SearchOverlayEmpty,
  SearchOverlayGroup,
  SearchOverlayItem,
  StepList,
} from '@/ui';
import { GUIDE_FLOW_STEPS, GUIDE_LAYER_BOX, GUIDE_SEARCH_HITS, noop } from './fixtureData';
import styles from './GuideScreen.module.css';
import type { GuideSection } from './sections';
import { useBox } from './useBox';

/** 팝오버 예시 — 평문 행 세 줄 */
const GUIDE_POPOVER_ROWS = ['전체', '연결됨', '확인 필요'] as const;
const GUIDE_POPOVER_ITEM = { padding: 'var(--s-2) var(--s-2-5)', font: 'var(--t-body)' } as const;

/** 검색 층 — 예시 상자를 덮는다. 입력은 제어 상태, 결과는 예시 데이터(`데이터` 검색)를 거른다 */
const guideSearchGroups = (query: string) => {
  const q = query.trim().toLowerCase();
  if (q === '') return [];
  return GUIDE_SEARCH_HITS.map((group) => ({
    ...group,
    hits: group.hits.filter((hit) => hit.label.toLowerCase().includes(q)),
  })).filter((group) => group.hits.length > 0);
};

function GuideSearchOverlay() {
  const [box, setBox] = useBox();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('데이터');
  const groups = guideSearchGroups(value);
  const hasNoHit = value.trim() !== '' && groups.length === 0;
  return (
    <>
      <div className={styles.row}>
        <Button onClick={() => setOpen(true)}>검색 열기</Button>
      </div>
      <div className={styles.stage}>
        <div ref={setBox} style={GUIDE_LAYER_BOX}>
          {box ? (
            <SearchOverlay
              open={open}
              onOpenChange={setOpen}
              container={box}
              value={value}
              onValueChange={setValue}
              placeholder="항목 · 프로젝트 검색"
            >
              {groups.map((group) => (
                <SearchOverlayGroup key={group.label} label={group.label}>
                  {group.hits.map((hit) => (
                    <SearchOverlayItem
                      key={hit.id}
                      href={hit.href}
                      onClick={noop}
                      icon={hit.icon}
                      note={hit.note}
                      pending={hit.pending}
                    >
                      {hit.label}
                    </SearchOverlayItem>
                  ))}
                </SearchOverlayGroup>
              ))}
              {hasNoHit ? <SearchOverlayEmpty>일치하는 항목이 없습니다</SearchOverlayEmpty> : null}
            </SearchOverlay>
          ) : null}
        </div>
      </div>
    </>
  );
}

/** 알림 패널 — 예시 상자 안 left 252 · bottom 16. 목록은 Notice 세 장 */
function GuideAlertPanel() {
  const [box, setBox] = useBox();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={styles.row}>
        <Button onClick={() => setOpen(true)}>알림 열기</Button>
      </div>
      <div ref={setBox} style={{ ...GUIDE_LAYER_BOX, width: 724, height: 420 }}>
        {box ? (
          <AlertPanel
            open={open}
            onOpenChange={setOpen}
            container={box}
            footer={
              <Button variant="link" size="sm">
                모든 알림 보기
              </Button>
            }
          >
            <Notice
              tone="risk"
              title="인증 실패 소스 1건"
              body="코어뱅킹 API. 인증이 거절돼 11:20 이후 멈춰 있다."
              link={{ label: '접속 정보 열기 →', onClick: noop }}
            />
            <Notice
              tone="going"
              title="수집 중인 소스 1건"
              body="인수지침 문서 · 임베딩 62%. 약 4분 남았다."
              link={{ label: '상태 · 수집 열기 →', onClick: noop }}
            />
            <Notice
              tone="done"
              title="수집 끝난 소스 1건"
              body="약관 PDF. 문서 128건을 읽었다."
              link={{ label: '소스 열기 →', href: '#' }}
            />
          </AlertPanel>
        ) : null}
      </div>
    </>
  );
}

export const PANEL_SECTIONS: readonly GuideSection[] = [
  {
    group: '층',
    name: 'SearchOverlay',
    render: () => (
      <div className={styles.cell}>
        <span className={styles.caption}>
          LNB 검색 — 폭 460 · 위 104 · scrim light · 입력 포커스 · Esc로 닫힘 · 결과 Group · Item ·
          Empty
        </span>
        <GuideSearchOverlay />
      </div>
    ),
  },
  {
    group: '층',
    name: 'AlertPanel',
    render: () => (
      <div className={styles.cell}>
        <span className={styles.caption}>
          LNB 종 알림 — 폭 424 · left 252 · bottom 16 · 투명 scrim · Esc · 바깥 클릭으로 닫힘
        </span>
        <GuideAlertPanel />
      </div>
    ),
  },
  {
    group: '층',
    name: 'HelperPanel',
    render: () => (
      <div className={styles.cell}>
        <span className={styles.caption}>흐름 우측 안내 — 폭 272 · 제목 + StepList</span>
        <div style={{ display: 'flex', height: 200, border: '1px solid var(--hairline)' }}>
          <HelperPanel title="소스 연결 과정">
            <StepList items={GUIDE_FLOW_STEPS} current={1} />
          </HelperPanel>
        </div>
      </div>
    ),
  },
  {
    group: '층',
    name: 'Popover',
    render: () => (
      <div className={styles.cell}>
        <span className={styles.caption}>트리거 아래 6 · 12 · popover 그림자 · 안쪽 4</span>
        <div>
          <Popover trigger={<Button>필터</Button>}>
            {GUIDE_POPOVER_ROWS.map((row) => (
              <div key={row} style={GUIDE_POPOVER_ITEM}>
                {row}
              </div>
            ))}
          </Popover>
        </div>
      </div>
    ),
  },
];

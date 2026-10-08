// 카탈로그 BrowserView 절 — 자리 문구 셋(탐색 중 · 예약 · 없음) · 캡처 이미지 × 강조 없음 · act · skip · 긴 주소 · 움직임.
// 캡처는 이 절 안에서 만든 작은 인라인 SVG 데이터 주소다(백엔드 없이 보이게 — 가짜 운영 화면 그림이라 색 값을 그림 안에 둔다).
// 움직임 예는 지역 상태로 같은 <img>의 주소 교체 · 강조 이동(--m-fade) · 불러오기 실패(onImageError → 자리 문구)를 재현한다.
// 라이트 · 다크 모두 캡처 영역이 밝은지는 테마 전환으로 본다
import { useState } from 'react';
import { Box, BrowserView, Button, TwoColumn, type BrowserHighlight } from '../../ui';
import catalog from './catalog.module.css';

const TITLE = '운영 화면 탐색';
const DESCRIPTION = '헤드리스 브라우저, Chromium';
const ALT = '헤드리스 브라우저가 보고 있는 운영 화면';
const URL = 'legacy.example.com/purchase/list.do';
const LONG_URL =
  'legacy.example.com/purchase/approval/history/list.do?vendorCode=ACME-KOREA-0001&from=2026-01-01&to=2026-10-09&page=12&sort=desc';
const PLACEHOLDER = Object.freeze({
  running: '브라우저를 띄우는 중',
  scheduled: '예약한 시각에 브라우저를 띄웁니다',
  none: '캡처한 화면이 없습니다',
});
const LABEL = Object.freeze({ act: '클릭', skip: '건너뜀' });
/** 불러오기 실패를 재현하는 주소 — 이미지가 아닌 데이터 */
const BROKEN_SRC = 'data:image/png;base64,AAAA';

/** 가짜 운영 화면 크기(px) — 강조 상자 백분율의 기준 */
const PAGE_W = 800;
const PAGE_H = 500;

type Rect = Readonly<{ x: number; y: number; w: number; h: number }>;

/** 가짜 화면 안 요소 자리(px) — 강조 상자가 가리킬 곳 */
const SEARCH_BUTTON: Rect = { x: 640, y: 76, w: 120, h: 32 };
const FIRST_ROW: Rect = { x: 208, y: 196, w: 552, h: 36 };
const SECOND_MENU: Rect = { x: 24, y: 112, w: 132, h: 28 };
const TARGETS: readonly Rect[] = [SEARCH_BUTTON, FIRST_ROW, SECOND_MENU];

const toHighlight = (kind: BrowserHighlight['kind'], rect: Rect): BrowserHighlight => ({
  kind,
  label: LABEL[kind],
  x: (rect.x / PAGE_W) * 100,
  y: (rect.y / PAGE_H) * 100,
  w: (rect.w / PAGE_W) * 100,
  h: (rect.h / PAGE_H) * 100,
});

/** 가짜 운영 화면 그림 — variant마다 제목 줄 · 강조 행이 달라 주소 교체가 보인다 */
const captureSrc = (variant: number): string => {
  const rows = Array.from({ length: 6 }, (_, index) => {
    const y = 196 + index * 44;
    const fill = index === variant % 6 ? '#eef5ff' : '#ffffff';
    return `<rect x="208" y="${y}" width="552" height="36" fill="${fill}" stroke="#e3e6eb"/><rect x="224" y="${y + 13}" width="${120 + ((index * 37 + variant * 23) % 160)}" height="10" rx="2" fill="#c9ced6"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}">
<rect width="${PAGE_W}" height="${PAGE_H}" fill="#ffffff"/>
<rect width="${PAGE_W}" height="52" fill="#24324a"/>
<rect x="24" y="18" width="150" height="16" rx="3" fill="#ffffff" fill-opacity=".85"/>
<rect y="52" width="180" height="${PAGE_H - 52}" fill="#f3f5f8"/>
<rect x="24" y="76" width="132" height="12" rx="2" fill="#9aa2ad"/>
<rect x="24" y="120" width="${variant % 2 === 0 ? 96 : 120}" height="12" rx="2" fill="#9aa2ad"/>
<rect x="24" y="164" width="110" height="12" rx="2" fill="#9aa2ad"/>
<rect x="208" y="80" width="${variant % 2 === 0 ? 220 : 280}" height="22" rx="3" fill="#2b2f36"/>
<rect x="640" y="76" width="120" height="32" rx="4" fill="#2f86f6"/>
<rect x="208" y="140" width="552" height="36" fill="#f6f7f9" stroke="#d2d6dd"/>
${rows}
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const SHOT_A = captureSrc(0);
const SHOT_B = captureSrc(1);

function MotionDemo() {
  const [shot, setShot] = useState(0);
  const [target, setTarget] = useState(0);
  const [kind, setKind] = useState<BrowserHighlight['kind']>('act');
  const isShotA = shot % 2 === 0;
  const rect = TARGETS[target % TARGETS.length] ?? SEARCH_BUTTON;
  return (
    <div className={catalog.stack}>
      <p className={catalog.note}>
        캡처 {isShotA ? 'A' : 'B'} · 강조 {kind} · 자리 {(target % TARGETS.length) + 1}. 캡처를 바꾸면 같은 &lt;img&gt;의 주소만 바뀐다(새
        이미지를 받을 때까지 이전 캡처가 남아 깜빡이지 않는다). 강조를 옮기면 --m-fade로 미끄러지고, 둘레가 --m-pulse로 맥박친다.
      </p>
      <div className={catalog.row}>
        <Button size="sm" onClick={() => setShot((value) => value + 1)}>
          캡처 바꾸기
        </Button>
        <Button size="sm" onClick={() => setTarget((value) => value + 1)}>
          강조 옮기기
        </Button>
        <Button size="sm" onClick={() => setKind((value) => (value === 'act' ? 'skip' : 'act'))}>
          {kind === 'act' ? 'skip으로' : 'act로'}
        </Button>
      </div>
      <Box title={TITLE} description={DESCRIPTION}>
        <BrowserView
          url={URL}
          src={isShotA ? SHOT_A : SHOT_B}
          alt={ALT}
          placeholder={PLACEHOLDER.none}
          highlight={toHighlight(kind, rect)}
        />
      </Box>
    </div>
  );
}

/** 깨진 주소를 넘기면 onImageError가 불리고, 쓰는 곳이 src를 비워 자리 문구가 된다 */
function BrokenDemo() {
  const [src, setSrc] = useState<string | null>(BROKEN_SRC);
  return (
    <div className={catalog.stack}>
      <p className={catalog.note}>
        src {src === null ? 'null(자리 문구)' : '깨진 주소'}. 깨진 주소는 onImageError → 쓰는 곳이 src를 비우고 자리 문구를 고른다.
      </p>
      <div className={catalog.row}>
        <Button size="sm" onClick={() => setSrc(BROKEN_SRC)}>
          깨진 주소 다시 넘기기
        </Button>
      </div>
      <Box title={TITLE} description={DESCRIPTION}>
        <BrowserView url={URL} src={src} alt={ALT} placeholder={PLACEHOLDER.none} onImageError={() => setSrc(null)} />
      </Box>
    </div>
  );
}

export function BrowserViewSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        주소 줄(자물쇠 + 고정폭 주소 말줄임) 아래 캡처 영역. 캡처 영역은 두 테마 모두 밝은 화면이고 최소 높이 300이다. 틀 높이는 내용 높이다(칸을
        채우지 않는다). 강조 상자는 캡처가 있을 때만 그리고, 좌표는 캡처 크기에 대한 백분율이다 — act 실선 --capture-hl, skip 점선
        --capture-hl-block, 오른쪽 위 라벨. 상자 · 라벨 · 아이콘은 장식이고 이미지는 alt로 읽힌다.
      </p>
      <h3 className={catalog.heading}>자리 문구 셋 — 탐색 중 · 예약 · 없음</h3>
      <div className={catalog.stack}>
        {(Object.keys(PLACEHOLDER) as (keyof typeof PLACEHOLDER)[]).map((key) => (
          <Box key={key} title={TITLE} description={DESCRIPTION}>
            <BrowserView url={URL} src={null} alt={ALT} placeholder={PLACEHOLDER[key]} />
          </Box>
        ))}
      </div>
      <h3 className={catalog.heading}>캡처 이미지 — 강조 없음 · act · skip · 긴 주소</h3>
      <TwoColumn layout="half">
        <Box title={TITLE} description="강조 없음">
          <BrowserView url={URL} src={SHOT_A} alt={ALT} placeholder={PLACEHOLDER.none} />
        </Box>
        <Box title={TITLE} description="act">
          <BrowserView
            url={URL}
            src={SHOT_A}
            alt={ALT}
            placeholder={PLACEHOLDER.none}
            highlight={toHighlight('act', SEARCH_BUTTON)}
          />
        </Box>
      </TwoColumn>
      <TwoColumn layout="half">
        <Box title={TITLE} description="skip">
          <BrowserView
            url={URL}
            src={SHOT_B}
            alt={ALT}
            placeholder={PLACEHOLDER.none}
            highlight={toHighlight('skip', FIRST_ROW)}
          />
        </Box>
        <Box title={TITLE} description="긴 주소">
          <BrowserView url={LONG_URL} src={SHOT_B} alt={ALT} placeholder={PLACEHOLDER.none} />
        </Box>
      </TwoColumn>
      <h3 className={catalog.heading}>움직임 — 주소 교체 · 강조 이동 · 맥박</h3>
      <MotionDemo />
      <h3 className={catalog.heading}>불러오기 실패 — onImageError</h3>
      <BrokenDemo />
    </div>
  );
}

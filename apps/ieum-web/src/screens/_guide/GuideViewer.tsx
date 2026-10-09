// 카탈로그 뷰어 — 절 목록(목차) · 테마 전환 · 폭 전환 + 본문 iframe.
// 테마: 이 문서와 iframe 문서 둘의 <html data-theme>을 맞춘다(같은 출처라 부모가 iframe 문서에 직접 쓴다).
// 폭: iframe 폭을 `--frame-w`로 넘긴다(style은 `--*` 키만 — DESIGN Layout TSX style). iframe 안 창 폭이 바뀌어 부품 CSS의 @media가 실제로 바뀐다
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHref, useLocation } from 'react-router-dom';
import { ChoiceGroup, type Choice } from './ChoiceGroup';
import { FRAME_SEARCH } from './frameMode';
import { BOUNDARY_WIDTHS, DEFAULT_WIDTH, FIT_WIDTH, REVIEW_WIDTHS, type FrameWidth } from './frameWidths';
import { FIT_LABEL, GUIDE_COPY, THEME_LABEL } from './guideCopy';
import { SECTIONS } from './sections';
import { DEFAULT_THEME, THEME_CHOICES, applyTheme, type ThemeChoice } from './theme';
import styles from './GuideViewer.module.css';

const THEME_OPTIONS: readonly Choice<ThemeChoice>[] = THEME_CHOICES.map((value) => ({ value, label: THEME_LABEL[value] }));
const pxChoice = (px: number): Choice<FrameWidth> => ({ value: px, label: String(px) });
const REVIEW_OPTIONS: readonly Choice<FrameWidth>[] = [
  { value: FIT_WIDTH, label: FIT_LABEL },
  ...REVIEW_WIDTHS.map(pxChoice),
];
const BOUNDARY_OPTIONS: readonly Choice<FrameWidth>[] = BOUNDARY_WIDTHS.map(pxChoice);

const cssWidth = (width: FrameWidth): string => (width === FIT_WIDTH ? '100%' : `${width}px`);

export function GuideViewer() {
  const { pathname } = useLocation();
  const frameHref = useHref({ pathname, search: FRAME_SEARCH });
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [theme, setTheme] = useState<ThemeChoice>(DEFAULT_THEME);
  const [width, setWidth] = useState<FrameWidth>(DEFAULT_WIDTH);

  // 이 문서 테마. 카탈로그를 떠나면 시스템으로 돌려 다른 화면에 강제 테마가 남지 않게 한다
  useEffect(() => {
    applyTheme(document.documentElement, theme);
    return () => applyTheme(document.documentElement, DEFAULT_THEME);
  }, [theme]);

  // iframe 문서 테마 — 테마가 바뀔 때와 iframe이 (다시) 로드될 때
  const syncFrameTheme = useCallback(() => {
    const root = frameRef.current?.contentDocument?.documentElement;
    if (root) applyTheme(root, theme);
  }, [theme]);
  useEffect(syncFrameTheme, [syncFrameTheme]);

  // 목차 이동 — iframe 안의 절 위치로 iframe만 스크롤한다(scrollIntoView는 이 문서까지 움직일 수 있다)
  const jumpTo = (id: string) => {
    const frameWindow = frameRef.current?.contentWindow;
    const target = frameRef.current?.contentDocument?.getElementById(id);
    if (!frameWindow || !target) return;
    frameWindow.scrollTo({ top: target.getBoundingClientRect().top + frameWindow.scrollY });
  };

  return (
    <div className={styles.page}>
      <nav className={styles.toc} aria-label={GUIDE_COPY.tocLabel}>
        <h1 className={styles.tocTitle}>{GUIDE_COPY.title}</h1>
        <ul className={styles.tocList}>
          {SECTIONS.map(({ id, name }) => (
            <li key={id}>
              <button type="button" className={styles.tocButton} onClick={() => jumpTo(id)}>
                {name}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.main}>
        <div className={styles.toolbar} role="toolbar" aria-label={GUIDE_COPY.toolbarLabel}>
          <ChoiceGroup label={GUIDE_COPY.themeLabel} choices={THEME_OPTIONS} selected={theme} onSelect={setTheme} />
          <ChoiceGroup label={GUIDE_COPY.widthLabel} choices={REVIEW_OPTIONS} selected={width} onSelect={setWidth} />
          <ChoiceGroup label={GUIDE_COPY.boundaryLabel} choices={BOUNDARY_OPTIONS} selected={width} onSelect={setWidth} />
        </div>
        <div className={styles.stage}>
          <iframe
            ref={frameRef}
            className={styles.frame}
            style={{ '--frame-w': cssWidth(width) }}
            src={frameHref}
            title={GUIDE_COPY.frameTitle(width)}
            onLoad={syncFrameTheme}
          />
        </div>
      </div>
    </div>
  );
}

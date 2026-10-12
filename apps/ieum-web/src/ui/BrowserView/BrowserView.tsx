// BrowserView — 헤드리스 브라우저가 지금 보는 운영 화면. 이음 .bw · .bw-bar · .bw-view · .sh-*(css/console.css:964-980) · 쓰는 곳 js/menu/discovery.js:209-226
// 주소 줄(자물쇠 + 고정폭 주소) 아래 캡처 영역 — 늘 밝은 화면이다(--capture-*). 캡처가 없으면 자리 문구, 있으면 이미지 위에 강조 상자.
// src가 바뀌면 같은 <img>의 주소만 바꾼다 — 브라우저가 새 이미지를 받을 때까지 이전 캡처를 보여 줘 깜빡이지 않는다(옛 js/menu/discovery.js:219).
// 강조 상자 좌표는 캡처 크기에 대한 백분율 숫자(0~100)를 CSS 사용자 속성으로 넘긴다(DESIGN Layout TSX style). 기준은 이미지를 감싼 틀이다 —
// 옛은 최소 높이 300인 캡처 영역이 기준이라 이미지가 300보다 낮은 좁은 폭에서 상자가 아래로 어긋났다. 상자 · 라벨은 장식이다 — 클릭 · 건너뜀은 네트워크 기록 줄이 글자로 전한다
import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import styles from './BrowserView.module.css';

/** act = 누른 요소(실선), skip = 누르지 않고 건너뛴 요소(점선 · 위험색) */
type BrowserHighlightKind = 'act' | 'skip';

export type BrowserHighlight = Readonly<{
  kind: BrowserHighlightKind;
  /** 상자 오른쪽 위 라벨(옛 "클릭" · "건너뜀" — 쓰는 곳 copy/) */
  label: string;
  /** 왼쪽 · 위 · 폭 · 높이 — 캡처 크기에 대한 백분율(0~100) */
  x: number;
  y: number;
  w: number;
  h: number;
}>;

export type BrowserViewProps = {
  /** 주소 줄 글자(쓰는 곳이 만든다 — 운영 주소 + 지금 페이지) */
  url: ReactNode;
  /** 캡처 이미지 주소 — null이면 자리 문구 */
  src: string | null;
  /** 이미지 대체 글 */
  alt: string;
  /** 캡처가 없을 때 가운데 글(탐색 중 · 예약 · 없음 — 쓰는 곳이 copy/로 고른다) */
  placeholder: ReactNode;
  /** 강조 상자 — 캡처가 있을 때만 그린다(옛 d.hl && d.shot) */
  highlight?: BrowserHighlight | null;
  /** 이미지를 불러오지 못하면 부른다 — 쓰는 곳이 src를 비우고 자리 문구를 고른다 */
  onImageError?: () => void;
};

export function BrowserView({ url, src, alt, placeholder, highlight = null, onImageError }: BrowserViewProps) {
  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <Icon name="lock" size="sm" className={styles.barIcon} />
        <span className={styles.url}>{url}</span>
      </div>
      <div className={styles.view}>
        {src === null ? (
          <div className={styles.blank}>
            <Icon name="globe" size="hero" className={styles.blankIcon} />
            <span>{placeholder}</span>
          </div>
        ) : (
          <div className={styles.shot}>
            <img className={styles.image} src={src} alt={alt} onError={onImageError} />
            {highlight !== null ? (
              <span
                className={styles.highlight}
                data-kind={highlight.kind}
                aria-hidden="true"
                style={{ '--hl-x': highlight.x, '--hl-y': highlight.y, '--hl-w': highlight.w, '--hl-h': highlight.h }}
              >
                <span className={styles.label}>{highlight.label}</span>
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

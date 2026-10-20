// 카탈로그(/_guide) 전용 문구 — 화면 문구(src/copy)가 아니다. 개발자가 보는 도구 화면이라 check-source가 _guide의 한글을 막지 않는다
import { FIT_WIDTH, type FrameWidth } from './frameWidths';
import type { ThemeChoice } from './theme';

export const GUIDE_COPY = Object.freeze({
  title: '이음 컴포넌트 카탈로그',
  tocLabel: '절 목록',
  toolbarLabel: '보기 설정',
  themeLabel: '테마',
  widthLabel: '폭',
  boundaryLabel: '경계 폭',
  frameTitle: (width: FrameWidth) => `카탈로그 본문 — ${width === FIT_WIDTH ? '맞춤' : `폭 ${width}px`}`,
});

export const THEME_LABEL: Readonly<Record<ThemeChoice, string>> = {
  light: '라이트',
  dark: '다크',
  system: '시스템',
};
export const FIT_LABEL = '맞춤';

export const TOKENS_COPY = Object.freeze({
  note: (count: number) =>
    `tokens.css를 읽어 그린 ${count}개 토큰이다. 견본은 지금 테마의 값이고, 다크 값이 다른 토큰은 값 칸 아래에 같이 적는다.`,
  empty: 'tokens.css에서 토큰을 읽지 못했습니다. 파일의 머리 주석 형식(/* ── 이름 ── */)이 바뀌었는지 확인해 주세요.',
  columns: { name: '이름', sample: '견본', value: '값', note: '쓰는 곳' },
  darkPrefix: '다크',
  sampleText: '가나다 Abc 123',
  sampleLines: '가나다 Abc 123\n두 번째 줄',
});

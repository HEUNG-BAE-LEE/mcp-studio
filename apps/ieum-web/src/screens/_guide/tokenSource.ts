// tokens.css 원본을 읽어 토큰 표로 만든다 — 카탈로그가 값을 따로 들고 있지 않게(값은 tokens.css에만 둔다).
// 읽는 형식: 라이트 `:root { … }` 블록의 `/* ── 묶음 이름 ── */` 머리 주석과 `--이름: 값; /* 쓰는 곳 */` 선언 · 강제 다크 블록의 `--이름: 값;`
import tokensCss from '@/styles/tokens.css?raw';

export type TokenRow = Readonly<{
  name: string;
  /** 라이트(:root) 값 */
  value: string;
  /** 쓰는 곳 — 값 뒤 주석 */
  note: string;
  /** 다크에서 다른 값. 다크 블록에 없으면 null */
  darkValue: string | null;
}>;
export type TokenGroup = Readonly<{ title: string; rows: readonly TokenRow[] }>;

const LIGHT_OPENER = ':root {';
const DARK_OPENER = ":root[data-theme='dark'] {";
// 블록 닫는 중괄호는 줄 맨 앞에 있다(안쪽 선언은 들여쓴다)
const BLOCK_CLOSER = '\n}';
const HEADING = /^\s*\/\*\s*──\s*(.+?)\s*──\s*\*\/\s*$/;
const DECLARATION = /^\s*(--[\w-]+)\s*:\s*([^;]+);\s*(?:\/\*\s*(.*?)\s*\*\/)?\s*$/;

const blockAfter = (css: string, opener: string): string => {
  const start = css.indexOf(opener);
  if (start < 0) return '';
  const end = css.indexOf(BLOCK_CLOSER, start);
  return css.slice(start + opener.length, end < 0 ? undefined : end);
};

const parseDeclaration = (line: string) => {
  const [, name, value, note] = DECLARATION.exec(line) ?? [];
  return name && value ? { name, value: value.trim(), note: note ?? '' } : null;
};

const darkValues: ReadonlyMap<string, string> = new Map(
  blockAfter(tokensCss, DARK_OPENER)
    .split('\n')
    .flatMap((line) => {
      const declaration = parseDeclaration(line);
      return declaration ? [[declaration.name, declaration.value] as const] : [];
    }),
);

/** 머리 주석을 만나면 새 묶음을 열고, 선언은 가장 최근 묶음에 더한다(머리 없는 선언은 버린다 — tokens.css는 항상 머리 아래에 선언을 둔다) */
const groupLines = (groups: readonly TokenGroup[], line: string): readonly TokenGroup[] => {
  const title = HEADING.exec(line)?.[1];
  if (title) return [...groups, { title, rows: [] }];
  const declaration = parseDeclaration(line);
  const current = groups.at(-1);
  if (!declaration || !current) return groups;
  const row: TokenRow = { ...declaration, darkValue: darkValues.get(declaration.name) ?? null };
  return [...groups.slice(0, -1), { ...current, rows: [...current.rows, row] }];
};

export const TOKEN_GROUPS: readonly TokenGroup[] = blockAfter(tokensCss, LIGHT_OPENER)
  .split('\n')
  .reduce<readonly TokenGroup[]>(groupLines, []);

export const TOKEN_COUNT: number = TOKEN_GROUPS.reduce((sum, group) => sum + group.rows.length, 0);

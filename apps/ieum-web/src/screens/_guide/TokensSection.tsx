// 카탈로그 토큰 절 — tokens.css를 읽어(tokenSource) 묶음마다 이름 · 견본 · 값 · 쓰는 곳을 표로 그린다.
// 견본의 값은 사용자 속성 `--sample: var(--토큰)`으로만 넘기고, 모양은 css가 정한다. 값 리터럴은 이 파일에 없다
import { useId } from 'react';
import { TOKENS_COPY } from './guideCopy';
import { TOKEN_COUNT, TOKEN_GROUPS, type TokenGroup, type TokenRow } from './tokenSource';
import catalog from './catalog.module.css';
import styles from './TokensSection.module.css';

type SampleKind =
  | 'color'
  | 'space'
  | 'height'
  | 'width'
  | 'radius'
  | 'fontSize'
  | 'fontWeight'
  | 'lineHeight'
  | 'tracking'
  | 'fontFamily'
  | 'shadow'
  | 'border'
  | 'opacity';

const COLOR_GROUP_PREFIX = '색';
// 토큰 이름 머리 → 견본 종류. 색은 묶음 이름으로 가린다(이름이 뜻 이름이라 머리가 제각각이다)
const PREFIX_KINDS: readonly (readonly [string, SampleKind])[] = [
  ['--s-', 'space'],
  ['--h-', 'height'],
  ['--w-', 'width'],
  ['--r-', 'radius'],
  ['--fs-', 'fontSize'],
  ['--fw-', 'fontWeight'],
  ['--lh-', 'lineHeight'],
  ['--tracking-', 'tracking'],
  ['--font-', 'fontFamily'],
  ['--shadow-', 'shadow'],
  ['--ring-', 'shadow'],
  ['--edge-', 'shadow'],
  ['--halo-', 'shadow'],
  ['--bw-', 'border'],
  ['--opacity-', 'opacity'],
];

const sampleKindOf = (groupTitle: string, name: string): SampleKind | null => {
  if (groupTitle.startsWith(COLOR_GROUP_PREFIX)) return 'color';
  return PREFIX_KINDS.find(([prefix]) => name.startsWith(prefix))?.[1] ?? null;
};

const SAMPLE_CLASS: Readonly<Record<SampleKind, string | undefined>> = {
  color: styles.color,
  space: styles.space,
  height: styles.height,
  width: styles.width,
  radius: styles.radius,
  fontSize: styles.fontSize,
  fontWeight: styles.fontWeight,
  lineHeight: styles.lineHeight,
  tracking: styles.tracking,
  fontFamily: styles.fontFamily,
  shadow: styles.shadow,
  border: styles.border,
  opacity: styles.opacity,
};
// 글자 견본만 글이 들어간다 — 나머지는 모양만
const SAMPLE_TEXT: Readonly<Partial<Record<SampleKind, string>>> = {
  fontSize: TOKENS_COPY.sampleText,
  fontWeight: TOKENS_COPY.sampleText,
  lineHeight: TOKENS_COPY.sampleLines,
  tracking: TOKENS_COPY.sampleText,
  fontFamily: TOKENS_COPY.sampleText,
};

function Sample({ kind, name }: { kind: SampleKind; name: string }) {
  const className = [styles.sample, SAMPLE_CLASS[kind]].filter(Boolean).join(' ');
  return (
    <span className={className} style={{ '--sample': `var(${name})` }}>
      {SAMPLE_TEXT[kind]}
    </span>
  );
}

function TokenTableRow({ row, kind }: { row: TokenRow; kind: SampleKind | null }) {
  return (
    <tr>
      <th scope="row">
        <code>{row.name}</code>
      </th>
      <td className={styles.sampleCell}>{kind ? <Sample kind={kind} name={row.name} /> : null}</td>
      <td>
        <code>{row.value}</code>
        {row.darkValue ? (
          <small className={catalog.token}>
            {TOKENS_COPY.darkPrefix} {row.darkValue}
          </small>
        ) : null}
      </td>
      <td className={styles.note}>{row.note}</td>
    </tr>
  );
}

function TokenGroupTable({ group }: { group: TokenGroup }) {
  const headingId = useId();
  const { name, sample, value, note } = TOKENS_COPY.columns;
  return (
    <>
      <h3 id={headingId} className={catalog.heading}>
        {group.title}
      </h3>
      <div className={catalog.scroll}>
        <table className={catalog.table} aria-labelledby={headingId}>
          <thead>
            <tr>
              <th scope="col">{name}</th>
              <th scope="col">{sample}</th>
              <th scope="col">{value}</th>
              <th scope="col">{note}</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row) => (
              <TokenTableRow key={row.name} row={row} kind={sampleKindOf(group.title, row.name)} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function TokensSection() {
  if (TOKEN_GROUPS.length === 0) return <p className={catalog.note}>{TOKENS_COPY.empty}</p>;
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>{TOKENS_COPY.note(TOKEN_COUNT)}</p>
      {TOKEN_GROUPS.map((group) => (
        <TokenGroupTable key={group.title} group={group} />
      ))}
    </div>
  );
}

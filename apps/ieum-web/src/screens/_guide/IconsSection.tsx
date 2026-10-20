// 카탈로그 아이콘 절 — 절 제목(h2)은 GuideBody가 그린다. 아래는 h3부터.
// 보여 주는 것: ① 이름 × 크기 단계(기본 선) ② 크기 단계 × 선 단계(고른 이름 하나). 로고는 LogoSection. 이름 · 단계 목록은 ui가 내보내는 상수를 그대로 돌아서 더하면 저절로 표에 들어온다
import { useId, useState } from 'react';
import { ICON_NAMES, ICON_SIZES, ICON_STROKES, Icon, type IconName, type IconStroke } from '../../ui';
import catalog from './catalog.module.css';
import styles from './IconsSection.module.css';

const tableClass = [catalog.table, styles.centered].join(' ');
const PICKED_DEFAULT: IconName = 'check';
// 기본 선은 stroke를 생략한다 — 표에서는 '기본' 줄로 보인다
const STROKE_ROWS: readonly { label: string; stroke: IconStroke | undefined; token: string }[] = [
  { label: '기본', stroke: undefined, token: '--icon-stroke' },
  ...ICON_STROKES.map((stroke) => ({ label: stroke, stroke, token: `--icon-stroke-${stroke}` })),
];

function SizeHeadCells() {
  return ICON_SIZES.map((size) => (
    <th key={size} scope="col">
      <code>{size}</code>
      <small className={catalog.token}>{`--icon-${size}`}</small>
    </th>
  ));
}

export function IconsSection() {
  const pickerId = useId();
  const [picked, setPicked] = useState<IconName>(PICKED_DEFAULT);

  const pick = (value: string) => {
    const found = ICON_NAMES.find((name) => name === value);
    if (found) setPicked(found);
  };

  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        이름 {ICON_NAMES.length}종. 규격은 viewBox 24 · fill none · currentColor · round cap/join · 장식(aria-hidden)이다.
        크기와 선 두께는 단계 이름으로만 고른다 — 숫자를 넘기면 typecheck가 막는다. 서버가 주는 문자열은 iconOf로 이름을 바꿔 쓴다
        (모르는 값은 기본 아이콘).
      </p>

      <h3 className={catalog.heading}>이름 × 크기 단계 (선 기본)</h3>
      <div className={catalog.scroll}>
        <table className={tableClass}>
          <caption className={catalog.caption}>이름마다 크기 단계 아홉 개. 행 머리는 이름, 열 머리는 단계 이름과 토큰</caption>
          <thead>
            <tr>
              <th scope="col">name</th>
              <SizeHeadCells />
            </tr>
          </thead>
          <tbody>
            {ICON_NAMES.map((name) => (
              <tr key={name}>
                <th scope="row">
                  <code>{name}</code>
                </th>
                {ICON_SIZES.map((size) => (
                  <td key={size}>
                    <Icon name={name} size={size} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className={catalog.heading}>크기 단계 × 선 단계 (이름 하나)</h3>
      <div className={styles.picker}>
        <label htmlFor={pickerId}>이름</label>
        <select id={pickerId} value={picked} onChange={(event) => pick(event.target.value)}>
          {ICON_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className={catalog.scroll}>
        <table className={tableClass}>
          <caption className={catalog.caption}>
            <code>{picked}</code>의 선 단계 네 줄 × 크기 단계 아홉 칸
          </caption>
          <thead>
            <tr>
              <th scope="col">stroke</th>
              <SizeHeadCells />
            </tr>
          </thead>
          <tbody>
            {STROKE_ROWS.map(({ label, stroke, token }) => (
              <tr key={label}>
                <th scope="row">
                  <code>{label}</code>
                  <small className={catalog.token}>{token}</small>
                </th>
                {ICON_SIZES.map((size) => (
                  <td key={size}>
                    <Icon name={picked} size={size} stroke={stroke} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

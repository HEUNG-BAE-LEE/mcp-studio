// 카탈로그 Tag 절 — 색(tone 여섯) × 모양(square · round) × 크기(sm · md · lg), variant(solid · dashed · off · value · value-empty) · 관찰 값 칩 · title(cursor: help)
import { Tag, type TagShape, type TagSize, type TagTone, type TagVariant } from '../../ui';
import catalog from './catalog.module.css';
import styles from './TagSection.module.css';

const TONES: readonly TagTone[] = ['ok', 'warn', 'danger', 'info', 'mute', 'neutral'];
const SHAPES: readonly TagShape[] = ['square', 'round'];
const SIZES: readonly TagSize[] = ['sm', 'md', 'lg'];
// variant마다 이음에 있는 자리의 tone · size(없는 조합은 쓰지 않는다)
const VARIANTS: readonly { variant: TagVariant; tone: TagTone; size: TagSize }[] = [
  { variant: 'solid', tone: 'neutral', size: 'lg' },
  { variant: 'dashed', tone: 'neutral', size: 'lg' },
  { variant: 'off', tone: 'mute', size: 'md' },
  { variant: 'value', tone: 'mute', size: 'md' },
  { variant: 'value-empty', tone: 'mute', size: 'md' },
];
// 관찰 값 칩 — 관찰한 값 문자열 하나(옛 .codes span i — 라벨 없음)
const OBSERVED_VALUES = ['HR', 'FIN', 'A-20261008-0017', 'Y'] as const;

export function TagSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        상태 색(neutral은 상태가 아닌 일반 표지)만 쓰는 표지(상태 점 + 글자는 StatusChip). 높이는 sm 18 · md 20 · lg 22 고유 치수이고
        테두리가 있어도 같다. 뜻은 글자가 전하고 title은 마우스 보조다.
      </p>
      {SHAPES.map((shape) => (
        <div key={shape} className={catalog.stack}>
          <h3 className={catalog.heading}>shape={shape}</h3>
          <div className={catalog.scroll}>
            <table className={catalog.table}>
              <thead>
                <tr>
                  <th scope="col">tone</th>
                  {SIZES.map((size) => (
                    <th key={size} scope="col">
                      size={size}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TONES.map((tone) => (
                  <tr key={tone}>
                    <th scope="row">{tone}</th>
                    {SIZES.map((size) => (
                      <td key={size}>
                        <Tag tone={tone} shape={shape} size={size}>
                          추정
                        </Tag>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <h3 className={catalog.heading}>variant — 이음에 있는 자리</h3>
      <p className={catalog.note}>
        dashed는 neutral · lg(샘플 추론 프로토콜), off는 mute · md(탐색 근거 없음), value는 mute · md(관찰 값 칩), value-empty는 mute · md(관찰 없음). 이음에 없는
        조합은 쓰지 않는다.
      </p>
      <div className={catalog.row}>
        {VARIANTS.map(({ variant, tone, size }) => (
          <Tag key={variant} tone={tone} variant={variant} size={size}>
            {variant}
          </Tag>
        ))}
      </div>
      <h3 className={catalog.heading}>관찰 값 칩 — mute · md · value</h3>
      <p className={catalog.note}>
        면 · 테두리는 mute와 같고 글자는 고정폭 · --text · 보통 굵기다(옛 .codes span i). 값 문자열만 넘긴다. 첫 줄은 같은 값의
        mute 그대로(비교).
      </p>
      <div className={styles.codes}>
        {OBSERVED_VALUES.map((value) => (
          <Tag key={value} tone="mute" size="md">
            {value}
          </Tag>
        ))}
      </div>
      <div className={styles.codes}>
        {OBSERVED_VALUES.map((value) => (
          <Tag key={value} tone="mute" variant="value" size="md">
            {value}
          </Tag>
        ))}
      </div>
      <div className={styles.codes}>
        <Tag tone="mute" variant="value-empty" size="md">
          관찰 없음
        </Tag>
      </div>
      <h3 className={catalog.heading}>title</h3>
      <div className={catalog.row}>
        <Tag tone="ok" shape="round" title="마우스를 올리면 도움말 커서">
          title
        </Tag>
      </div>
    </div>
  );
}

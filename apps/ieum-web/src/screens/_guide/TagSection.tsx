// 카탈로그 Tag 절 — 색(tone 여섯) × 모양(square · round) × 크기(sm · md · lg), variant(solid · dashed · off) · title(cursor: help)
import { Tag, type TagShape, type TagSize, type TagTone, type TagVariant } from '../../ui';
import catalog from './catalog.module.css';

const TONES: readonly TagTone[] = ['ok', 'warn', 'danger', 'info', 'mute', 'neutral'];
const SHAPES: readonly TagShape[] = ['square', 'round'];
const SIZES: readonly TagSize[] = ['sm', 'md', 'lg'];
const VARIANTS: readonly TagVariant[] = ['solid', 'dashed', 'off'];

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
        dashed는 neutral · lg(샘플 추론 프로토콜), off는 mute · md(탐색 근거 없음). 이음에 없는 조합은 쓰지 않는다.
      </p>
      <div className={catalog.row}>
        {VARIANTS.map((variant) => (
          <Tag
            key={variant}
            tone={variant === 'off' ? 'mute' : 'neutral'}
            variant={variant}
            size={variant === 'off' ? 'md' : 'lg'}
          >
            {variant}
          </Tag>
        ))}
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

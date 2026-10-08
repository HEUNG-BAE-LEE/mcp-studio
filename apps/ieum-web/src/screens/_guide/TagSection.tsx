// 카탈로그 Tag 절 — 색(tone 다섯) × 모양(square · round) × 크기(sm · md · lg), 점선 · 취소선 · title(cursor: help)
import { Tag, type TagShape, type TagSize } from '../../ui/Tag';
import type { StatusTone } from '../../copy/status';
import catalog from './catalog.module.css';

const TONES: readonly StatusTone[] = ['ok', 'warn', 'danger', 'info', 'mute'];
const SHAPES: readonly TagShape[] = ['square', 'round'];
const SIZES: readonly TagSize[] = ['sm', 'md', 'lg'];

export function TagSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        상태 색만 쓰는 표지(상태 점 + 글자는 StatusChip). 높이는 sm 18 · md 20 · lg 22 고유 치수이고 테두리가 있어도 같다.
        뜻은 글자가 전하고 title은 마우스 보조다.
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
      <h3 className={catalog.heading}>dashed · strike · title</h3>
      <div className={catalog.row}>
        <Tag tone="mute" size="lg" dashed>
          샘플
        </Tag>
        <Tag tone="mute" size="md" dashed strike>
          꺼짐
        </Tag>
        <Tag tone="warn" dashed>
          dashed
        </Tag>
        <Tag tone="info" size="md" strike>
          strike
        </Tag>
        <Tag tone="ok" shape="round" title="마우스를 올리면 도움말 커서">
          title
        </Tag>
      </div>
    </div>
  );
}

// 카탈로그 ModeTag 절 — 종류(read · write) × 크기(md · sm). sm은 도구 목록 항목 안 둘째 줄에서 쓰는 크기다
import { ModeTag, type ModeKind, type ModeTagSize } from '../../ui';
import catalog from './catalog.module.css';
import styles from './ModeTagSection.module.css';

const KINDS: readonly ModeKind[] = ['read', 'write'];
const SIZES: readonly ModeTagSize[] = ['md', 'sm'];
const LABEL: Readonly<Record<ModeKind, string>> = { read: '읽기', write: '쓰기' };

export function ModeTagSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        도구의 읽기 · 쓰기 표지. 모양은 Tag(square)이고 색의 뜻만 이 부품이 맡는다 — read는 정보, write는 주의. 글자는 쓰는 곳이
        label로 준다. 쓰기가 아닌 값은 쓰는 곳이 read로 넘긴다.
      </p>
      <div className={catalog.scroll}>
        <table className={catalog.table}>
          <thead>
            <tr>
              <th scope="col">kind</th>
              {SIZES.map((size) => (
                <th key={size} scope="col">
                  size={size}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {KINDS.map((kind) => (
              <tr key={kind}>
                <th scope="row">{kind}</th>
                {SIZES.map((size) => (
                  <td key={size}>
                    <ModeTag kind={kind} label={LABEL[kind]} size={size} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className={catalog.heading}>목록 항목 안 — sm</h3>
      <div className={styles.items}>
        {KINDS.map((kind) => (
          <div key={kind} className={styles.item}>
            <span className={styles.id}>{kind === 'read' ? 'orders.search' : 'orders.create'}</span>
            <span className={styles.meta}>
              <ModeTag kind={kind} label={LABEL[kind]} size="sm" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

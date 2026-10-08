// 카탈로그 Button 절 — 변형(default · primary) × 크기(md · sm) × 아이콘 유무 × 비활성. hover는 포인터를 올려 본다
import { Button, type ButtonSize, type ButtonVariant } from '../../ui';
import catalog from './catalog.module.css';

const VARIANTS: readonly ButtonVariant[] = ['default', 'primary'];
const SIZES: readonly ButtonSize[] = ['md', 'sm'];

export function ButtonSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        이음 .btn — 테두리 버튼과 주 액션 필 둘, 높이 md(--h-md) · sm(--h-sm). 아이콘 크기는 버튼 크기를 따른다. 비활성은
        --opacity-disabled 하나이고 hover 모양이 바뀌지 않는다.
      </p>
      <div className={catalog.scroll}>
        <table className={catalog.table}>
          <thead>
            <tr>
              <th scope="col">variant</th>
              {SIZES.map((size) => (
                <th key={size} scope="col">
                  <code>{size}</code>
                </th>
              ))}
              <th scope="col">아이콘</th>
              <th scope="col">disabled</th>
            </tr>
          </thead>
          <tbody>
            {VARIANTS.map((variant) => (
              <tr key={variant}>
                <th scope="row">
                  <code>{variant}</code>
                </th>
                {SIZES.map((size) => (
                  <td key={size}>
                    <Button variant={variant} size={size}>
                      원본 시스템 연결
                    </Button>
                  </td>
                ))}
                <td>
                  <div className={catalog.row}>
                    <Button variant={variant} icon="plus">
                      묶음 만들기
                    </Button>
                    <Button variant={variant} size="sm" icon="refresh">
                      다시 읽기
                    </Button>
                  </div>
                </td>
                <td>
                  <Button variant={variant} disabled>
                    배포하는 중…
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

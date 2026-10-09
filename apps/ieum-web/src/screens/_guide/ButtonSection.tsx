// 카탈로그 Button 절 — 변형(default · primary) × 크기(md · sm) × 아이콘 유무 × 비활성(disabled) × 요청 중 잠금(pending) + xl(대화 보내기 — 아이콘만 · pending). hover는 포인터를 올려 본다.
// pending은 Tab으로 닿고(포커스 링) 눌러도 아무것도 하지 않는다 — disabled는 Tab이 건너뛴다
import { Button, type ButtonSize, type ButtonVariant } from '../../ui';
import catalog from './catalog.module.css';

const VARIANTS: readonly ButtonVariant[] = ['default', 'primary'];
// 표는 글자 버튼 단계 둘이다. xl은 대화 보내기 한 자리라 표 아래 줄에 따로 보인다
const SIZES: readonly ButtonSize[] = ['md', 'sm'];

export function ButtonSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        이음 .btn — 테두리 버튼과 주 액션 필 둘, 높이 md(--h-md) · sm(--h-sm) · xl(--h-xl). 아이콘 크기는 버튼 크기를 따른다. 비활성은
        --opacity-disabled 하나이고 hover 모양이 바뀌지 않는다. disabled는 조건이 안 맞아 못 누름(포커스를 받지 않는다), pending은
        요청 중 잠금(쓰기 버튼 — aria-disabled, 누름 무시, 포커스는 버튼에 남는다)이고 모양은 같다.
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
              <th scope="col">pending</th>
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
                    다음
                  </Button>
                </td>
                <td>
                  <Button variant={variant} pending>
                    배포하는 중…
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className={catalog.heading}>xl — 대화 입력 줄의 보내기</h3>
      <p className={catalog.note}>
        이음 .ask .btn — 높이만 --h-xl이고 안쪽 · 글자 · 아이콘(md)은 md와 같다. ChatInput 안에서 primary · 아이콘(send)만 쓰고, 글자가 없으니
        이름은 aria-label이다. 오른쪽은 요청 중 잠금(pending).
      </p>
      <div className={catalog.row}>
        <Button variant="primary" size="xl" icon="send" aria-label="보내기" />
        <Button variant="primary" size="xl" icon="send" aria-label="보내기" pending />
      </div>
    </div>
  );
}

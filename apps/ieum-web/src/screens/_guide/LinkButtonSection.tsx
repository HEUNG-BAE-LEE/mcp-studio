// 카탈로그 LinkButton 절 — 이동 링크 예시는 카탈로그 자기 주소로 가서 본문 iframe 안 화면이 바뀌지 않는다. 변형(underline · mono · back) × 버튼 · 이동 링크 · 비활성 · 요청 중 잠금(pending — Tab으로 닿고 눌러도 동작하지 않는다). hover 모양은 없고 포커스 링은 Tab으로 본다
import { LinkButton, type LinkButtonVariant } from '../../ui';
import catalog from './catalog.module.css';
import { FRAME_SEARCH } from './frameMode';

const VARIANTS: readonly LinkButtonVariant[] = ['underline', 'mono', 'back'];
const LABEL: Readonly<Record<LinkButtonVariant, string>> = {
  underline: 'AI로 다시 쓰기',
  mono: 'search_orders',
  back: '원본 시스템',
};

const noop = () => undefined;

export function LinkButtonSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        이음 .link — 색은 --primary 하나. to가 있으면 이동 링크(a), 없으면 버튼이다. hover · 비활성 모양이 없고(옛 .link에
        없음) 쓰는 곳이 글자를 진행형으로 바꿔 알린다.
      </p>
      <div className={catalog.scroll}>
          <table className={catalog.table}>
            <thead>
              <tr>
                <th scope="col">variant</th>
                <th scope="col">버튼(onClick)</th>
                <th scope="col">이동 링크(to)</th>
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
                  <td>
                    <LinkButton variant={variant} onClick={noop}>
                      {LABEL[variant]}
                    </LinkButton>
                  </td>
                  <td>
                    <LinkButton variant={variant} to={{ search: FRAME_SEARCH }}>
                      {LABEL[variant]}
                    </LinkButton>
                  </td>
                  <td>
                    <LinkButton variant={variant} onClick={noop} disabled>
                      {LABEL[variant]}
                    </LinkButton>
                  </td>
                  <td>
                    <LinkButton variant={variant} onClick={noop} pending>
                      {LABEL[variant]}
                    </LinkButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
    </div>
  );
}

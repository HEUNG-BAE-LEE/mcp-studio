// 카탈로그 MethodChip 절 — GET · POST · PUT · DELETE · 소문자 get · "*"(메서드 없음). 색은 GET(--ok)과 그 밖(--warn) 둘뿐이고 글자는 받은 값 그대로다
import { MethodChip } from '../../ui';
import catalog from './catalog.module.css';
import styles from './MethodChipSection.module.css';

const METHODS: readonly { method: string; path: string; note: string }[] = [
  { method: 'GET', path: '/api/orders', note: '읽기 — --ok' },
  { method: 'POST', path: '/api/orders', note: '그 밖 — --warn' },
  { method: 'PUT', path: '/api/orders/{id}', note: '그 밖 — --warn' },
  { method: 'DELETE', path: '/api/orders/{id}', note: '그 밖 — --warn' },
  { method: 'get', path: '/api/orders', note: '소문자 — 글자 그대로 비교라 GET이 아니다(--warn, 옛 그대로)' },
  { method: '*', path: '/legacy/Controller.java', note: '메서드 없음(Git 파일 줄) — 쓰는 곳이 "*"를 넘긴다' },
];

export function MethodChipSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        HTTP 메서드 표식. 고정폭 · 굵은 아주 작은 글자 · 각진 모서리 · 가운데 정렬 · 행간 18. GET이면 --ok, 그 밖은 --warn이고 글자는 받은
        값 그대로다. 칸 안(격자 · flex 항목)에 놓이면 칸 폭을 채운다.
      </p>
      <div className={catalog.scroll}>
        <table className={catalog.table}>
          <thead>
            <tr>
              <th scope="col">method</th>
              <th scope="col">표식</th>
              <th scope="col">경로 곁</th>
              <th scope="col">뜻</th>
            </tr>
          </thead>
          <tbody>
            {METHODS.map(({ method, path, note }) => (
              <tr key={method}>
                <th scope="row">{method}</th>
                <td>
                  <MethodChip method={method} />
                </td>
                <td>
                  <span className={styles.api}>
                    <MethodChip method={method} />
                    <span className={styles.path}>{path}</span>
                  </span>
                </td>
                <td>{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

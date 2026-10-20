// 카탈로그 EmptyState 절 — 그릇(table · panel md · sm · hero · inline · area) × 종류. 문구는 이음 지금 문구 예시(DESIGN Copy 빈 상태)
import { Button, EmptyState } from '../../ui';
import catalog from './catalog.module.css';
import styles from './EmptyStateSection.module.css';

export function EmptyStateSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        모양은 그릇(container)이 정하고 종류(kind)는 문구 · 행동을 정한다. 점선 테두리(카탈로그 표시)는 그릇이 놓이는 자리다.
      </p>

      <h3 className={catalog.heading}>table · first / filtered</h3>
      <div className={catalog.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">이름</th>
              <th scope="col">상태</th>
              <th scope="col">연결 방식</th>
            </tr>
          </thead>
          <tbody>
            <EmptyState kind="first" container="table" colSpan={3}>
              연결된 원본 시스템이 없습니다. 오른쪽 위 <b>원본 시스템 연결</b>로 시작하세요.
            </EmptyState>
          </tbody>
        </table>
      </div>
      <div className={catalog.scroll}>
        <table className={styles.table}>
          <tbody>
            <EmptyState kind="filtered" container="table" colSpan={3}>
              조건에 맞는 호출 기록이 없습니다.
            </EmptyState>
          </tbody>
        </table>
      </div>

      <h3 className={catalog.heading}>panel · first(md) / section(sm)</h3>
      <EmptyState kind="first" container="panel">
        아직 AI 도구가 없습니다.{' '}
        <button type="button" className={styles.link}>
          원본 시스템
        </button>
        을 연결하면 도구 후보가 만들어집니다.
      </EmptyState>
      <EmptyState kind="section" container="panel" size="sm">
        이번 탐색에서는 Git 소스 분석을 하지 않았습니다.
      </EmptyState>

      <h3 className={catalog.heading}>panel hero · first</h3>
      <EmptyState
        kind="first"
        container="panel"
        size="hero"
        title="연결된 원본 시스템이 없습니다"
        action={<Button variant="primary">원본 시스템 연결</Button>}
      >
        REST(OpenAPI), SOAP(WSDL) 명세나 호출 샘플로 시스템을 연결하면 AI 도구 후보가 만들어집니다.
      </EmptyState>

      <h3 className={catalog.heading}>inline · filtered / section</h3>
      <div className={catalog.frame}>
        <EmptyState kind="filtered" container="inline">
          이 조건에 맞는 도구가 없습니다.
        </EmptyState>
      </div>

      <h3 className={catalog.heading}>area · idle(empty) / section(hero)</h3>
      <div className={catalog.frame}>
        <EmptyState kind="idle" container="area" icon="layers">
          도구를 실행하면 AI의 도구 호출이 원본 시스템 요청으로
          <br />
          어떻게 바뀌는지 여기에 실제 요청과 응답으로 보여 드립니다.
        </EmptyState>
      </div>
      <div className={catalog.frame}>
        <EmptyState kind="section" container="area" icon="globe" iconSize="hero">
          캡처한 화면이 없습니다
        </EmptyState>
      </div>
    </div>
  );
}

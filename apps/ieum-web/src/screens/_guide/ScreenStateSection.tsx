// 카탈로그 ScreenState 절 — 판정 결과(gate) 다섯 × scope(screen · region). gate는 app/screenGate가 내는 모양을 손으로 만든 예시다.
// pending은 비어 있고 aria-busy만 있다 — 점선 자리가 비어 보이는 것이 맞는 모양이다
import { EmptyState, ScreenState, type ScreenGate, type ScreenStateScope } from '../../ui';
import catalog from './catalog.module.css';

type Sample = Readonly<{ count: number }>;
type Example = Readonly<{ label: string; gate: ScreenGate<Sample>; scope?: ScreenStateScope; hasNotFound?: boolean }>;

const EXAMPLES: readonly Example[] = [
  { label: 'pending — 비우고 aria-busy', gate: { kind: 'pending' } },
  { label: 'error · screen', gate: { kind: 'error', error: new Error('요청에 실패했습니다 (500)') } },
  { label: 'error · region', gate: { kind: 'error', error: new Error('서버에 연결하지 못했습니다.') }, scope: 'region' },
  { label: 'not-found — notFound 있음', gate: { kind: 'not-found' }, hasNotFound: true },
  { label: 'not-found — notFound 없음(실패로)', gate: { kind: 'not-found' } },
  { label: 'empty', gate: { kind: 'empty', data: { count: 0 } } },
  { label: 'ready', gate: { kind: 'ready', data: { count: 3 } } },
];

export function ScreenStateSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        판정은 app/screenGate(screenGate · regionGate)가 하고 이 부품은 그리기만 한다. 재시도 버튼은 없다.
      </p>
      <div className={catalog.stack}>
        {EXAMPLES.map(({ label, gate, scope, hasNotFound }) => (
          <div key={label} className={catalog.frame}>
            <p className={catalog.frameLabel}>{label}</p>
            <ScreenState
              gate={gate}
              scope={scope}
              notFound={
                hasNotFound ? (
                  <EmptyState kind="first" container="panel">
                    notFound 자리 — 문구는 탐색 작업 화면이 정한다
                  </EmptyState>
                ) : undefined
              }
              empty={() => (
                <EmptyState kind="first" container="panel">
                  발급한 키가 없습니다. 키를 발급해 AI 앱에 연결하세요.
                </EmptyState>
              )}
            >
              {(data) => <p className={catalog.note}>받은 값 {data.count}개를 그린다(children)</p>}
            </ScreenState>
          </div>
        ))}
      </div>
    </div>
  );
}

// 확인 대기 상자 — 변환 과정의 사용자 확인 단계 본문(TraceView holdSlot). 굵은 질문 · 보낸 인자 목록 · 실행 · 그만두기 · 안내
// (옛 buildRealTrace hold 갈래 — js/common/convert.js:171-175, .apv css/console.css:771-776). 확인을 마친 모양(옛 .apv.done)은 닿지 않는 코드라 없다
// "실행"은 상자에 보인 인자가 아니라 지금 폼 값 · 지금 모델로 다시 보낸다(옛 js/menu/playground.js:111,82-86 — 부르는 쪽 run).
// "그만두기"는 요청 없이 결과를 비우고 정보 토스트(옛 :112 — app/playground/store reject).
// 둘 다 누르면 이 상자가 사라진다. 사라질 때 포커스가 상자 안에 있었으면 onFocusLost로 알려 부르는 쪽이 대체 자리로 옮긴다 —
// 정리는 상자가 문서에서 빠지기 전에 돌아 그때의 포커스를 볼 수 있다(옛은 포커스를 잃었다 — 층 밖 포커스 대체 자리와 같은 규칙)
import { Fragment, useLayoutEffect, useRef } from 'react';
import { PLAYGROUND } from '../../copy/playground';
import { Button } from '@/ui';
import styles from './PlaygroundScreen.module.css';

const H = PLAYGROUND.hold;

type ApprovalBoxProps = Readonly<{
  /** 도구의 확인 질문(없으면 기본 질문 — app/playground/view holdQuestion) */
  question: string;
  /** 보낸 인자 [이름, 보이는 글] — app/playground/args holdRows */
  rows: readonly (readonly [string, string])[];
  onApprove: () => void;
  onReject: () => void;
  /** 상자가 사라질 때 포커스가 안에 있었다 — 같은 값을 계속 준다(바뀌면 정리가 다시 돈다) */
  onFocusLost: () => void;
}>;

export function ApprovalBox({ question, rows, onApprove, onReject, onFocusLost }: ApprovalBoxProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    return () => {
      if (root !== null && root.contains(document.activeElement)) onFocusLost();
    };
  }, [onFocusLost]);

  return (
    <div ref={rootRef} className={styles.approval}>
      <b className={styles.approvalQuestion}>{question}</b>
      <dl className={styles.approvalArgs}>
        {rows.map(([name, value]) => (
          <Fragment key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </Fragment>
        ))}
      </dl>
      <div className={styles.approvalActions}>
        <Button variant="primary" size="sm" onClick={onApprove}>
          {H.approve}
        </Button>
        <Button size="sm" onClick={onReject}>
          {H.reject}
        </Button>
      </div>
      <small className={styles.approvalNote}>{H.note}</small>
    </div>
  );
}

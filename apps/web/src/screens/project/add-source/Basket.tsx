// apps/web/src/screens/project/add-source/Basket.tsx — ② 바구니(312 패널): 담은 카드(수정 · 빼기 · 등록 거부 사유 줄) · 빈 상자 · 체인 Checkbox · 발 안내. PanelFoot은 ③도 쓴다
import { useId, type Dispatch } from 'react';
import {
  Button,
  Checkbox,
  CloseButton,
  EmptyState,
  InfoDot,
  InlineMessage,
  SectionHead,
  Tag,
} from '@/ui';
import { ADD_SOURCE, fieldErrorText, fieldLabelOf } from '../../../copy/addSource';
import { runtimeLine, subOf, titleOf, type BasketItem } from './model';
import type { FlowAction, FlowState } from './useAddSource';
import styles from './flow.module.css';

const B = ADD_SOURCE.basket;
export function PanelFoot({ text }: { text: string }) {
  return (
    <div className={styles.panelFoot}>
      <InfoDot glyph="i" />
      <span className={styles.panelFootText}>{text}</span>
    </div>
  );
}
type RejectedProps = {
  id: string;
  item: BasketItem;
  errors: Readonly<Record<string, string>>;
};
/** 등록 거부(400) 사유 — 칸마다 한 줄(`접속 주소 · 필수 항목이다`) */
function RejectedLines({ id, item, errors }: RejectedProps) {
  return (
    <div id={id} className={styles.cardErrors}>
      {Object.entries(errors).map(([code, reason]) => (
        <InlineMessage key={code}>
          {B.rejected(fieldLabelOf(item.type, item.mode, code), fieldErrorText(reason))}
        </InlineMessage>
      ))}
    </div>
  );
}
export function Basket({ state, dispatch }: { state: FlowState; dispatch: Dispatch<FlowAction> }) {
  const chainId = useId();
  const prefix = useId();
  const titleId = useId();
  if (!state.type) return null;
  return (
    <aside className={styles.panel} aria-labelledby={titleId}>
      <SectionHead as="h3" title={B.title} titleId={titleId} count={state.basket.length} />
      <div className={styles.basketList}>
        {state.basket.map((item) => {
          const title = titleOf(item);
          const runtime = runtimeLine(item);
          const errors = state.fieldErrors[item.id];
          const errorsId = `${prefix}-${item.id}-errors`;
          return (
            <div
              key={item.id}
              className={styles.basketCard}
              data-editing={state.editId === item.id || undefined}
            >
              <div className={styles.cardRow}>
                <span className={styles.cardTitle}>{title}</span>
                <Tag>{ADD_SOURCE.types[item.type].tag}</Tag>
                <Button
                  size="sm"
                  textStyle="label"
                  className={styles.push}
                  aria-describedby={errors ? errorsId : undefined}
                  onClick={() => dispatch({ kind: 'edit', id: item.id })}
                >
                  {B.edit}
                </Button>
                <CloseButton
                  variant="ghost"
                  aria-label={B.remove(title)}
                  onClick={() => dispatch({ kind: 'remove', id: item.id })}
                />
              </div>
              <span className={styles.cardSub}>{subOf(item)}</span>
              {runtime ? <span className={styles.cardRuntime}>{runtime}</span> : null}
              {errors ? <RejectedLines id={errorsId} item={item} errors={errors} /> : null}
            </div>
          );
        })}
        {state.basket.length === 0 ? (
          <EmptyState
            kind="nothing-yet"
            title={B.emptyTitle}
            body={
              <>
                {B.emptyBody[0]}
                <br />
                {B.emptyBody[1]}
              </>
            }
          />
        ) : null}
      </div>
      <label className={styles.chain} htmlFor={chainId}>
        <Checkbox
          id={chainId}
          checked={state.chain}
          onCheckedChange={() => dispatch({ kind: 'chain' })}
          className={styles.chainBox}
        />
        <span className={styles.chainText}>
          <span className={styles.chainTitle}>{B.chainTitle}</span>
          <span className={styles.chainNote}>{B.chainNote}</span>
        </span>
      </label>
      <PanelFoot text={ADD_SOURCE.types[state.type].foot} />
    </aside>
  );
}

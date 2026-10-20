// MethodChip — HTTP 메서드 표식. 이음 .mth(css/console.css:994-996) · 쓰는 곳 js/menu/discovery.js:199,206,281
// GET이면 --ok, 그 밖은 --warn(DESIGN Colors ③ 메서드 표식). 도메인 표식이라 Tag의 tone에 넣지 않고 이 부품이 맡는다
import styles from './MethodChip.module.css';

/** 읽기로 보는 메서드 — 옛 `x.m === 'GET'`(js/menu/discovery.js:199)과 같게 글자 그대로 견준다 */
const READ_METHOD = 'GET';

export type MethodChipProps = {
  /** 글자 — 받은 값 그대로. 메서드가 없으면 쓰는 곳이 "*"를 넘긴다(Git 파일 줄 js/menu/discovery.js:206) */
  method: string;
};

export function MethodChip({ method }: MethodChipProps) {
  return (
    <span className={styles.root} data-tone={method === READ_METHOD ? 'ok' : 'warn'}>
      {method}
    </span>
  );
}

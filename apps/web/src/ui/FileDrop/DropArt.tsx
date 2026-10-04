// 첨부 그림 52×44(색은 토큰 클래스). 세 번째 경로만 stroke-linejoin
import styles from './FileDrop.module.css';

export function DropArt() {
  return (
    <svg width="52" height="44" viewBox="0 0 52 44" fill="none" focusable="false">
      <path
        className={styles.line}
        d="M8 5.5h11a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-22a3 3 0 0 1 3-3z"
        strokeWidth="1.4"
      />
      <path
        className={`${styles.line} ${styles.paper}`}
        d="M17 10.5h13.6L38 18v18a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3V13.5a3 3 0 0 1 3-3z"
        strokeWidth="1.4"
      />
      <path className={styles.line} d="M30 10.8V18h7.4" strokeWidth="1.4" strokeLinejoin="round" />
      <circle className={styles.circle} cx="29" cy="33" r="8.5" />
      <path
        className={styles.plus}
        d="M29 29.4v7.2M25.4 33h7.2"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

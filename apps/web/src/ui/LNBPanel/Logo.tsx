import styles from './Logo.module.css';

/** 앱 로고 자리(20×20 · 1.5px 테두리). LNBPanel 머리와 LNB 접힘 레일이 함께 쓴다 */
export function LNBLogo() {
  return <span className={styles.logo} aria-hidden="true" />;
}

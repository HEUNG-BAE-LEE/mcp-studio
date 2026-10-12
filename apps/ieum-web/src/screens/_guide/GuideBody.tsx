// 카탈로그 본문 — 절 목록을 차례로 그린다. 뷰어(GuideViewer)는 이 본문을 폭이 정해진 iframe으로 띄워
// 부품 CSS의 @media가 상자 폭이 아니라 창 폭(iframe 폭)으로 계산되게 한다
import { SECTIONS } from './sections';
import styles from './GuideBody.module.css';

export function GuideBody() {
  return (
    <main className={styles.body}>
      {SECTIONS.map(({ id, name, Component }) => (
        <section key={id} id={id} className={styles.section}>
          <h2 className={styles.title}>{name}</h2>
          <Component />
        </section>
      ))}
    </main>
  );
}

import { useState } from 'react';
import { Button } from '@/ui';
import styles from './GuideScreen.module.css';
import { SECTIONS } from './sections';

/** 컴포넌트 카탈로그(/_guide) — 모든 컴포넌트 · 변형 · 화면 틀 예를 한 페이지에. DEV에서만 라우트 등록 */
export function GuideScreen() {
  const [narrow, setNarrow] = useState(false);
  const groups = [...new Set(SECTIONS.map((s) => s.group))];
  return (
    <div className={styles.layout}>
      <nav className={styles.toc} aria-label="목차">
        {groups.map((group) => (
          <div key={group}>
            <div className={styles.group}>{group}</div>
            {SECTIONS.filter((s) => s.group === group).map((s) => (
              <a key={s.name} className={styles.tocItem} href={`#${s.name}`}>
                {s.name}
              </a>
            ))}
          </div>
        ))}
      </nav>
      <main className={[styles.main, narrow && styles.narrow].filter(Boolean).join(' ')}>
        <div className={styles.bar}>
          <Button size="sm" onClick={() => setNarrow((v) => !v)} aria-pressed={narrow}>
            1024 {narrow ? '켜짐' : '꺼짐'}
          </Button>
        </div>
        {SECTIONS.map((s) => (
          <section key={s.name} id={s.name} className={styles.section}>
            <h2 className={styles.title}>{s.name}</h2>
            {s.render()}
          </section>
        ))}
      </main>
    </div>
  );
}

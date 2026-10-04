// 표식 절(StatusChip · CountDot · Tag) — sections.tsx가 BASE_SECTIONS에 순서대로 잇는다
import { useState } from 'react';
import { Button, CountDot, StatusChip, Tag } from '@/ui';
import styles from './GuideScreen.module.css';
import type { GuideSection } from './sections';

const GUIDE_TAGS = ['인수심사', '보험', '내부'] as const;

/** 편집형 칩 — ✕로 지운다(불변: 새 배열) */
function GuideRemovableTags() {
  const [tags, setTags] = useState<readonly string[]>(GUIDE_TAGS);
  return (
    <div className={styles.row}>
      {tags.map((tag) => (
        <Tag key={tag} onRemove={() => setTags((prev) => prev.filter((t) => t !== tag))}>
          {tag}
        </Tag>
      ))}
      {tags.length === 0 ? (
        <Button size="sm" onClick={() => setTags(GUIDE_TAGS)}>
          되돌리기
        </Button>
      ) : null}
    </div>
  );
}

export const MARK_SECTIONS: readonly GuideSection[] = [
  {
    group: '표식',
    name: 'StatusChip',
    render: () => (
      <div className={styles.grid}>
        {(['bg', 'soft'] as const).map((surface) =>
          (['md', 'lg'] as const).map((size) => (
            <div key={`${surface}-${size}`} className={styles.cell}>
              {(['done', 'progress', 'fix', 'idle'] as const).map((tier) => (
                <StatusChip key={tier} tier={tier} surface={surface} size={size}>
                  {tier} {surface} {size}
                </StatusChip>
              ))}
            </div>
          )),
        )}
      </div>
    ),
  },
  {
    group: '표식',
    name: 'CountDot',
    render: () => (
      <div className={styles.grid}>
        <div className={styles.cell}>
          <CountDot count={2} />
          <CountDot count={120} tone="progress" />
        </div>
      </div>
    ),
  },
  {
    group: '표식',
    name: 'Tag',
    render: () => (
      <div className={styles.grid}>
        <div className={styles.cell}>
          <span className={styles.caption}>
            label(기본) — 자원 종류 · 이름 붙은 값, 모두 중립색
          </span>
          <div className={styles.row}>
            {(['DB', '문서', 'Git', '커넥터'] as const).map((label) => (
              <Tag key={label}>{label}</Tag>
            ))}
          </div>
        </div>
        <div className={styles.cell}>
          <span className={styles.caption}>onRemove — LNB 태그 편집</span>
          <GuideRemovableTags />
        </div>
      </div>
    ),
  },
];

// apps/web/src/screens/project/add-source/TypeCard.tsx — ① 타입 카드: 그림 머리(소스 태그 · 표시 상자 · 삽화) · 이름 · 설명 · 방식 · 결과물 · 연결 정보 미리보기 · 자동화 게이지 + 설명 툴팁.
// 카드 누름 = 이름 버튼(aria-pressed · 이름 = 타입 이름) — ::after가 카드 전체를 덮고, 툴팁 점은 그 위에 놓인 형제(DESIGN 접근성 `순서` · COMPONENTS RowCard 꼴)
import { Illust, InfoDot, Tag, Tooltip } from '@/ui';
import type { SourceType } from '../../../api/types';
import { useAppStore } from '../../../app/store';
import { ADD_SOURCE, formOf } from '../../../copy/addSource';
import { AUTOMATION, AUTOMATION_STEPS, MODES, PEEK_COUNT } from './model';
import styles from './TypeCard.module.css';

type Props = {
  type: SourceType;
  selected: boolean;
  onPick: () => void;
};

export function TypeCard({ type, selected, onPick }: Props) {
  const copy = ADD_SOURCE.types[type];
  const fields = formOf(type, MODES[type][0] ?? 'url');
  const required = fields.filter((f) => f.required).length;
  // 1024 — 설명을 세 줄까지(TypeCard.module.css)
  const narrow = useAppStore((s) => s.narrow);
  return (
    <div
      className={styles.card}
      data-selected={selected || undefined}
      data-narrow={narrow || undefined}
    >
      <div className={styles.art}>
        <div className={styles.artTop}>
          {/* 태그가 이름과 같으면(문서) 한 번만 보인다 */}
          {copy.tag === copy.name ? null : <span className={styles.tag}>{copy.tag}</span>}
          <span className={styles.mark} aria-hidden="true">
            {selected ? '✓' : ''}
          </span>
        </div>
        <div className={styles.pic}>
          <Illust name={type === 'code' ? 'git' : type} />
        </div>
      </div>
      <div className={styles.body}>
        <div className={styles.intro}>
          <button type="button" className={styles.name} aria-pressed={selected} onClick={onPick}>
            {copy.name}
          </button>
          <span className={styles.desc}>{copy.desc}</span>
          <div className={styles.how}>
            <span className={styles.howText}>{copy.how}</span>
          </div>
        </div>
        <div className={styles.section}>
          <span className={styles.label}>{ADD_SOURCE.card.gets}</span>
          <div className={styles.gets}>
            {copy.gets.map((g) => (
              <Tag key={g}>{g}</Tag>
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <div className={styles.fieldsHead}>
            <span className={styles.label}>{ADD_SOURCE.card.fields}</span>
            <span className={styles.fieldCount}>
              {ADD_SOURCE.card.fieldCount(required, fields.length - required)}
            </span>
          </div>
          <div className={styles.peek}>
            {fields.slice(0, PEEK_COUNT).map((f) => (
              <div key={f.code} className={styles.peekItem}>
                <span className={styles.dot} data-required={f.required || undefined} />
                <span className={styles.peekLabel}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <div className={styles.autoHead}>
            <span className={styles.label}>{ADD_SOURCE.card.automation}</span>
            <Tooltip
              variant="note"
              content={copy.autoNote}
              side="top"
              align="start"
              alignOffset={-8}
            >
              <InfoDot
                glyph="!"
                interactive
                className={styles.over}
                aria-label={ADD_SOURCE.card.automationHelp}
              />
            </Tooltip>
          </div>
          <div className={styles.gauge}>
            {Array.from({ length: AUTOMATION_STEPS }, (_, i) => (
              <span key={i} className={styles.seg} data-on={i < AUTOMATION[type] || undefined} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

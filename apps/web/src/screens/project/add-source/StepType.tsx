// apps/web/src/screens/project/add-source/StepType.tsx — ① 타입 카드 3(grid 3열 gap 14). 툴팁은 흐름 층 내용 상자로 포털한다(Tooltip이 층 안을 안다)
import type { SourceType } from '../../../api/types';
import { ADD_SOURCE } from '../../../copy/addSource';
import { SOURCE_TYPES } from './model';
import { TypeCard } from './TypeCard';
import styles from './flow.module.css';

export function StepType({
  selected,
  onPick,
}: {
  selected: SourceType | null;
  onPick: (type: SourceType) => void;
}) {
  return (
    <div className={styles.typeGrid} role="group" aria-label={ADD_SOURCE.steps.type.title}>
      {SOURCE_TYPES.map((type) => (
        <TypeCard key={type} type={type} selected={selected === type} onPick={() => onPick(type)} />
      ))}
    </div>
  );
}

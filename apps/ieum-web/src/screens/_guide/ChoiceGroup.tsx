// 도구 막대의 고르기 묶음 — 눌린 칩 하나가 지금 선택이다(aria-pressed). 테마 · 폭 전환이 같이 쓴다
import styles from './ChoiceGroup.module.css';

export type Choice<T> = Readonly<{ value: T; label: string }>;

type ChoiceGroupProps<T> = {
  label: string;
  choices: readonly Choice<T>[];
  selected: T;
  onSelect: (value: T) => void;
};

export function ChoiceGroup<T extends string | number>({ label, choices, selected, onSelect }: ChoiceGroupProps<T>) {
  return (
    <div role="group" aria-label={label} className={styles.group}>
      <span className={styles.label} aria-hidden="true">
        {label}
      </span>
      <div className={styles.chips}>
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            className={styles.chip}
            aria-pressed={choice.value === selected}
            onClick={() => onSelect(choice.value)}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}

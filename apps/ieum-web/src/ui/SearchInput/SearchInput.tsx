// SearchInput — 이음 .search(css/console.css:138-144). 입력할 때마다 바로 부른다 — 한글 조합을 기다리지 않는다(js/menu/logs.js:59-61)
import { Icon } from '../icons/Icon';
import styles from './SearchInput.module.css';

export type SearchInputVariant = 'toolbar' | 'full';

export type SearchInputProps = {
  value: string;
  /** 입력할 때마다 바로 — 조합 중에도 */
  onValueChange: (value: string) => void;
  /** 입력 이름(aria-label) */
  label: string;
  placeholder?: string;
  /** toolbar = 툴바형, full = 패널 전폭형 */
  variant?: SearchInputVariant;
};

export function SearchInput({ value, onValueChange, label, placeholder, variant = 'toolbar' }: SearchInputProps) {
  return (
    <div className={styles.root} data-variant={variant}>
      <input
        type="search"
        className={styles.input}
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => onValueChange(event.currentTarget.value)}
      />
      <span className={styles.icon} aria-hidden="true">
        <Icon name="search" size="md" />
      </span>
    </div>
  );
}

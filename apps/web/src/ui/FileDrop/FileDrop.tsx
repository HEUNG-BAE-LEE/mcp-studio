// 파일 첨부 상자(흐름 문서 · 파일 올리기). 드래그 · 클릭 둘 다 같은 입력으로 받는다. 파일 내용은 읽지 않는다(호출자 몫)
import { forwardRef, useId, type DragEvent } from 'react';
import { cx } from '../lib/cx';
import { DropArt } from './DropArt';
import styles from './FileDrop.module.css';

export type FileDropProps = {
  /** 안내 두 줄 */
  lines: readonly [string, string];
  /** 둘째 줄 뒤 faint 형식 목록 */
  formats: string;
  /** 입력의 접근 가능한 설명(aria-describedby). 이름은 보이는 두 줄에서 온다 */
  description: string;
  accept?: string;
  multiple?: boolean;
  onFiles: (files: readonly File[]) => void;
  className?: string;
};

/** accept 한 항목(.ext · type/* · type/sub)에 파일이 맞는지 */
function matchesAccept(file: File, accept: string | undefined): boolean {
  const tokens = (accept ?? '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

function preventDefault(event: DragEvent<HTMLLabelElement>) {
  event.preventDefault();
}

export const FileDrop = forwardRef<HTMLInputElement, FileDropProps>(function FileDrop(
  { lines, formats, description, accept, multiple, onFiles, className },
  ref,
) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const list = event.dataTransfer.files;
    if (!list?.length) return;
    const accepted = Array.from(list).filter((file) => matchesAccept(file, accept));
    const files = multiple ? accepted : accepted.slice(0, 1);
    if (files.length > 0) onFiles(files);
  };
  return (
    <label
      htmlFor={id}
      className={cx(styles.root, className)}
      onDragOver={preventDefault}
      onDrop={onDrop}
    >
      <span className={styles.art} aria-hidden="true">
        <DropArt />
      </span>
      <span className={styles.text}>
        {lines[0]}
        <br />
        {lines[1]} <span className={styles.formats}>{formats}</span>
      </span>
      <input
        id={id}
        ref={ref}
        type="file"
        className={styles.input}
        aria-describedby={descriptionId}
        accept={accept}
        multiple={multiple}
        onChange={(event) => {
          const list = event.currentTarget.files;
          if (list?.length) onFiles(Array.from(list));
          event.currentTarget.value = '';
        }}
      />
      <span id={descriptionId} className={styles.description} aria-hidden="true">
        {description}
      </span>
    </label>
  );
});

// 카탈로그 FileDrop 절 — 고르기 전 · 고른 뒤(파일 이름 문장) · 설명 없음 · resetKey로 같은 파일 다시 고르기. 호버 · 포커스(상자 링)는 직접 눌러 본다
import { useState } from 'react';
import { FILE_DROP_MAX_BYTES, FileDrop } from '../../ui';
import catalog from './catalog.module.css';
import styles from './FileDropSection.module.css';

const BYTES_PER_MB = 1024 * 1024;

export function FileDropSection() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [pickCount, setPickCount] = useState(0);

  const handleSelect = (file: File) => {
    setPickCount((count) => count + 1);
    if (file.size > FILE_DROP_MAX_BYTES) return;
    setFileName(file.name);
    setResetKey((key) => key + 1);
  };

  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        점선 상자 전체가 파일 입력이다(투명). 누르면 파일 창이 열리고 끌어 놓기는 브라우저 기본이다. 포커스 링은 상자에 그린다.
        크기 한도 {FILE_DROP_MAX_BYTES / BYTES_PER_MB}MB는 쓰는 곳이 견줘 경고만 띄우고, 읽기에 성공한 뒤에만 resetKey를 바꿔 같은
        파일을 다시 고를 수 있게 한다.
      </p>
      <div className={styles.demo}>
        <h3 className={catalog.heading}>고르기 전 · 설명 있음</h3>
        <FileDrop label="명세 파일 선택" title="명세 파일을 눌러서 고르세요" description=".json, .yaml 파일, 최대 10MB" onSelect={() => undefined} />
        <h3 className={catalog.heading}>고른 뒤 — 실제로 골라 본다(고른 횟수 {pickCount})</h3>
        <FileDrop
          label="명세 파일 선택"
          title={fileName !== null ? `${fileName} 올림` : '명세 파일을 눌러서 고르세요'}
          description=".wsdl, .xml 파일, 최대 10MB"
          onSelect={handleSelect}
          resetKey={resetKey}
        />
        <h3 className={catalog.heading}>설명 없음</h3>
        <FileDrop label="파일 선택" title="파일을 눌러서 고르세요" onSelect={() => undefined} />
      </div>
    </div>
  );
}

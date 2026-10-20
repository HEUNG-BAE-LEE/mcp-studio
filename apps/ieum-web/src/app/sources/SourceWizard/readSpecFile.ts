// 명세 파일 읽기 — 옛 wzFile(js/menu/sources.js:190-196): 10MB를 넘으면 읽지 않고, 아니면 FileReader로 글자로 읽는다.
// 결과를 상태에 두는 일 · 토스트는 쓰는 곳(SourceWizard)이 한다. 옛은 읽기 실패(onerror)를 다루지 않아 아무 일도 없었다 —
// 화면은 옛 그대로 두고 원문만 개발 콘솔에 남긴다
import { FILE_DROP_MAX_BYTES } from '@/ui';

export type SpecFileRead =
  | Readonly<{ kind: 'tooBig' }>
  | Readonly<{ kind: 'read'; fileName: string; specText: string }>
  | Readonly<{ kind: 'failed' }>;

/** FileReader.readAsText 그대로(BOM으로 인코딩을 알아보는 것까지 옛과 같다) */
const readAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsText(file);
  });

export async function readSpecFile(file: File): Promise<SpecFileRead> {
  if (file.size > FILE_DROP_MAX_BYTES) return { kind: 'tooBig' };
  try {
    return { kind: 'read', fileName: file.name, specText: await readAsText(file) };
  } catch (error) {
    console.warn('[sources] spec file read failed', error);
    return { kind: 'failed' };
  }
}

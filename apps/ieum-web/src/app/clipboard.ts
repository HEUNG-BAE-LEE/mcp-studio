// 글자 복사. 옛 콘솔과 같이 navigator.clipboard.writeText 하나만 쓰고 대체 복사(execCommand 등)는 두지 않는다
// (js/common/overlay.js:34-37 · audit parity/shell.md SH-101). 성공 · 실패 토스트 문구는 부르는 쪽이 정한다
export async function copyText(text: string): Promise<boolean> {
  try {
    // 비보안 컨텍스트(http 비-localhost)에서는 navigator.clipboard가 없다 — 그 TypeError도 실패로 받는다
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.warn('[clipboard] 자동 복사가 막혔습니다', error);
    return false;
  }
}

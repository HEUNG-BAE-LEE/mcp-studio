// apps/web/src/app/FailureBlock.tsx — 실패 블록 자리 하나(DESIGN 실패): 아는 code(copy/errors KNOWN_FAILURE)는 InlineMessage 한 줄,
// 모르는 code는 ErrorBlock 원문 + 복사. 판정은 copy/errors, 그리기는 ui — screenGate처럼 ui가 copy를 모르게 여기서 잇는다
import { ErrorBlock, InlineMessage } from '@/ui';
import { errorRaw, knownFailure } from '../copy/errors';
import { platform } from '../platform';

/** `failure` — 요청 실패(TanStack `error`). 없으면(`null` · `undefined`) 아무것도 그리지 않는다 */
export function FailureBlock({ failure }: { failure: unknown }) {
  if (failure == null) return null;
  const known = knownFailure(failure);
  if (known) return <InlineMessage>{known}</InlineMessage>;
  const raw = errorRaw(failure);
  return <ErrorBlock raw={raw} onCopy={() => platform.copyText(raw)} />;
}

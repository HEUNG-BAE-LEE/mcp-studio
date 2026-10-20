// 검증 결과 → 라벨 · 색의 뜻. 탐색 결과 표 · 근거 드로어와 변환 스튜디오의 탐색 안내 띠가 같이 쓴다(옛 dVerify — js/menu/discovery.js:169-173,
// js/menu/studio.js:62). 상태 목록(copy/status)이 아니라 여기서 고른다 — 라벨에 서버 숫자(코드 · ms)가 들어간다.
// 모르는 값 · 검증 정보가 없는 도구는 "미검증"이다(옛 그대로 — 모르는 상태 값 폴백과 다르다)
import type { Verify } from '../../api/types';
import { DISCOVERY } from '../../copy/discovery';
import type { StatusTone } from '../../copy/status';

export type VerifyLabel = Readonly<{ label: string; tone: StatusTone }>;

const K = DISCOVERY.verify;
const UNVERIFIED: VerifyLabel = Object.freeze({ label: K.none, tone: 'mute' });

export function verifyLabel(verify: Verify | undefined): VerifyLabel {
  if (verify === undefined) return UNVERIFIED;
  const { code, ms } = verify;
  switch (verify.k) {
    case 'ok':
      return { label: K.ok(code, ms), tone: 'ok' };
    case 'file':
      return { label: K.file(code), tone: 'warn' };
    case '404':
      return { label: K.notFound, tone: 'danger' };
    case 'err':
      return { label: code ? K.err(code) : K.failed, tone: 'danger' };
    case 'stg':
      return { label: K.stg(code, ms), tone: 'ok' };
    case 'stgerr':
      return { label: K.stgErr(code), tone: 'danger' };
    case 'block':
      return { label: K.block, tone: 'mute' };
    case 'out':
      return { label: K.out, tone: 'mute' };
    default:
      return UNVERIFIED;
  }
}

// 탐색 모드 단계 검증 — 첫 실패 하나의 경고 토스트 문장, 통과면 null(옛 discWzCheck — js/menu/discovery.js:89-102).
// 입력 칸에 오류 모양은 그리지 않는다(옛도 토스트만). 2→3단계로 넘어갈 때 checkTarget, 탐색 시작 · 예약을 누를 때 checkSafety
import { DISCOVERY } from '../../../../copy/discovery';
import type { DiscoverState } from './discoverState';

const HTTP_URL = /^https?:\/\/\S+/;
const K = DISCOVERY.check;

/** 2단계(탐색 대상) — 화면 탐색 · 스테이징 검증에는 운영 주소, 화면 탐색에는 테스트 계정, Git에는 저장소 */
export function checkTarget(d: DiscoverState): string | null {
  if ((d.crawl || d.stg) && !HTTP_URL.test(d.base.trim())) return K.base;
  if (d.crawl && !d.account.trim()) return K.account;
  if (d.git && !d.repo.trim()) return K.repo;
  return null;
}

/** 3단계(안전 설정) — 스테이징 주소 · 예약 시각 · 담당자 · 승인 */
export function checkSafety(d: DiscoverState): string | null {
  if (d.stg && !HTTP_URL.test(d.stgUrl.trim())) return K.stgUrl;
  if (d.when === 'at' && !d.startTime) return K.startTime;
  if (!d.owner.trim()) return K.owner;
  if (!d.ok) return K.approve;
  return null;
}

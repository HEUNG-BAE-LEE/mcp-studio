// 호출 로그 상세의 열림 — 주소 ?log=<id>가 열려는 행이고, 드로어는 그 열기의 응답을 받은 뒤에만 열린다(받는 동안 표시 없음).
// 옛 openLog(apps/web/ieum/js/menu/logs.js:30-31): 행을 누를 때마다 GET, 실패면 경고 토스트(서버 문장)만 띄우고 return — 드로어는 건드리지 않는다.
// 경쟁 처리:
// - 열기마다 누른 행과 시각(opening)을 둔다. 그 뒤에 받은 응답 · 실패만 그 열기의 결과다 — 캐시에 남은 이전 응답으로 열지 않는다
// - 받아서 드로어에 그린 기록은 다시 받지 않는다 — 주소 id가 그린 기록과 같으면, 그 행을 새로 누른 열기가 아닌 한 상세 조회에 id를 넘기지 않는다.
//   누른 행을 시각과 함께 두는 까닭: 주소는 누른 다음 렌더에 바뀌므로, 시각만 두면 그 사이 한 렌더에서 열려 있던 기록을 새 열기로 보고 다시 받는다
// - 빠르게 다른 행을 누르면 주소의 id가 바뀌어 쿼리 키가 바뀌고, 이전 요청은 관찰자를 잃어 중단된다 — 마지막 클릭이 이긴다
//   (옛은 응답이 온 순서대로 드로어를 덮어 마지막 응답이 이겼다)
// - 같은 행을 다시 누르면 다시 받는다(진행 중이면 그것을 끊고 새로) — 옛도 누를 때마다 GET이었다
// - 화면을 떠나면 관찰자가 사라져 요청이 중단되고 이 상태 · 효과도 함께 사라진다 — 늦게 온 응답 · 실패로 드로어 · 토스트를 띄우지 않는다
// - 열린 채 다른 행을 열면(층이 포커스를 가두지 않아 키보드로 표에 닿는다) 새 응답이 올 때까지 열린 내용을 둔다(옛 openDrawer가 내용만 바꿨다)
// - 실패: 경고 토스트(서버 문장 그대로). 드로어가 열려 있으면 그 기록을 그대로 두고 주소를 그 기록으로 되돌린다 — 그 기록을 다시 받지 않는다.
//   닫혀 있으면 주소에서 log를 뺀다
// - 주소 값이 로그 id 모양이 아니면 요청 없이(점 세그먼트가 다른 경로로 가지 않게) 서버 404와 같은 문장으로 알린 뒤 뺀다
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isLogId, useLogDetail } from '../../api/hooks/useLogs';
import type { LogDetail } from '../../api/types';
import { toast } from '../../app/toast';
import { NOT_FOUND } from '../../copy/errors';
import { withParam } from '../../app/searchParams';
import { LOG_PARAM } from './logFilter';

/** 드로어에 그린 기록. at은 그 응답을 받은 시각 — 같은 열기의 같은 응답으로 다시 열지 않는 표지. 닫혀도 기록은 남긴다(닫히는 전환 동안 비지 않게) */
export type ShownLog = Readonly<{ log: LogDetail; at: number; open: boolean }>;

export type LogDrawer = Readonly<{
  shown: ShownLog | null;
  /** 행을 누름 — 그 행의 상세를 새로 받아 연다 */
  openLog: (id: string) => void;
  /** ✕ · 닫기 버튼 · Esc · 가림막 */
  close: () => void;
}>;

/** 지금 열기 — 누른 행과 누른 때(epoch ms). 주소로 바로 들어온 처음 열기는 누른 행이 없다 */
type Opening = Readonly<{ id: string | null; at: number }>;
const NO_OPENING: Opening = { id: null, at: 0 };

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** 상세 조회에 넘길 id — 주소 id가 그린 기록과 같으면, 그 행을 그 기록 뒤에 새로 누른 경우에만 넘긴다(아니면 null — 다시 받지 않는다) */
const fetchIdOf = (validId: string | null, shown: ShownLog | null, opening: Opening): string | null => {
  if (validId === null) return null;
  if (validId !== shown?.log.id) return validId;
  return opening.id === validId && opening.at > shown.at ? validId : null;
};

type SetLogParam = (id: string | null) => void;

type FailureNoticeInput = Readonly<{
  fetchId: string | null;
  detail: ReturnType<typeof useLogDetail>;
  /** 지금 열기의 시각 — 그 뒤의 실패만 이번 열기의 실패다 */
  openingAt: number;
  shown: ShownLog | null;
  setOpening: (opening: Opening) => void;
  setLogParam: SetLogParam;
}>;

/**
 * 이번 열기의 실패 — 경고 토스트 뒤 열린 드로어는 그대로(주소를 그 기록으로 되돌리고 열기도 그 기록에 맞춰 다시 받지 않게),
 * 닫혀 있으면 주소에서 log를 뺀다. 같은 실패를 두 번 알리지 않는다
 */
function useFailureNotice({ fetchId, detail, openingAt, shown, setOpening, setLogParam }: FailureNoticeInput): void {
  const failedAt = fetchId !== null && detail.isError && detail.errorUpdatedAt >= openingAt ? detail.errorUpdatedAt : null;
  const failure = failedAt === null ? null : messageOf(detail.error);
  const handledFailure = useRef<number | null>(null);
  useEffect(() => {
    if (failedAt === null || failure === null || handledFailure.current === failedAt) return;
    handledFailure.current = failedAt;
    toast.warn(failure);
    if (shown?.open) {
      setOpening({ id: shown.log.id, at: shown.at });
      setLogParam(shown.log.id);
      return;
    }
    setLogParam(null);
  }, [failedAt, failure, shown, setOpening, setLogParam]);
}

/** 로그 id 모양이 아닌 주소 값 — 요청하지 않고 서버 404와 같은 문장으로 알린 뒤 뺀다. 개발 모드의 효과 두 번 실행에도 한 번만 */
function useInvalidIdNotice(invalidId: string | null, setLogParam: SetLogParam): void {
  const handledInvalid = useRef<string | null>(null);
  useEffect(() => {
    if (invalidId === null) {
      handledInvalid.current = null;
      return;
    }
    if (handledInvalid.current === invalidId) return;
    handledInvalid.current = invalidId;
    toast.warn(NOT_FOUND);
    setLogParam(null);
  }, [invalidId, setLogParam]);
}

export function useLogDrawer(): LogDrawer {
  const [params, setParams] = useSearchParams();
  const requested = params.get(LOG_PARAM.log);
  const validId = isLogId(requested) ? requested : null;
  // 주소로 바로 들어온 처음 열기는 캐시가 없어(gcTime 0) 시각이 0이어도 받은 응답이 곧 이번 응답이다
  const [opening, setOpening] = useState<Opening>(NO_OPENING);
  const [shown, setShown] = useState<ShownLog | null>(null);
  const fetchId = fetchIdOf(validId, shown, opening);
  const detail = useLogDetail(fetchId);
  const { refetch } = detail;

  const setLogParam = useCallback(
    (id: string | null) => setParams((prev) => withParam(prev, LOG_PARAM.log, id), { replace: true }),
    [setParams],
  );

  // 이번 열기의 응답이 오면 연다 — 렌더 중에 고친다(이전 렌더와 비교하는 React 패턴). 같은 응답(객체 · 받은 시각)이면 다시 열지 않아
  // 닫은 직후 주소가 아직 바뀌기 전이어도 되살아나지 않는다
  const fresh = fetchId !== null && detail.isSuccess && detail.dataUpdatedAt >= opening.at ? detail.data : undefined;
  if (fresh !== undefined && (shown?.log !== fresh || shown.at !== detail.dataUpdatedAt)) {
    setShown({ log: fresh, at: detail.dataUpdatedAt, open: true });
  }
  // 주소에서 log가 빠지면(닫기 · 실패 · 같은 메뉴 다시 누르기) 닫는다
  if (requested === null && shown?.open) setShown({ ...shown, open: false });

  useFailureNotice({ fetchId, detail, openingAt: opening.at, shown, setOpening, setLogParam });
  useInvalidIdNotice(requested !== null && validId === null ? requested : null, setLogParam);

  const openLog = useCallback(
    (id: string) => {
      setOpening({ id, at: Date.now() });
      if (id !== requested) {
        setLogParam(id);
        return;
      }
      // 주소가 이미 그 행이고 받는 중(드로어에 아직 없음)이면 키가 그대로라 스스로 다시 받지 않는다 — 진행 중인 요청을 끊고 새로 받는다.
      // 드로어에 그린 행이면 위의 열기가 상세 조회에 id를 다시 넘겨 키가 바뀌며 받는다
      if (fetchId === id) void refetch();
    },
    [requested, fetchId, refetch, setLogParam],
  );

  const close = useCallback(() => {
    setShown((prev) => (prev?.open ? { ...prev, open: false } : prev));
    setLogParam(null);
  }, [setLogParam]);

  return { shown, openLog, close };
}

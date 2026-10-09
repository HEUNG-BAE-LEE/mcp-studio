// 카탈로그 Toast 절 — 이 절 안의 Toast 하나를 지역 상태로 움직인다(앱의 토스트 한 칸은 앱 층이 붙이고 toast()로 띄운다).
// 종류 셋(완료 · 경고 · 안내) · 여러 줄 원문 · 같은 글자 다시(새 id — 표시 시간을 처음부터) · 빈 그릇(null)을 본다.
// 닫기는 --toast-duration 타이머 → onDone(id) → 같은 id면 open만 끈다(app/toast dismissToast와 같다 — 글자는 남는다)
import { useState } from 'react';
import type { ToastItem, ToastKind } from '@/app/toast';
import { Button, Modal, Toast } from '../../ui';
import catalog from './catalog.module.css';

const SAMPLES: Readonly<Record<ToastKind, string>> = {
  default: '복사했습니다.',
  warn: '이 브라우저에서는 자동 복사가 막혀 있습니다. 직접 선택해 복사하세요.',
  info: '탐색을 예약했습니다.',
};
const MULTILINE = '요청에 실패했습니다 (500)\n원본 시스템이 응답하지 않습니다.\n잠시 뒤 다시 시도하세요.';

export function ToastSection() {
  const [item, setItem] = useState<ToastItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const show = (kind: ToastKind, message: string) =>
    setItem((current) => ({ id: (current?.id ?? 0) + 1, kind, message, open: true }));
  const onDone = (id: number) =>
    setItem((current) => (current?.id === id && current.open ? { ...current, open: false } : current));
  const state = item === null ? 'null' : `id ${item.id} · ${item.kind} · open ${String(item.open)}`;

  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        화면 위 가운데. Popover(manual)로 최상층에 올라 모달 · 드로어보다 늘 위다. --toast-duration 뒤 onDone(id)로 닫히고, 닫혀도 글자는
        남는다. 새 토스트는 내용을 바로 바꾸고 시간을 처음부터 다시 센다. role=status — 새 글자가 읽힌다.
      </p>
      <p className={catalog.note}>item — {state}</p>
      <div className={catalog.row}>
        <Button onClick={() => show('default', SAMPLES.default)}>완료(default)</Button>
        <Button onClick={() => show('warn', SAMPLES.warn)}>경고(warn)</Button>
        <Button onClick={() => show('info', SAMPLES.info)}>안내(info)</Button>
        <Button onClick={() => show('warn', MULTILINE)}>여러 줄 원문</Button>
        <Button onClick={() => show(item?.kind ?? 'default', item?.message ?? SAMPLES.default)}>같은 글자 다시</Button>
        <Button onClick={() => setItem(null)}>빈 그릇(null)</Button>
        <Button onClick={() => setIsModalOpen(true)}>모달 위로 띄우기</Button>
      </div>
      <Toast item={item} onDone={onDone} />
      <Modal open={isModalOpen} onOpenChange={setIsModalOpen} title="층 위 토스트" cancelLabel="닫기">
        <Button onClick={() => show('info', SAMPLES.info)}>토스트 띄우기</Button> — 토스트가 이 모달보다 위에 그려진다.
      </Modal>
    </div>
  );
}

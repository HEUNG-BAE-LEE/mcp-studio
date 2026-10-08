// 도구 상세 — 머리(고정폭 id · 상태 칩 · 읽기/쓰기 / 제목 + 원본 작업 · 공개 스위치 · 테스트 실행 · 변경사항 저장) · 상태 알림 띠 · 변환 흐름 띠 ·
// 두 열(설명 · 입력 매핑 · 응답 매핑 / 실행 정책) · 미리보기(옛 toolDetailHTML — js/menu/studio.js:69-117)
// 그리는 값은 서버 도구에 초안을 덮은 도구(view)이고, 편집은 서버 도구(saved)를 바탕으로 지금 초안 위에 쌓는다(editDraft). 저장 안 된 변경은
// 저장 버튼이 켜지는 것으로만 알린다(초안이 있으면 켜짐 — 옛 _dirty). 도구가 바뀌면 화면이 key로 새로 그려 칸 원문 · 표 · 코드 스크롤이 처음 자리로 간다
// 공개 스위치는 공개 중 · 제외에서만 바꾼다(검토 · 명세 변경이면 잠금 + 시각 숨김 사유 — 이식 기간 고침). "테스트 실행"은 저장 안 한 변경을 가져가지 않고
// 테스트 실행 화면으로 간다(push — 제외 도구는 잠금)
// 사라지거나 잠긴 컨트롤의 포커스는 상세 머리 제목(tabIndex -1 — DetailHead 제목은 포커스를 받지 않아 제목 글을 감싼다)으로 옮긴다:
// 저장 성공 뒤 저장 버튼이 잠김(초안이 비어 disabled) · 알림 띠 동작 뒤 띠가 사라짐(검토 완료 · 새 필드로 매핑 · 다시 포함 — 모두 공개 중이 된다).
// 포커스가 그 컨트롤에서 body로 빠질 때만이다 — 옛도 잃었지만 사라진 컨트롤의 포커스는 대체 자리로 간다(층 포커스 복귀와 같은 규칙)
import { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Source, Tool, ToolParam, ToolResField } from '../../api/types';
import { opLabel } from '../../app/convert/opLabel';
import { editDraft, useToolDraft, type DraftPatch } from '../../app/studio/drafts';
import { editParamRow, editResRow, publishPatch } from '../../app/studio/edit';
import { toast } from '../../app/toast';
import { modeKindOf, modeLabel } from '../../copy/mode';
import { STUDIO } from '../../copy/studio';
import { Button, DetailHead, ModeTag, Switch, ToolStatusChip, TwoColumn } from '@/ui';
import { DescSection } from './DescSection';
import { ParamMapping } from './ParamMapping';
import { PolicySection } from './PolicySection';
import { PreviewSection } from './PreviewSection';
import { ResMapping } from './ResMapping';
import { ToolNotice } from './ToolNotice';
import { ToolPipeline } from './ToolPipeline';
import styles from './StudioScreen.module.css';

const D = STUDIO.detail;
const PLAYGROUND_PATH = '/playground';

type ToolDetailProps = Readonly<{
  /** 초안을 덮은 도구 */
  tool: Tool;
  /** 서버 도구(기본값 채움) — 편집의 바탕 · 코드표 읽기의 기준 */
  saved: Tool;
  source: Source;
  /** 이 도구의 저장 요청 중 */
  saving: boolean;
  onSave: () => void;
  /** 이 도구의 AI 다시 쓰기 요청 중 */
  rewriting: boolean;
  /** again — 이 도구를 AI로 다시 쓴 적이 있다(초안의 rewritten) */
  onRewrite: (again: boolean) => void;
}>;

/**
 * 포커스가 빠질 때 상세 머리 제목으로 — 그리기마다(layout) 본다. 잠긴 버튼의 포커스는 브라우저가 다음 그리기 때 body로 빼므로
 * 아직 버튼에 있을 때 옮기고, 사라진 띠 버튼은 지운 순간 body가 되므로 띠 동작 뒤 그린 때만 본다
 */
function useDetailFocusFallback() {
  const titleRef = useRef<HTMLSpanElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const noticeActed = useRef(false);
  useLayoutEffect(() => {
    const acted = noticeActed.current;
    noticeActed.current = false;
    const active = document.activeElement;
    const save = saveRef.current;
    const isSaveLocked = save !== null && active === save && save.disabled;
    const isNoticeGone = acted && active === document.body;
    if (isSaveLocked || isNoticeGone) titleRef.current?.focus();
  });
  const markNoticeAction = () => {
    noticeActed.current = true;
  };
  return { titleRef, saveRef, markNoticeAction };
}

export function ToolDetail({ tool, saved, source, saving, onSave, rewriting, onRewrite }: ToolDetailProps) {
  const navigate = useNavigate();
  const draft = useToolDraft(tool.id);
  const focusFallback = useDetailFocusFallback();
  const canPublish = tool.status === 'done' || tool.status === 'off';
  const mode = modeKindOf(tool.mode);

  const edit = (update: (view: Tool) => DraftPatch | null) => editDraft(saved, update);
  const editParam = (index: number, update: (row: ToolParam) => ToolParam) =>
    edit((view) => editParamRow(view, index, update));
  const editRes = (index: number, update: (row: ToolResField) => ToolResField) =>
    edit((view) => editResRow(view, index, update));

  const onPublish = (on: boolean) => {
    edit((view) => publishPatch(view, on));
    toast(on ? STUDIO.toast.published(tool.id) : STUDIO.toast.unpublished(tool.id));
  };

  const onTryRun = () => {
    void navigate(`${PLAYGROUND_PATH}?${new URLSearchParams({ tool: tool.id }).toString()}`);
  };

  return (
    <>
      <DetailHead
        title={
          <span ref={focusFallback.titleRef} tabIndex={-1}>
            {tool.id}
          </span>
        }
        titleMono
        badges={
          <>
            <ToolStatusChip status={tool.status} />
            <ModeTag kind={mode} label={modeLabel(tool.mode)} />
          </>
        }
        description={tool.title}
        code={opLabel(tool)}
        actions={
          <>
            <Switch
              variant="inline"
              className={styles.publish}
              label={D.publish}
              checked={tool.status === 'done'}
              disabled={!canPublish}
              disabledReason={D.publishBlocked}
              onCheckedChange={onPublish}
            />
            <Button icon="play" disabled={tool.status === 'off'} onClick={onTryRun}>
              {D.tryRun}
            </Button>
            <Button
              ref={focusFallback.saveRef}
              variant="primary"
              disabled={draft === undefined}
              pending={saving}
              onClick={onSave}
            >
              {D.save}
            </Button>
          </>
        }
      />
      <ToolNotice
        tool={tool}
        onEdit={(update) => {
          focusFallback.markNoticeAction();
          edit(update);
        }}
      />
      <ToolPipeline tool={tool} source={source} />
      <TwoColumn layout="main-aside">
        <div>
          <DescSection
            desc={tool.desc}
            onDesc={(desc) => edit(() => ({ desc }))}
            rewriting={rewriting}
            onRewrite={() => onRewrite(draft?.rewritten === true)}
          />
          <ParamMapping params={tool.params} savedParams={saved.params} onEditRow={editParam} />
          <ResMapping res={tool.res} savedRes={saved.res} onEditRow={editRes} />
        </div>
        <div className={styles.policyColumn}>
          <PolicySection tool={tool} onEdit={edit} />
        </div>
      </TwoColumn>
      <PreviewSection tool={tool} source={source} />
    </>
  );
}

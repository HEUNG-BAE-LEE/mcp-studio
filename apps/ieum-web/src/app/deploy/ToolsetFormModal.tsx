// ToolsetFormModal — 도구 묶음 만들기 · 수정 모달의 내용(옛 tsForm · tsNew · tsEdit — js/menu/deploy.js:190-208)
// 넓은 모달. 본문: 이름 · 주소 이름(고정폭, 한 번이라도 배포한 묶음이면 읽기 전용) · 사용 대상 칸 + "포함할 도구" 라벨 + 스크롤 목록
// (원본마다 소제목 + 도구 체크 줄 — 고정폭 id + 상태 칩). 만들기 확인 "만들기", 수정 확인 "저장" + 발 왼쪽 "삭제"(위험 모양 없음 — 옛 .btn.danger는 모양이 없었다).
// 첫 포커스는 이름 칸(Modal 규칙). form이 아니다 — Enter로 보내지 않는다. 검증은 서버만 한다 — 실패 문장은 경고 토스트이고 창은 그대로(옛 그대로)
// 목록의 도구는 저장본(useTools)이다 — 스튜디오에서 저장하지 않은 공개 상태는 칩에 번지지 않는다(배포 도구 표와 같다)
//
// ── 쓰는 곳 계약 ──
// toolsetFormContentOf(input) → ModalContent(app/sources/useModalAttempt)
//   mode — create · edit. toolset — 수정이면 연 순간의 묶음(만들기는 null)
//   form · onFormChange — 입력은 모달 칸이 쥔다(app/deploy/useDeployModalAttempt — 만들기는 빈 칸 + 사용 대상 "전 직원", 수정은 그 묶음 값).
//     도구는 고른 id 집합이고, 보낼 때 보이는 목록 순서(원본 순 → 도구 순)로 줄 세운다 — 옛은 체크 상자 DOM 순서로 읽었다(:198).
//     지금 목록에 없는 도구 id(지워진 도구)는 그리지 않고 보내지도 않는다(옛도 체크 상자에 없어 빠졌다)
//   sources · tools — 원본 목록과 저장본 도구(원본별)
//   createToolset · updateToolset — 모달 칸이 쥔 요청 인스턴스. 잠금은 만들기 = 요청 중, 수정 = 그 묶음의 요청 중
// - 확인 = 만들기 mutate({ body }) · 수정 mutate({ toolsetId, body }) — body는 입력 그대로(다듬지 않는다). 닫기 · 이동 · 토스트는 훅(app/deploy/useToolsetMutations)
// - "삭제"는 같은 칸을 삭제 확인으로 바꾼다(app/layers openToolsetDelete — 옛은 확인 없이 지웠다, 이식 기간 고침)
import { Fragment, useId } from 'react';
import type { ToolIndex } from '../../api/hooks/useTools';
import type { Source, ToolsetBody, ToolsetWire } from '../../api/types';
import { DEPLOY } from '../../copy/deploy';
import { openToolsetDelete } from '../layers';
import type { ModalContent } from '../sources/useModalAttempt';
import type { useCreateToolset, useUpdateToolset } from './useToolsetMutations';
import { isDeployed } from './toolsetView';
import { Button, Checkbox, Field, GroupLabel, Input, ScrollList, ScrollListHeading, ToolStatusChip } from '@/ui';
import styles from './DeployModals.module.css';

const F = DEPLOY.form;

type CreateMutation = ReturnType<typeof useCreateToolset>;
type UpdateMutation = ReturnType<typeof useUpdateToolset>;

export type ToolsetFormInput = Readonly<{
  mode: 'create' | 'edit';
  toolset: ToolsetWire | null;
  form: ToolsetBody;
  onFormChange: (form: ToolsetBody) => void;
  sources: readonly Source[];
  tools: ToolIndex;
  createToolset: CreateMutation;
  updateToolset: UpdateMutation;
}>;

type FormBodyProps = Pick<ToolsetFormInput, 'form' | 'onFormChange' | 'sources' | 'tools'> &
  Readonly<{
    /** 주소 이름을 읽기 전용으로(배포한 묶음) */
    isSlugLocked: boolean;
  }>;

const toolsOf = (tools: ToolIndex, sourceId: string) => tools.bySource[sourceId] ?? [];

/**
 * 고른 도구를 보이는 목록 순서로, id마다 한 번 — 같은 id가 여러 원본에 있어도 묶음에 두 번 담지 않는다
 * (옛 수정 창은 같은 id 두 줄이 다 체크돼 중복 id를 보냈다 — js/menu/deploy.js:196,198)
 */
function orderedSelection(sources: readonly Source[], tools: ToolIndex, selected: readonly string[]): readonly string[] {
  const picked = new Set(selected);
  const visible = sources.flatMap((s) => toolsOf(tools, s.id).map((t) => t.id)).filter((id) => picked.has(id));
  return [...new Set(visible)];
}

function ToolsetFormBody({ form, onFormChange, sources, tools, isSlugLocked }: FormBodyProps) {
  const groupId = useId();
  const picked = new Set(form.tools);
  const toggle = (toolId: string, on: boolean) =>
    onFormChange({ ...form, tools: on ? [...new Set([...form.tools, toolId])] : form.tools.filter((id) => id !== toolId) });

  return (
    <>
      <Field label={F.nameLabel}>
        {({ id }) => (
          <Input
            id={id}
            value={form.name}
            onValueChange={(name) => onFormChange({ ...form, name })}
            placeholder={F.namePlaceholder}
          />
        )}
      </Field>
      <Field label={F.slugLabel}>
        {({ id }) => (
          <Input
            id={id}
            mono
            readOnly={isSlugLocked}
            value={form.slug}
            onValueChange={(slug) => onFormChange({ ...form, slug })}
            placeholder={F.slugPlaceholder}
          />
        )}
      </Field>
      <Field label={F.audienceLabel}>
        {({ id }) => (
          <Input id={id} value={form.audience} onValueChange={(audience) => onFormChange({ ...form, audience })} />
        )}
      </Field>
      <GroupLabel id={groupId} className={styles.toolsLabel}>
        {F.toolsLabel}
      </GroupLabel>
      <ScrollList labelledBy={groupId}>
        {sources.map((source) => (
          <Fragment key={source.id}>
            <ScrollListHeading>{source.name}</ScrollListHeading>
            {toolsOf(tools, source.id).map((tool) => (
              <Checkbox
                key={tool.id}
                size="sm"
                checked={picked.has(tool.id)}
                onCheckedChange={(on) => toggle(tool.id, on)}
                label={
                  <>
                    <span className={styles.toolId}>{tool.id}</span>
                    <ToolStatusChip status={tool.status} />
                  </>
                }
              />
            ))}
          </Fragment>
        ))}
      </ScrollList>
    </>
  );
}

export function toolsetFormContentOf(input: ToolsetFormInput): ModalContent {
  const { mode, toolset, form, sources, tools, createToolset, updateToolset } = input;
  const bodyOf = (): ToolsetBody => ({ ...form, tools: orderedSelection(sources, tools, form.tools) });
  const body = (
    <ToolsetFormBody
      form={form}
      onFormChange={input.onFormChange}
      sources={sources}
      tools={tools}
      isSlugLocked={toolset !== null && isDeployed(toolset)}
    />
  );

  if (mode === 'create' || toolset === null) {
    return {
      title: F.createTitle,
      size: 'wide',
      confirmLabel: F.create,
      onConfirm: () => createToolset.mutate({ body: bodyOf() }),
      isLocked: createToolset.isPending,
      body,
    };
  }
  return {
    title: F.editTitle,
    size: 'wide',
    confirmLabel: F.save,
    onConfirm: () => updateToolset.mutate({ toolsetId: toolset.id, body: bodyOf() }),
    isLocked: updateToolset.isPending && updateToolset.variables?.toolsetId === toolset.id,
    extra: <Button onClick={() => openToolsetDelete(toolset.id)}>{F.delete}</Button>,
    body,
  };
}

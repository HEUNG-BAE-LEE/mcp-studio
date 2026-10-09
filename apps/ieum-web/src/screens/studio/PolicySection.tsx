// 실행 정책 상자 — 실행 방식 두 선택 카드 · 개인정보 마스킹 · 응답 캐시 · 사용자당 호출 한도(옛 js/menu/studio.js:101-111)
// 쓰기 도구는 "바로 실행"과 응답 캐시를 고를 수 없다. 바꾸면 초안에 쓴다(실행 방식은 MCP 정의 미리보기의 _meta가 따라 바뀐다).
// 한도 칸은 입력 원문을 이 칸이 들고 저장 값은 숫자(빈 값 · 0 → 1, 범위는 고치지 않음 — 옛 `+value || 1`). 원문은 도구가 바뀌거나 다시 읽기 뒤에만 다시 채운다(상세 key)
// 서버 사실과 다른 옛 문구(사용자 확인 설명 · 마스킹 · "10분" · "사용자당")는 그대로 둔다(docs/DESIGN.md ## 이식 기간 보존)
import { useId, useState } from 'react';
import type { ExecMode, Tool } from '../../api/types';
import type { DraftPatch } from '../../app/studio/drafts';
import { execPatch, parseLimit } from '../../app/studio/edit';
import { modeKindOf } from '../../copy/mode';
import { STUDIO } from '../../copy/studio';
import { Box, GroupLabel, Input, RadioCard, SettingRow, Switch } from '@/ui';
import styles from './StudioScreen.module.css';

const P = STUDIO.policy;
const LIMIT_MIN = 1;
const LIMIT_MAX = 600;

type PolicySectionProps = Readonly<{
  /** 초안을 덮은 도구 */
  tool: Tool;
  /** 지금 보이는 값으로 초안을 고친다 */
  onEdit: (update: (view: Tool) => DraftPatch | null) => void;
}>;

export function PolicySection({ tool, onEdit }: PolicySectionProps) {
  const execLabelId = useId();
  const [limitText, setLimitText] = useState(() => String(tool.limit));
  const isWrite = modeKindOf(tool.mode) === 'write';
  const pickExec = (exec: ExecMode) => onEdit((view) => execPatch(view, exec));

  return (
    <Box variant="policy" title={P.title}>
      <GroupLabel size="sm" id={execLabelId} className={styles.execLabel}>
        {P.execLabel}
      </GroupLabel>
      <div role="group" aria-labelledby={execLabelId} className={styles.execGroup}>
        <RadioCard
          variant="option"
          title={P.auto.title}
          description={P.auto.hint}
          selected={tool.exec === 'auto'}
          disabled={isWrite}
          onSelect={() => pickExec('auto')}
        />
        <RadioCard
          variant="option"
          title={P.confirm.title}
          description={isWrite ? P.confirm.hintWrite : P.confirm.hintRead}
          selected={tool.exec === 'confirm'}
          onSelect={() => pickExec('confirm')}
        />
      </div>
      <SettingRow
        className={styles.settingsTop}
        title={P.mask.title}
        description={P.mask.hint}
        control={<Switch label={P.mask.title} checked={tool.mask} onCheckedChange={(mask) => onEdit(() => ({ mask }))} />}
      />
      <SettingRow
        title={P.cache.title}
        description={P.cache.hint}
        control={
          <Switch
            label={P.cache.title}
            checked={tool.cache}
            disabled={isWrite}
            onCheckedChange={(cache) => onEdit(() => ({ cache }))}
          />
        }
      />
      <SettingRow
        title={P.limit.title}
        description={P.limit.hint}
        control={
          <Input
            variant="setting"
            type="number"
            min={LIMIT_MIN}
            max={LIMIT_MAX}
            value={limitText}
            aria-label={P.limit.label}
            onValueChange={(text) => {
              setLimitText(text);
              onEdit(() => ({ limit: parseLimit(text) }));
            }}
          />
        }
      />
    </Box>
  );
}

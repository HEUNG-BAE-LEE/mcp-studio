// 변환 흐름 띠 — 원본 작업 칸(작업 표시 · 연결 방식 설명 · 입력 · 응답 수) · 이음 허브(규칙 요약 칩, keep 제외 · 처음 나온 순) · AI 도구 칸(노출 입력 수)
// (옛 js/menu/studio.js:85-91). 입력 수는 원본 필드가 있는 파라미터만 센다. 초안을 덮은 도구로 그리므로 입력하는 동안에도 숫자가 바로 바뀐다
// (옛은 상세를 다시 그릴 때만 — 이식 기간 허용 차이). 모르는 규칙 키는 값 그대로 + 개수(ruleCounts)
import type { Source, Tool } from '../../api/types';
import { opLabel } from '../../app/convert/opLabel';
import { ruleCounts } from '../../app/convert/ruleCounts';
import { visibleParams } from '../../app/convert/visibleParams';
import { protocolDesc } from '../../copy/protocol';
import { STUDIO } from '../../copy/studio';
import { Pipeline } from '@/ui';
import styles from './StudioScreen.module.css';

const P = STUDIO.pipe;

type ToolPipelineProps = Readonly<{ tool: Tool; source: Source }>;

export function ToolPipeline({ tool, source }: ToolPipelineProps) {
  const inputs = tool.params.filter((p) => p.o).length;
  return (
    <Pipeline
      label={P.label}
      className={styles.pipeline}
      source={{
        overline: P.source,
        title: opLabel(tool) ?? '',
        lines: [protocolDesc(source.proto), P.io(inputs, tool.res.length)],
      }}
      hubTitle={P.hub}
      hubChips={ruleCounts(tool).map(({ label, count }) => P.ruleCount(label, count))}
      tool={{ overline: P.ai, title: tool.id, lines: [P.aiKind, P.exposed(visibleParams(tool).length)] }}
    />
  );
}

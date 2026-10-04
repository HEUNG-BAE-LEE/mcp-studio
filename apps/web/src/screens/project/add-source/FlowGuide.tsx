// apps/web/src/screens/project/add-source/FlowGuide.tsx — 도우미 패널 안 단계 3 + 지금 안내(ui StepList)
import { StepList } from '@/ui';
import { ADD_SOURCE } from '../../../copy/addSource';
import type { FlowStep } from './model';

const INDEX: Readonly<Record<FlowStep, number>> = { type: 0, connect: 1, run: 2 };
const ITEMS = ADD_SOURCE.guide.steps.map((s) => ({
  id: s.label,
  label: s.label,
  description: s.desc,
}));

export function FlowGuide({ step }: { step: FlowStep }) {
  const current = INDEX[step];
  const now = ADD_SOURCE.guide.now[current];
  return (
    <StepList
      items={ITEMS}
      current={current}
      note={now ? { title: now.title, body: now.note } : undefined}
    />
  );
}

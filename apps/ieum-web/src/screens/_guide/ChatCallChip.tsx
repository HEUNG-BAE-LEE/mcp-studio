// Chip · ChatBubble · ChatLog 절이 같이 쓰는 호출 칩 — 쓰는 곳(테스트 실행 대화)의 모양 그대로 "{도구} ✓ 변환 과정 보기".
// 글리프 ✓ · ✕ 자리는 장식 아이콘 + 시각 숨김 글자(이름이 옛 글자 그대로 읽힌다). 글 · 아이콘 사이의 공백은 {' '}로 남긴다
import { Chip, Icon, VisuallyHidden } from '../../ui';

const ACTION = '변환 과정 보기';

export type ChatCallChipProps = {
  tool: string;
  isOk: boolean;
  onPress: () => void;
};

export function ChatCallChip({ tool, isOk, onPress }: ChatCallChipProps) {
  return (
    <Chip onClick={onPress}>
      {tool}{' '}
      <Icon name={isOk ? 'check' : 'close'} size="sm" />
      <VisuallyHidden>{isOk ? '✓' : '✕'}</VisuallyHidden>{' '}
      {ACTION}
    </Chip>
  );
}

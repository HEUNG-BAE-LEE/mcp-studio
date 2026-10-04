import { ILLUSTS, type IllustName } from './names';

const ILLUST_WIDTH = 150;
const ILLUST_HEIGHT = 74;

export type IllustProps = { name: IllustName; className?: string };

/** 소스 타입 카드에만 쓰는 삽화 3종 git · database · document (DESIGN `## Iconography`) */
export function Illust({ name, className }: IllustProps) {
  const Svg = ILLUSTS[name];
  return (
    <Svg
      width={ILLUST_WIDTH}
      height={ILLUST_HEIGHT}
      className={className}
      aria-hidden
      focusable="false"
    />
  );
}

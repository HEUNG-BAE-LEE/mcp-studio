// AI가 읽는 도구 설명 — 소절 제목 + 보조 · 설명 칸(본문 글꼴, 최소 78) · 아래 줄(글자 수 · "AI로 다시 쓰기")(옛 js/menu/studio.js:94-97)
// 입력마다(한글 조합 중 포함) 초안에 쓰고 글자 수 · 미리보기가 따라 바뀐다. 글자 수는 문자열 length 그대로.
// "AI로 다시 쓰기"는 늘 보인다(서버에 키가 없으면 실패 토스트가 이유를 말한다 — 이식 기간 보존). 이 도구의 요청 중에만 잠그고(누름 무시 · 포커스 유지) "쓰는 중…"(studio.js:152)
import { STUDIO } from '../../copy/studio';
import { LinkButton, SectionTitle, Textarea } from '@/ui';
import styles from './StudioScreen.module.css';

const D = STUDIO.desc;

type DescSectionProps = Readonly<{
  desc: string;
  onDesc: (desc: string) => void;
  /** 이 도구의 다시 쓰기 요청 중 */
  rewriting: boolean;
  onRewrite: () => void;
}>;

export function DescSection({ desc, onDesc, rewriting, onRewrite }: DescSectionProps) {
  return (
    <div>
      <SectionTitle level="sub" title={D.title} description={D.hint} />
      <Textarea variant="prose" aria-label={D.label} value={desc} onValueChange={onDesc} />
      <div className={styles.descRow}>
        <span>{D.count(desc.length)}</span>
        <LinkButton onClick={onRewrite} pending={rewriting}>
          {rewriting ? D.rewriting : D.rewrite}
        </LinkButton>
      </div>
    </div>
  );
}

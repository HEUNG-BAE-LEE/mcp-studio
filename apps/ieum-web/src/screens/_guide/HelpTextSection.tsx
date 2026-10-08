// 카탈로그 HelpText 절 — size sm · md, 강조 <b>, 한 줄 · 두 줄(접힘), 표 아래 놓은 모양
import { HelpText } from '../../ui/HelpText';
import { InlineCode } from '../../ui/InlineCode';
import catalog from './catalog.module.css';

export function HelpTextSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        --text-faint 안내. 바깥 여백은 쓰는 곳이 className으로 준다(여기서는 예시 간격만). 강조 &lt;b&gt;는 한 단계 진한
        --text-muted.
      </p>
      <h3 className={catalog.heading}>size=sm (기본)</h3>
      <HelpText>
        최근 <b>100건</b>까지 보입니다. 더 오래된 기록은 서버에서 지워집니다.
      </HelpText>
      <h3 className={catalog.heading}>size=md</h3>
      <HelpText size="md">
        변환할 원본을 <b>하나</b> 고르세요. 고른 뒤에는 <InlineCode>/orders</InlineCode> 같은 경로를 쓸 수 있습니다.
      </HelpText>
      <h3 className={catalog.heading}>두 줄 이상</h3>
      <HelpText>
        안내가 길어지면 행간 --lh-prose로 접힙니다. 안내가 길어지면 행간 --lh-prose로 접힙니다. 안내가 길어지면 행간
        --lh-prose로 접힙니다. 안내가 길어지면 행간 --lh-prose로 접힙니다. 안내가 길어지면 행간 --lh-prose로 접힙니다.
      </HelpText>
    </div>
  );
}

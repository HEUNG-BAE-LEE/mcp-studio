// 카탈로그 HelpText 절 — hint(size sm · md, 강조 <b>, 두 줄 접힘) · note(코드 상자 아래 메모 — 위 8 · 행간 물려받음 · <b> 색 그대로 굵게) ·
// inline(툴바 줄 안 — 행간 물려받음 · 여백 없음)
import { CodeBlock, HelpText, InlineCode, Toolbar, ToolbarSpacer } from '../../ui';
import catalog from './catalog.module.css';

export function HelpTextSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        --text-faint 안내. hint의 바깥 여백은 쓰는 곳이 className으로 주고(여기서는 예시 간격만) 강조 &lt;b&gt;는 한 단계 진한 --text-muted다. note는
        미리보기 · 근거 아래 메모로 위 8을 부품이 가지고(className이 덮는다) 행간은 둘레를 물려받으며 &lt;b&gt;는 색 그대로 굵게다. inline은
        툴바 줄 안 안내로 여백이 없고 행간은 둘레(툴바)를 물려받는다.
      </p>
      <h3 className={catalog.heading}>hint · size=sm (기본)</h3>
      <HelpText>
        최근 <b>100건</b>까지 보입니다. 더 오래된 기록은 서버에서 지워집니다.
      </HelpText>
      <h3 className={catalog.heading}>hint · size=md</h3>
      <HelpText size="md">
        변환할 원본을 <b>하나</b> 고르세요. 고른 뒤에는 <InlineCode>/orders</InlineCode> 같은 경로를 쓸 수 있습니다.
      </HelpText>
      <h3 className={catalog.heading}>hint · 두 줄 이상</h3>
      <HelpText>
        안내가 길어지면 행간 --lh-prose로 접힙니다. 안내가 길어지면 행간 --lh-prose로 접힙니다. 안내가 길어지면 행간
        --lh-prose로 접힙니다. 안내가 길어지면 행간 --lh-prose로 접힙니다. 안내가 길어지면 행간 --lh-prose로 접힙니다.
      </HelpText>
      <h3 className={catalog.heading}>note — 코드 상자 아래 메모</h3>
      <div>
        <CodeBlock code={{ text: 'GET /po/list.do?from=20240101 HTTP/1.1', lang: 'http' }} label="원본 요청" />
        <HelpText variant="note">
          매퍼 <InlineCode>PoMapper.selectList</InlineCode> 이 SELECT 문이라 <b>읽기</b> 작업으로 분류했습니다.
        </HelpText>
      </div>
      <h3 className={catalog.heading}>inline — 툴바 줄 안 안내</h3>
      <Toolbar>
        <ToolbarSpacer />
        <HelpText variant="inline">행을 누르면 소스 코드, 캡처한 요청, 파라미터 추론 근거를 볼 수 있습니다</HelpText>
      </Toolbar>
    </div>
  );
}

// 카탈로그 InlineCode 절 — 문장 안(본문 · 안내 한 줄) · 긴 값(줄바꿈)
import { HelpText, InlineCode } from '../../ui';
import catalog from './catalog.module.css';

export function InlineCodeSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        &lt;code&gt; · 고정폭 · 보조 면 · 1px 나눔선. 문장 안 짧은 코드 · 경로 · 식별자에 쓴다. prop은 children뿐이다.
      </p>
      <p>
        도구 <InlineCode>get_employee_list</InlineCode>의 필드 <InlineCode>empNo</InlineCode>를 확인하세요.
      </p>
      <HelpText>
        시연 주소는 <InlineCode>http://localhost:8080/mcp</InlineCode> 입니다 — HelpText 안에서도 같은 모양이다.
      </HelpText>
      <p>
        긴 값이 문장 중간에서 줄을 바꿀 때: <InlineCode>/api/v1/ieum/sources/0f4d2a60-8c1e-4d1e-9a52-3b7c5d6e7f80/tools</InlineCode>
        를 부른다.
      </p>
    </div>
  );
}

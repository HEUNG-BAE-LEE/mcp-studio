// 카탈로그 RadioCard 절 — 기본 · 고름 · 잠김(2차 표지) · 잠김 + 추천 표지 · 아이콘 없음 · 설명 없음 · 격자(CardGrid 2열 · 760)에서 고르기. 호버 · 포커스는 직접 눌러 본다
import { useState } from 'react';
import { CardGrid, RadioCard, Tag } from '../../ui';
import catalog from './catalog.module.css';
import styles from './RadioCardSection.module.css';

const NOOP = () => undefined;
type Mode = 'rest' | 'soap' | 'portal';

export function RadioCardSection() {
  const [mode, setMode] = useState<Mode>('rest');
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        &lt;button&gt; + aria-pressed. 왼쪽 라디오 점(18), 제목 앞 아이콘은 주조색, 표지는 제목 뒤. 고르면 테두리 · 바탕 · 안쪽 테가 주조색이다.
        잠긴 카드는 표지까지 카드 전체가 흐려지고 hover가 바뀌지 않는다. 격자는 CardGrid(2열 · 760 이하 한 열)이고, 긴 제목 · 낱말은 카드 안에서 접힌다.
      </p>
      <h3 className={catalog.heading}>격자에서 고르기 — 이미 고른 카드를 눌러도 불린다</h3>
      <CardGrid columns={2} collapseAt={760}>
        <RadioCard icon="globe" title="REST API" description="OpenAPI 명세 주소나 파일로 연결합니다." selected={mode === 'rest'} onSelect={() => setMode('rest')} />
        <RadioCard icon="doc" title="SOAP" description="WSDL 명세로 연결합니다." selected={mode === 'soap'} onSelect={() => setMode('soap')} />
        <RadioCard icon="db" title="공공데이터포털" description="포털 API 목록에서 고릅니다." selected={mode === 'portal'} onSelect={() => setMode('portal')} />
      </CardGrid>
      <h3 className={catalog.heading}>상태 — 기본 · 고름 · 잠김 · 고른 채 잠김</h3>
      <CardGrid columns={2} collapseAt={760}>
        <RadioCard icon="globe" title="기본" description="고르지 않은 카드" selected={false} onSelect={NOOP} />
        <RadioCard icon="globe" title="고름" description="고른 카드" selected onSelect={NOOP} />
        <RadioCard icon="lock" title="잠김" description="아직 열지 않은 모드" selected={false} onSelect={NOOP} disabled />
        <RadioCard icon="lock" title="고른 채 잠김" description="두 상태가 겹친 모양" selected onSelect={NOOP} disabled />
      </CardGrid>
      <h3 className={catalog.heading}>표지 — 2차 · 추천(잠긴 카드도 표지를 그대로 그린다) · 넓은 칸</h3>
      <CardGrid columns={2} collapseAt={760}>
        <RadioCard icon="code" title="호출 샘플 추론" description="2차 개발에서 지원합니다." badges={<Tag tone="neutral">2차</Tag>} selected={false} onSelect={NOOP} disabled />
        <RadioCard
          className={styles.wide}
          icon="search"
          title="API 자동 탐색"
          description="명세가 없는 레거시 시스템을 화면에서 찾아냅니다."
          badges={<Tag tone="ok">명세 없는 레거시에 추천</Tag>}
          selected={false}
          onSelect={NOOP}
          disabled
        />
      </CardGrid>
      <h3 className={catalog.heading}>아이콘 없음 · 설명 없음 · 긴 제목</h3>
      <CardGrid columns={2} collapseAt={760}>
        <RadioCard title="아이콘 없음" description="제목과 설명만" selected={false} onSelect={NOOP} />
        <RadioCard icon="globe" title="설명 없음" selected={false} onSelect={NOOP} />
        <RadioCard icon="globe" title="아주 긴 제목이 들어와도 카드 안에서 접힙니다 — 긴 낱말 https://example.internal/api/v1/very/long/path" description="긴 설명도 카드 안에서 접힙니다." selected onSelect={NOOP} />
      </CardGrid>
    </div>
  );
}

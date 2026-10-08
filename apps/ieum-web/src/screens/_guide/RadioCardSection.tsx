// 카탈로그 RadioCard 절 — card: 기본 · 고름 · 잠김(2차 표지) · 잠김 + 추천 표지 · 아이콘 없음 · 설명 없음 · 격자(CardGrid 2열 · 760)에서 고르기
// option: 정책 열(300) 기본 · 고름 · 잠김, 검증 방식 묶음의 slot(고르면 설명 자리를 입력이 대신) · 잠긴 slot 카드. 호버 · 포커스는 직접 눌러 본다
import { useId, useState } from 'react';
import { CardGrid, Input, RadioCard, Tag } from '../../ui';
import catalog from './catalog.module.css';
import styles from './RadioCardSection.module.css';

const NOOP = () => undefined;
type Mode = 'rest' | 'soap' | 'portal';
type Exec = 'auto' | 'confirm';

function CardGallery() {
  const [mode, setMode] = useState<Mode>('rest');
  return (
    <>
      <h3 className={catalog.heading}>card — 격자에서 고르기(이미 고른 카드를 눌러도 불린다)</h3>
      <CardGrid columns={2} collapseAt={760}>
        <RadioCard icon="globe" title="REST API" description="OpenAPI 명세 주소나 파일로 연결합니다." selected={mode === 'rest'} onSelect={() => setMode('rest')} />
        <RadioCard icon="doc" title="SOAP" description="WSDL 명세로 연결합니다." selected={mode === 'soap'} onSelect={() => setMode('soap')} />
        <RadioCard icon="db" title="공공데이터포털" description="포털 API 목록에서 고릅니다." selected={mode === 'portal'} onSelect={() => setMode('portal')} />
      </CardGrid>
      <h3 className={catalog.heading}>card 상태 — 기본 · 고름 · 잠김 · 고른 채 잠김</h3>
      <CardGrid columns={2} collapseAt={760}>
        <RadioCard icon="globe" title="기본" description="고르지 않은 카드" selected={false} onSelect={NOOP} />
        <RadioCard icon="globe" title="고름" description="고른 카드" selected onSelect={NOOP} />
        <RadioCard icon="lock" title="잠김" description="아직 열지 않은 모드" selected={false} onSelect={NOOP} disabled />
        <RadioCard icon="lock" title="고른 채 잠김" description="두 상태가 겹친 모양" selected onSelect={NOOP} disabled />
      </CardGrid>
      <h3 className={catalog.heading}>card 표지 — 2차 · 추천(잠긴 카드도 표지를 그대로 그린다) · 넓은 칸</h3>
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
        />
      </CardGrid>
      <h3 className={catalog.heading}>card — 아이콘 없음 · 설명 없음 · 긴 제목</h3>
      <CardGrid columns={2} collapseAt={760}>
        <RadioCard title="아이콘 없음" description="제목과 설명만" selected={false} onSelect={NOOP} />
        <RadioCard icon="globe" title="설명 없음" selected={false} onSelect={NOOP} />
        <RadioCard icon="globe" title="아주 긴 제목이 들어와도 카드 안에서 접힙니다 — 긴 낱말 https://example.internal/api/v1/very/long/path" description="긴 설명도 카드 안에서 접힙니다." selected onSelect={NOOP} />
      </CardGrid>
    </>
  );
}

function PolicyOptions() {
  const labelId = useId();
  const [exec, setExec] = useState<Exec>('confirm');
  return (
    <>
      <h3 className={catalog.heading} id={labelId}>
        option — 정책 열(300) 실행 방식 · 쓰기 도구라 바로 실행 잠김
      </h3>
      <div className={styles.policy} role="group" aria-labelledby={labelId}>
        <RadioCard variant="option" title="바로 실행" description="조회처럼 결과만 읽는 작업에 권장합니다" selected={exec === 'auto'} onSelect={() => setExec('auto')} disabled />
        <RadioCard variant="option" title="사용자 확인 후 실행" description="쓰기 작업은 이 방식만 쓸 수 있습니다" selected={exec === 'confirm'} onSelect={() => setExec('confirm')} />
      </div>
      <h3 className={catalog.heading}>option 상태 — 기본 · 고름 · 잠김 · 설명 없음</h3>
      <div className={styles.policy}>
        <RadioCard variant="option" title="기본" description="고르지 않은 카드" selected={false} onSelect={NOOP} />
        <RadioCard variant="option" title="고름" description="고른 카드 — 안쪽 테 없음" selected onSelect={NOOP} />
        <RadioCard variant="option" title="잠김" description="쓰기 도구의 바로 실행" selected={false} onSelect={NOOP} disabled />
        <RadioCard variant="option" title="설명 없음" selected={false} onSelect={NOOP} />
      </div>
    </>
  );
}

function SlotOptions() {
  const labelId = useId();
  const [staging, setStaging] = useState(true);
  const [url, setUrl] = useState('http://10.20.9.30:8080/po');
  const slot = <Input variant="setting" mono value={url} onValueChange={setUrl} placeholder="http://10.20.9.30:8080/po" aria-label="스테이징 주소" />;
  return (
    <>
      <h3 className={catalog.heading} id={labelId}>
        option + slot — 검증 방식(고르면 설명 자리를 입력이 대신, 입력은 버튼 밖)
      </h3>
      <div role="group" aria-labelledby={labelId}>
        <RadioCard
          variant="option"
          title="스테이징에서 검증"
          description="스테이징에 시험 데이터가 생길 수 있습니다"
          slot={slot}
          selected={staging}
          onSelect={() => setStaging(true)}
        />
        <RadioCard variant="option" title="검증하지 않음" description="미검증으로 표시하고 검토 때 직접 확인합니다" selected={!staging} onSelect={() => setStaging(false)} />
      </div>
      <h3 className={catalog.heading}>option + slot 잠김 — Git 소스 분석이 꺼져 첫 카드를 고를 수 없다</h3>
      <div>
        <RadioCard variant="option" title="스테이징에서 검증" description="스테이징에 시험 데이터가 생길 수 있습니다" slot={slot} selected={false} onSelect={NOOP} disabled />
        <RadioCard variant="option" title="검증하지 않음" description="미검증으로 표시하고 검토 때 직접 확인합니다" selected onSelect={NOOP} />
      </div>
    </>
  );
}

export function RadioCardSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        &lt;button&gt; + aria-pressed. card는 왼쪽 라디오 점(18) · 주조색 아이콘 · 제목 뒤 표지 · 고르면 테두리 · 바탕 · 안쪽 테가 주조색이다.
        option은 작은 제목(13.5) · 설명(12)이고 고르면 테두리 · 바탕만 바뀌며, 카드 아래 6을 부품이 가진다. 잠긴 카드는 표지 · 입력까지 흐려지고
        hover가 바뀌지 않는다. slot은 고른 카드의 설명 자리를 입력이 대신하고 입력은 누르는 버튼 밖(카드 테두리 안 · 글 열)이다 — 옛 스테이징
        주소 칸은 정책 줄 칸 모양(78 × 30 · 오른쪽 정렬)이 걸려 있어 Input setting mono로 같다. 묶음 이름은 쓰는 곳의 role=&quot;group&quot; +
        aria-labelledby다.
      </p>
      <CardGallery />
      <PolicyOptions />
      <SlotOptions />
    </div>
  );
}

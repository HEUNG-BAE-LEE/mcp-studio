// 카탈로그 SectionTitle 절 — section: 제목만 · 보조 글 · 좁아서 접힘 / sub: 보조 글 · 동작(오른쪽 끝) · 아이콘 + 고정폭 보조 글 · 좁아서 접힘
import { Button, SectionTitle } from '../../ui';
import catalog from './catalog.module.css';
import styles from './SectionTitleSection.module.css';

export function SectionTitleSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        상자 없는 절 제목. section은 h3(위 32 · 아래 10), sub는 h4(위 --subsection-top 26 · 아래 10 · 한 단계 작은 글자)이고 간격은 부품이 가진다.
        보조 글은 --text-faint 작은 글이고 좁으면 아래로 접힌다. sub는 제목 앞 흐린 아이콘 · 고정폭 보조 글 · 오른쪽 끝 동작(제목 요소 안)을 더 받는다.
        상태는 없다.
      </p>
      <h3 className={catalog.heading}>section — 제목만</h3>
      <SectionTitle title="자동 탐색 작업" />
      <h3 className={catalog.heading}>section — 제목 + 보조 글</h3>
      <SectionTitle title="2차 개발에서 지원할 연결 방식" description="1차에서는 REST, SOAP, 공공데이터포털, 호출 샘플 추론을 지원합니다" />
      <h3 className={catalog.heading}>section — 좁은 폭(보조 글이 아래로 접힘)</h3>
      <div className={styles.narrow}>
        <SectionTitle title="2차 개발에서 지원할 연결 방식" description="1차에서는 REST, SOAP, 공공데이터포털, 호출 샘플 추론을 지원합니다" />
      </div>
      <h3 className={catalog.heading}>sub — 보조 글 · 동작</h3>
      <div className={catalog.frame}>
        <SectionTitle level="sub" title="AI가 읽는 도구 설명" description="AI는 이 설명을 보고 언제 이 도구를 쓸지 판단합니다" />
        <SectionTitle
          level="sub"
          title="액세스 키"
          actions={
            <Button size="sm" icon="key">
              키 발급
            </Button>
          }
        />
      </div>
      <h3 className={catalog.heading}>sub — 아이콘 + 고정폭 보조 글(탐색 근거) · 아이콘만</h3>
      <div className={catalog.frame}>
        <SectionTitle level="sub" icon="code" title="소스 근거" description="src/main/java/com/legacy/po/PoController.java:42" descriptionMono />
        <SectionTitle level="sub" icon="globe" title="트래픽 근거" />
      </div>
      <h3 className={catalog.heading}>sub — 좁은 폭(보조 글 · 동작이 접힘)</h3>
      <div className={styles.narrow}>
        <SectionTitle
          level="sub"
          title="포함된 도구"
          description="공개 3개, 검토가 끝나지 않은 2개는 배포에서 빠집니다"
          actions={
            <Button size="sm" icon="key">
              키 발급
            </Button>
          }
        />
      </div>
    </div>
  );
}

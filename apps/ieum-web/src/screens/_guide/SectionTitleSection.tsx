// 카탈로그 SectionTitle 절 — 제목만 · 제목 + 보조 글 · 좁아서 보조 글이 아래로 접힌 모양 · 긴 보조 글
import { SectionTitle } from '../../ui';
import catalog from './catalog.module.css';
import styles from './SectionTitleSection.module.css';

export function SectionTitleSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        상자 없는 절 제목(h3). 위 32 · 아래 10 간격은 부품이 가진다. 보조 글은 --text-faint 작은 글이고 좁으면 아래로 접힌다.
        상태는 없다.
      </p>
      <h3 className={catalog.heading}>제목만</h3>
      <SectionTitle title="자동 탐색 작업" />
      <h3 className={catalog.heading}>제목 + 보조 글</h3>
      <SectionTitle title="2차 개발에서 지원할 연결 방식" description="1차에서는 REST, SOAP, 공공데이터포털, 호출 샘플 추론을 지원합니다" />
      <h3 className={catalog.heading}>좁은 폭 — 보조 글이 아래로 접힘</h3>
      <div className={styles.narrow}>
        <SectionTitle title="2차 개발에서 지원할 연결 방식" description="1차에서는 REST, SOAP, 공공데이터포털, 호출 샘플 추론을 지원합니다" />
      </div>
    </div>
  );
}

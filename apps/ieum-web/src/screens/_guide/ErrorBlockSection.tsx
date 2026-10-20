// 카탈로그 ErrorBlock 절 — 화면 안 영역(region)의 첫 조회 실패: 그 상자 안에 원문만 · 머리 없이 · warn
import { ErrorBlock } from '../../ui';
import catalog from './catalog.module.css';

export function ErrorBlockSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        FailureBlock tone=&quot;warn&quot; + 머리 없음과 같은 모양이다. 영역 자리는 tone · 머리를 고르지 않는다.
      </p>
      <div className={catalog.frame}>
        <p className={catalog.frameLabel}>액세스 키 상자</p>
        <ErrorBlock message="요청에 실패했습니다 (500)" />
      </div>
      <div className={catalog.frame}>
        <p className={catalog.frameLabel}>자동 탐색 작업 표</p>
        <ErrorBlock message="서버에 연결하지 못했습니다." />
      </div>
    </div>
  );
}

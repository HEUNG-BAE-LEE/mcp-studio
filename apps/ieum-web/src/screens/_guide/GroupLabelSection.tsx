// 카탈로그 GroupLabel 절 — md · sm. 바깥 여백은 쓰는 곳이 준다(이 절은 catalog.stack 간격만)
import { GroupLabel } from '../../ui';
import catalog from './catalog.module.css';

export function GroupLabelSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        굵은 &lt;div&gt; 한 줄 — 제목 요소가 아니다. md = --fs-body(묶음 만들기 "포함할 도구"), sm = --fs-label(정책 상자 안 "실행 방식").
        묶음에 이름이 필요하면 쓰는 곳이 role="group"의 aria-labelledby를 id에 잇는다(SettingRow 절 편집 예).
      </p>
      <div className={catalog.stack}>
        <GroupLabel>포함할 도구</GroupLabel>
        <GroupLabel size="sm">실행 방식</GroupLabel>
      </div>
    </div>
  );
}

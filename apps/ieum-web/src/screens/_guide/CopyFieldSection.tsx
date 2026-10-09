// 카탈로그 CopyField 절 — inline(값 있음 · 긴 값 말줄임 · 값 없음) · block(긴 키 — 아무 곳에서나 접힘). 누르면 onCopy가 받은 값을 이 절 안에 보인다.
// 실제 클립보드 · 토스트는 쓰지 않는다 — 복사는 쓰는 곳이 한다(COMPONENTS CopyField)
import { useState } from 'react';
import { CopyField } from '../../ui';
import catalog from './catalog.module.css';
import styles from './CopyFieldSection.module.css';

const SERVER_URL = 'http://127.0.0.1:8101/mcp';
const LONG_URL = 'http://127.0.0.1:8101/mcp/hr-employee-and-attendance-and-payroll-and-leave-management-toolset-for-all-staff';
// 카탈로그용 가짜 키 — 아무 곳에서나 접히는 것을 보이려고 공백 없이 길게
const SAMPLE_KEY = 'ik_sample_0123456789abcdefghijklmnopqrstuvwxyz_ABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789abcdef';

export function CopyFieldSection() {
  const [received, setReceived] = useState<string | null>(null);
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        값 하나를 보이고 복사 버튼을 두는 칸. inline은 칸 안에 고정폭 값 한 줄 말줄임 + 오른쪽 아이콘 버튼(최소 높이 42), 값이 없으면 흐린
        안내만 보이고 버튼이 없다. block은 값 상자가 줄바꿈해 전부 보이고 오른쪽에 작은 복사 버튼이 붙는다. 값은 title · data-*에 싣지 않는다 —
        긴 inline 값은 말줄임이라도 화면 읽기 프로그램은 전체를 읽는다. 복사 버튼을 누르면 onCopy가 값으로 불린다.
      </p>

      <h3 className={catalog.heading}>inline — 값 있음</h3>
      <CopyField variant="inline" value={SERVER_URL} copyLabel="주소 복사" onCopy={setReceived} />

      <h3 className={catalog.heading}>inline — 긴 값(한 줄 말줄임)</h3>
      <CopyField variant="inline" value={LONG_URL} copyLabel="주소 복사" onCopy={setReceived} />

      <h3 className={catalog.heading}>inline — 값 없음(안내 문장 · 버튼 없음)</h3>
      <CopyField variant="inline" value={null} emptyText="처음 배포하면 주소가 발급됩니다." copyLabel="주소 복사" onCopy={setReceived} />

      <h3 className={catalog.heading}>block — 긴 키(아무 곳에서나 접힌다)</h3>
      <CopyField variant="block" value={SAMPLE_KEY} copyLabel="복사" onCopy={setReceived} />

      <h3 className={catalog.heading}>onCopy가 받은 값</h3>
      <p className={styles.received}>{received === null ? '아직 누르지 않았습니다.' : received}</p>
    </div>
  );
}

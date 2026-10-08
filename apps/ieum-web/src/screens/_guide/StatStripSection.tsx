// 카탈로그 StatStrip 절 — 5칸(대시보드 KPI) · 6칸(탐색 실시간) · 증감(up · down) · 단위 · 값 없음 · danger · primary 수치 · 영역 실패. 폭은 뷰어가 바꾼다(1500 · 1100 · 760)
import { NONE, NONE_REASON } from '../../copy/format';
import { ErrorBlock, StatStrip, type StatItem } from '../../ui';
import catalog from './catalog.module.css';

const KPI: readonly StatItem[] = [
  { label: '오늘 호출', value: '1,284', unit: '건', trend: { direction: 'up', text: '12.4%' }, description: '어제보다' },
  { label: '성공률', value: '99.2', unit: '%', trend: { direction: 'down', text: '0.3%' }, description: '어제보다' },
  { label: '평균 응답', value: '182', unit: 'ms', description: '최근 1시간' },
  { label: '연결된 원본', value: '7', unit: '개', description: '정상 6 · 점검 1' },
  { label: '공개 중 도구', value: '23', unit: '개' },
];

// 5칸 띠 그대로 — 평균 응답 칸만 값 없음(NONE · 단위 없음 · 사유는 보조 줄)
const KPI_NO_VALUE: readonly StatItem[] = KPI.map((item) =>
  item.label === '평균 응답' ? { label: item.label, value: NONE, description: NONE_REASON.noCallsYet } : item,
);

const DISCOVERY: readonly StatItem[] = [
  { label: '탐색한 요청', value: '412', unit: '건' },
  { label: '찾은 API', value: '38', unit: '개', tone: 'primary' },
  { label: '고유 호스트', value: '5' },
  { label: '차단', value: '3', unit: '건', tone: 'danger' },
  { label: '경과', value: '02:41' },
  { label: '수집 용량', value: '1.8', unit: 'MB' },
];

export function StatStripSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        서식 · 값 없음 표기는 쓰는 곳이 정한다. 증감 아이콘은 장식이고 방향은 아이콘 곁의 시각 숨김 ▲ · ▼ 글자가 읽힌다(보이는 모습은 그대로). 1500 이하에서 5칸 수치가 작아지고,
        1100 이하 3열 · 760 이하 2열로 접힌다.
      </p>

      <h3 className={catalog.heading}>5칸 · trend up · down / description / 단위</h3>
      <StatStrip columns={5} items={KPI} />

      <h3 className={catalog.heading}>5칸 · 값 없음(NONE — 단위를 붙이지 않는다)</h3>
      <StatStrip columns={5} items={KPI_NO_VALUE} />

      <h3 className={catalog.heading}>6칸 · 탐색 실시간 · tone primary(찾은 API) · danger(차단)</h3>
      <StatStrip columns={6} items={DISCOVERY} />

      <h3 className={catalog.heading}>5칸 · 영역 실패(from 2 — 뒤 세 칸을 합쳐 한 상자)</h3>
      <StatStrip
        columns={5}
        items={KPI}
        failure={{ from: 2, content: <ErrorBlock message="요청에 실패했습니다 (500)" /> }}
      />

      <h3 className={catalog.heading}>5칸 · 영역 실패(from 0 — 띠 전체)</h3>
      <StatStrip columns={5} items={KPI} failure={{ from: 0, content: <ErrorBlock message="서버에 연결하지 못했습니다." /> }} />
    </div>
  );
}

// apps/web/src/api/dummy/data/projects.ts — 프로젝트 12건(이름 · 설명 · 태그 · 생성 · 활동 · 공유). id는 머신 이름. 배열 순서 = LNB 순서(공유 4 → 내 8)
import type { Project } from '../../types';

const MIDNIGHT = '00:00';
const kst = (date: string, time = MIDNIGHT) => `${date}T${time}:00+09:00`;
/** active 'YYYY-MM-DD HH:mm' → KST ISO */
const kstFromActive = (active: string) => {
  const [date = '', time = MIDNIGHT] = active.split(' ');
  return kst(date, time);
};

interface ProjectDef {
  id: string;
  name: string;
  description: string;
  tags: string[];
  shared: boolean;
  created: string;
  active: string;
  counts?: { sourceCount: number; connectorCount: number };
}
const project = ({
  id,
  name,
  description,
  tags,
  shared,
  created,
  active,
  counts,
}: ProjectDef): Project => ({
  id,
  name,
  description,
  tags,
  shared,
  createdAt: kst(created),
  updatedAt: kstFromActive(active),
  ...counts,
});

/** 소스 · 커넥터 수는 보험 인수심사(3 · 2)만 — 나머지는 대시보드 목에서 채운다 */
export const PROJECTS: readonly Project[] = [
  project({
    id: 'project_4',
    name: '코드 검색',
    description: '저장소 코드를 검색 대상으로 연결한 실험 프로젝트.',
    tags: ['실험', 'Git'],
    shared: true,
    created: '2026-08-30',
    active: '2026-09-02 09:12',
  }),
  project({
    id: 'project_6',
    name: '민원 응대 지원',
    description: '민원 이력과 응대 지침을 함께 찾아 상담 화면에 붙인다.',
    tags: ['민원', '문서검색'],
    shared: true,
    created: '2026-08-21',
    active: '2026-09-09 09:48',
  }),
  project({
    id: 'project_3',
    name: '사내 규정 검색',
    description: '사내 규정·양식 문서를 검색용으로 묶어 둔 프로젝트.',
    tags: ['문서검색', 'RAG'],
    shared: true,
    created: '2026-06-27',
    active: '2026-09-08 17:40',
  }),
  project({
    id: 'project_9',
    name: '재보험 정산',
    description: '재보험 정산 원장 조회를 담당 부서와 공유해 쓴다.',
    tags: ['재보험', 'DB'],
    shared: true,
    created: '2026-06-11',
    active: '2026-09-04 10:27',
  }),
  project({
    id: 'project_5',
    name: '계약 변경 이력 조회',
    description: '계약 변경 이력을 담당자가 직접 조회하도록 묶는 중인 프로젝트.',
    tags: ['계약', 'DB'],
    shared: false,
    created: '2026-09-05',
    active: '2026-09-09 16:10',
  }),
  project({
    id: 'project_7',
    name: '상품 약관 검색',
    description: '판매 중인 상품의 약관·특약 문서를 검색 대상으로 준비한다.',
    tags: ['약관', '문서검색'],
    shared: false,
    created: '2026-07-14',
    active: '2026-09-07 13:31',
  }),
  project({
    id: 'project_8',
    name: '지급 통계 리포트',
    description: '월별 지급 통계를 SQL로 뽑아 리포트에 연결할 예정.',
    tags: ['통계', 'SQL'],
    shared: false,
    created: '2026-07-02',
    active: '2026-09-05 18:02',
  }),
  project({
    id: 'project_10',
    name: '영업 교육 자료',
    description: '영업 교육 슬라이드와 스크립트를 검색용으로 정리한다.',
    tags: ['교육', '문서검색'],
    shared: false,
    created: '2026-05-29',
    active: '2026-08-30 15:44',
  }),
  project({
    id: 'project_11',
    name: '언더라이팅 실험',
    description: '인수 규칙 자동 판정 실험. 아직 소스를 붙이지 않았다.',
    tags: ['실험', '인수심사'],
    shared: false,
    created: '2026-05-08',
    active: '2026-08-26 11:19',
  }),
  project({
    id: 'project_2',
    name: '보험 인수심사',
    description: '인수심사 담당자가 계약 원장과 인수지침 문서를 함께 조회하는 프로젝트.',
    tags: ['인수심사', 'DB', '문서검색'],
    shared: false,
    created: '2026-04-18',
    active: '2026-09-10 14:22',
    counts: { sourceCount: 3, connectorCount: 2 },
  }),
  project({
    id: 'project_12',
    name: '해외 지점 데이터',
    description: '해외 지점 원장 접근 협의 중. 이름만 잡아 둔 프로젝트.',
    tags: ['해외'],
    shared: false,
    created: '2026-04-02',
    active: '2026-08-19 08:55',
  }),
  project({
    id: 'project_1',
    name: '청구 심사 지원',
    description: '청구 이력과 지급 기준을 조회해 심사 판단을 보조하는 프로젝트.',
    tags: ['청구', 'DB'],
    shared: false,
    created: '2026-02-03',
    active: '2026-09-10 11:05',
  }),
];

/** 가이드 모드: 같은 id로 이름 · 설명 · 태그 · 날짜만 바뀐다. 핸들러가 GET /projects/:id에 덮어쓴다 */
const GUIDE_DATE = '2026-09-11';
export const guideProject = (base: Project): Project => ({
  ...base,
  name: '신규 프로젝트',
  description: '',
  tags: [],
  sourceCount: 0,
  connectorCount: 0,
  createdAt: kst(GUIDE_DATE),
  updatedAt: kst(GUIDE_DATE),
});

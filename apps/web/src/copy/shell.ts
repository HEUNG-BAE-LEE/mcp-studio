// apps/web/src/copy/shell.ts — 앱 셸 문구 틀(LNB · 검색 · 알림 목록 · 새 프로젝트 다이얼로그)
import { TAGS_LABEL } from './common';
import { noMatchLabel } from './list';
import { PENDING } from './pending';

export const SHELL = {
  nav: {
    workSection: '작업 영역',
    projectsSection: '프로젝트',
    /** 라우트가 없는 항목 메모 */
    pending: PENDING.title,
    floatingToggle: '사이드바 고정',
  },
  search: {
    placeholder: '항목 · 프로젝트 검색',
    /** 0건 — total은 검색 대상 항목 수 */
    empty: (total: number) => noMatchLabel('항목이', total),
  },
  alerts: {
    loading: '알림을 불러오는 중…',
    emptyTitle: '확인할 알림이 없다',
    emptyBody: '알림은 상태에서 자동으로 만들어진다. 조건이 해제되면 목록에서 사라진다.',
  },
  newProject: {
    title: '새 프로젝트',
    importLabel: '기존 프로젝트에서 가져오기',
    importNone: '가져오지 않고 새로 입력',
    /** 가져온 뒤 가져오기 칸 설명(Field `description`, 마침표 없음) — 이름 뒤에 조사를 붙이지 않는다, 이름은 문장 끝에 둔다 */
    importNote: (name: string) => `이름 · 설명 · 태그를 가져왔습니다: ${name}`,
    /** 가져오기 이름 꼬리 — `○○ 사본` */
    copySuffix: ' 사본',
    create: '생성',
    creating: '생성 중…',
  },
  /** 프로젝트 칸(새 프로젝트 · 프로젝트 정보 폼이 같이 쓴다) */
  projectFields: {
    name: '이름',
    description: '설명',
    tags: TAGS_LABEL,
    tagPlaceholder: '태그 입력',
  },
} as const;

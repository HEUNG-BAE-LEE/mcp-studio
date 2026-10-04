// apps/web/src/copy/addSource.ts — 소스 추가 흐름 문구 · 폼 정의(타입 · 방식 · 칸 · 실행 값 · 단계 · 안내 · 로그). 서버는 code · 값만 준다
import type { SourceMode, SourceType } from '../api/types';
import { CANCEL_LABEL } from './common';
import { fieldMessage } from './errors';
import { countUnitLabel } from './format';
import { SOURCE_TYPE } from './status';
import { warnOnce } from './warnOnce';

export type FieldCopy = Readonly<{
  code: string;
  label: string;
  required: boolean;
  placeholder: string;
  span: 1 | 2;
  hint?: string;
}>;
type FormKey = `${SourceType}:${SourceMode}`;
const field = (
  code: string,
  label: string,
  required: boolean,
  placeholder: string,
  span: 1 | 2,
  hint?: string,
): FieldCopy =>
  hint
    ? { code, label, required, placeholder, span, hint }
    : { code, label, required, placeholder, span };
const NAME = '이 소스의 이름';
const PATH = field('path', '하위 경로', false, 'services/contract', 1);
const CHUNK = field('chunk', '자르는 단위', false, '문단', 1);
/** 칸 정의. 힌트는 필수 칸만 그린다 */
export const FORMS: Readonly<Partial<Record<FormKey, readonly FieldCopy[]>>> = {
  'code:url': [
    field(
      'repo',
      '저장소 주소',
      true,
      'https://git.internal/core/contract-api.git',
      2,
      'HTTPS 주소',
    ),
    field('branch', '브랜치', false, 'release', 1),
    PATH,
    field('token', '접속 키', false, '${vault:git/read_token}', 2),
    field('name', NAME, false, '예) 계약 서비스', 2),
  ],
  'code:dir': [
    field('dir', '폴더 경로', true, '/srv/src/contract-api', 2, '서버 안 절대 경로'),
    PATH,
    field('name', NAME, false, '예) 계약 서비스', 1),
  ],
  'database:conn': [
    field('host', '접속 주소', true, 'db-contract.internal:5432', 2, '호스트와 포트'),
    field('schema', '스키마', true, 'contract', 1, '읽을 범위'),
    field('account', '읽기 계정', true, 'svc_reader', 1, '조회 전용 계정'),
    field('secret', '접속 키', false, '${vault:db/contract}', 2),
    field('name', NAME, false, '예) 계약 원장', 2),
  ],
  'database:dsn': [
    field(
      'dsn',
      '연결 문자열',
      true,
      'postgresql://svc_reader@db-contract.internal:5432/contract',
      2,
      '드라이버까지 포함',
    ),
    field('schema', '스키마', false, 'contract', 1),
    field('name', NAME, false, '예) 계약 원장', 1),
  ],
  'document:upload': [
    field('files', '올린 파일', true, '인수지침_2026.pdf 외 4', 2, '고른 파일이 여기에 들어옵니다'),
    CHUNK,
    field('name', NAME, false, '예) 인수지침 문서', 1),
  ],
  'document:dir': [
    field('dir', '폴더 경로', true, '/srv/docs/underwriting', 2, '서버 안 절대 경로'),
    CHUNK,
    field('name', NAME, false, '예) 인수지침 문서', 1),
  ],
};
export const formOf = (type: SourceType, mode: SourceMode): readonly FieldCopy[] =>
  FORMS[`${type}:${mode}`] ?? [];
/** Git 실행 시점 값(선택) — 코드에 없는 값 */
export const RUNTIME_FIELDS: readonly FieldCopy[] = [
  field('svc', '이 서비스 주소', false, 'http://10.60.1.10:8001', 1),
  field('dburl', '데이터베이스 연결', false, '${env:LEGACY_DATABASE_URL}', 1),
];

type TypeCopy = Readonly<{
  name: string;
  /** 종류 라벨 — 타입 카드 머리 · 담은 카드 · 진행 항목 표식. 값은 앱 공용 소스 타입 라벨(copy/status) */
  tag: string;
  desc: string;
  how: string;
  gets: readonly string[];
  autoNote: string;
  connectTitle: string;
  foot: string;
}>;
const TYPES: Readonly<Record<SourceType, TypeCopy>> = {
  code: {
    name: '코드',
    tag: SOURCE_TYPE.code,
    desc: 'Git 저장소를 읽어 API 와 조회 함수를 도구로 만듭니다.',
    how: '설명서가 있으면 그대로 쓰고, 없으면 코드를 직접 읽습니다. 밖으로 열려 있지 않은 내부 기능도 함께 가져옵니다.',
    gets: ['API 도구', '조회 도구'],
    autoNote: '호출 지점을 그대로 도구로 옮깁니다. 고도화 단계에서 손댈 것이 가장 적습니다.',
    connectTitle: '읽을 소스 코드를 담습니다',
    foot: '저장소마다 별도 소스로 잡힙니다',
  },
  database: {
    name: '데이터베이스',
    tag: SOURCE_TYPE.database,
    desc: '떠 있는 서버와 데이터베이스를 찾아옵니다. 코드가 없어도 됩니다.',
    how: '서버마다 API 설명서가 열려 있는지 확인하고, 데이터베이스는 표 구조를 읽어 객체 타입 후보로 만듭니다.',
    gets: ['조회 도구', '객체 타입'],
    autoNote:
      '표를 객체 타입으로 정의하고, SQL 뷰와 파이프라인으로 가공한 뒤 도구로 만듭니다. 각 단계에 승인이 붙습니다.',
    connectTitle: '읽을 데이터베이스를 담습니다',
    foot: '스키마마다 별도 소스로 잡힙니다',
  },
  document: {
    name: '문서',
    tag: SOURCE_TYPE.document,
    desc: 'PDF · DOCX · XLSX 를 올려 검색용 지식으로 만듭니다.',
    how: 'PDF · 워드 · 엑셀을 문단 단위로 잘라 찾아 읽을 수 있는 조각으로 만듭니다. 표와 머리말은 따로 처리합니다.',
    gets: ['검색 지식'],
    autoNote: '자르기까지는 자동이고, 파이프라인에서 검색 품질을 맞춥니다.',
    connectTitle: '읽을 문서를 담습니다',
    foot: '올린 묶음마다 별도 소스로 잡힙니다',
  },
};
const step = (title: string, sub: string) => ({ title, sub });
const MISSING_SEPARATOR = ': ';
const LABEL_SEPARATOR = ', ';

export const ADD_SOURCE = {
  title: '새로운 소스 추가',
  types: TYPES,
  modes: {
    url: 'Git 주소',
    dir: '이 서버의 폴더',
    conn: '접속 정보',
    dsn: '연결 문자열',
    upload: '파일 올리기',
  } satisfies Record<SourceMode, string>,
  steps: {
    type: step(
      '어떤 소스를 연결할까요?',
      '이 프로젝트에 붙일 소스를 고릅니다. 소스에서 나온 결과물이 이 프로젝트의 커넥터 재료가 됩니다.',
    ),
    connectSub:
      '왼쪽을 채우고 담기를 누릅니다. 같은 종류는 여러 개를 담을 수 있고, 담은 목록이 그대로 확인 화면입니다.',
    running: step('연결하는 중입니다', '이 화면을 닫아도 읽어오기는 백그라운드에서 계속됩니다.'),
    done: step('연결했습니다', '산출물은 프로젝트 현황의 연결된 소스에서 확인합니다.'),
    /** 일부가 멈추거나 수집 실패로 끝났다 */
    partial: step(
      '일부만 연결했습니다',
      '읽지 못한 소스는 프로젝트 현황의 설정에서 접속 정보를 고친 뒤 다시 수집합니다.',
    ),
  },
  next: {
    type: '다음',
    connect: (n: number) => (n > 0 ? `${countUnitLabel(n, '개')} 읽어오기` : '읽어오기'),
    submitting: '확인 중…',
    running: '닫고 프로젝트 현황에서 보기',
    chain: '추가 고도화 시작',
    back: '프로젝트로 돌아가기',
  },
  /** 주 액션이 비활성인 이유 — 흐름 발 note */
  blocked: {
    type: '소스 종류를 고르면 다음으로 갈 수 있다',
    connect: '소스를 하나 이상 담으면 읽어올 수 있다',
  },
  /** close — 일부만 끝났을 때 */
  footer: { back: '이전', exit: '나가기', doneBack: '프로젝트로 돌아가기', close: '닫기' },
  guide: {
    title: '소스 연결 과정',
    steps: [
      { label: '소스 고르기', desc: '코드 · 데이터베이스 · 문서 중 하나를 고릅니다' },
      { label: '연결', desc: '고른 종류에 맞는 접속 정보를 넣어 담고, 담은 목록에서 확인합니다' },
      { label: '읽어오기', desc: '담은 순서대로 구조를 읽어 결과물로 바꿉니다' },
    ],
    now: [
      {
        title: '지금 고르는 것이 다음 화면을 정합니다',
        note: '소스 종류에 따라 물어보는 항목이 달라집니다. 한 번에 담는 것은 같은 종류끼리입니다.',
      },
      {
        title: '담은 만큼 한 번에 읽어옵니다',
        note: '접속 키는 저장하지 않고 금고 값을 참조합니다. 담은 항목은 오른쪽에서 고치거나 뺄 수 있습니다.',
      },
      {
        title: '이 화면을 닫아도 계속됩니다',
        note: '진행 상황은 프로젝트 현황의 상태에서 이어서 보고, 멈추면 설정의 접속 정보에서 고칩니다.',
      },
    ],
  },
  card: {
    gets: '결과물',
    fields: '연결 정보',
    fieldCount: (req: number, opt: number) => `필수 ${req} · 선택 ${opt}`,
    automation: '자동화 수준',
    automationHelp: '자동화 수준 설명',
  },
  form: {
    add: '+ 담기',
    update: '수정 반영',
    cancelEdit: '수정 취소',
    runtimeTitle: '이 소스를 부를 때 필요한 정보',
    /** 담기가 잠긴 이유(한 줄 사유 `…다`) — 칸 이름은 문장 끝에 둬 조사를 붙이지 않는다 */
    missing: (labels: readonly string[]) =>
      `필수 칸을 채워야 담을 수 있다${MISSING_SEPARATOR}${labels.join(LABEL_SEPARATOR)}`,
    drop: {
      lines: ['파일을 여기로 끌어 놓거나,', '여기를 눌러 첨부합니다.'] as const,
      formats: 'PDF · DOCX · XLSX',
      description: '파일 첨부',
    },
    filesValue: (names: readonly string[]) =>
      names.length > 1 ? `${names[0]} 외 ${names.length - 1}` : (names[0] ?? ''),
  },
  basket: {
    title: '담은 소스',
    emptyTitle: '아직 담은 것이 없다',
    emptyBody: ['왼쪽을 채우고 담기를 누르면', '여기에 쌓인다.'] as const,
    edit: '수정',
    remove: (title: string) => `${title} 빼기`,
    runtimeFilled: (labels: readonly string[]) => `${labels.join(' · ')} 채움`,
    unnamed: '이름 없음',
    chainTitle: '연결이 끝나면 추가 고도화를 이어서 진행',
    chainNote: '끄면 나중에 프로젝트 현황의 설정에서 따로 진행할 수 있습니다',
    /** 등록 거부(400) 사유 줄 */
    rejected: (label: string, reason: string) => `${label} · ${reason}`,
  },
  run: {
    title: '연결한 소스',
    running: '읽어오는 중',
    done: '다 읽었습니다',
    count: (n: number) => countUnitLabel(n, '건'),
    state: { waiting: '대기', reading: '읽는 중', done: '완료', failed: '수집 실패' },
    doneHead: (n: number) => `소스 ${countUnitLabel(n, '건')}을 읽었습니다`,
    /** 일부만 끝남 */
    settled: '읽기를 마쳤습니다',
    partialHead: (ok: number, n: number) =>
      `소스 ${countUnitLabel(n, '건')} 중 ${countUnitLabel(ok, '건')}을 읽었습니다`,
    overall: '전체 진행',
    item: (title: string) => `${title} 진행`,
  },
  outputs: {
    api_tools: 'API 도구',
    internal_functions: '내부 조회 함수',
    object_types: '객체 타입',
    tables_read: '읽은 표',
    documents: '문서',
    chunks: '청크',
  } as Readonly<Record<string, string>>,
  exit: {
    title: '소스 추가에서 나갈까요?',
    description: '나가면 담은 내용은 남지 않습니다',
    cancel: CANCEL_LABEL,
    confirm: '나가기',
  },
  /** 진행 로그는 copy 틀 */
  runLog: (n: number): readonly string[] => [
    `00:00:01  담은 ${countUnitLabel(n, '건')} 연결 확인 — 응답 있음`,
    '00:00:06  읽을 범위 확인',
    `00:00:14  구조 읽는 중… (1/${n})`,
    '00:00:29  결과물 만드는 중…',
    `00:00:41  마무리 확인 — ${countUnitLabel(n, '건')}`,
  ],
} as const;
/** 모르는 결과 코드는 코드 그대로 + 경고 */
export function outputLabel(code: string): string {
  const known = ADD_SOURCE.outputs[code];
  if (known) return known;
  warnOnce(`output:${code}`, `[copy] 모르는 결과 코드 ${code}`);
  return code;
}
/** 등록 거부 사유 코드 → 칸 아래 검증 문구. 폼 검증 문구와 같은 표(copy/errors) — 모르는 코드는 기본 틀 + 경고 한 번 */
export const fieldErrorText = fieldMessage;
/** 칸 코드 → 라벨(폼 · 부를 때 정보). 모르는 칸은 코드 그대로 */
export function fieldLabelOf(type: SourceType, mode: SourceMode, code: string): string {
  const fields = type === 'code' ? [...formOf(type, mode), ...RUNTIME_FIELDS] : formOf(type, mode);
  return fields.find((f) => f.code === code)?.label ?? code;
}

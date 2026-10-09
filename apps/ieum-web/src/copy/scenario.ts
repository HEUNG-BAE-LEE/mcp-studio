// 개발용 ?mock= 상태 픽스처의 한글(api/scenario만 읽는다 — 그곳은 import.meta.env.DEV 안에서만 불려 운영 dist에서 빠진다).
// 함수 호출(Object.freeze 등) 없이 글자 리터럴만 둔다 — 쓰는 곳이 빠지면 이 모듈도 통째로 빠지게.
// 이름 끝의 [mock]은 가짜 값임을 화면에서 알아보고 운영 dist에 없는지 grep하는 표식이다

/** disc — 자동 탐색으로 등록한 원본 하나와 그 도구들(스튜디오 탐색 안내 띠 · 근거 종류 · 검증 라벨 확인용) */
export const SCENARIO_DISC = {
  source: {
    name: '구매관리 [mock]',
    desc: '자동 탐색으로 찾은 API를 등록한 시연용 원본입니다. [mock]',
    // 아래 셋은 서버가 탐색 등록 때 넣는 글자와 같다(discovery/jobs.py)
    spec: 'Git 소스와 운영 트래픽으로 추론',
    auth: '세션 (서비스 계정)',
    sync: '방금',
  },
  params: {
    year: '조회 연도',
    header: '화면이 항상 같은 값으로 보내는 헤더',
    title: '제목',
  },
  recNote: {
    traffic: '저장소에 소스가 없어 타입은 관찰한 값으로 추정했습니다. [mock]',
    screen: '운영 화면의 "발주 목록"에서 쓰입니다. [mock]',
    write: '쓰기 API라 검증 호출을 보내지 않았습니다. [mock]',
  },
  tools: {
    mock_disc_both_ok: { title: '발주 목록 [mock]', desc: '발주 목록을 조회합니다. 조회 API 입니다. [mock]' },
    mock_disc_src_file: { title: '발주서 출력 [mock]', desc: '발주서 파일을 내려받습니다. 조회 API 입니다. [mock]' },
    mock_disc_tr_stg: { title: '월별 발주 현황 [mock]', desc: '월별 발주 현황을 조회합니다. 조회 API 입니다. [mock]' },
    mock_disc_both_err: { title: '거래처 목록 [mock]', desc: '거래처 목록을 조회합니다. 조회 API 입니다. [mock]' },
    mock_disc_src_err: { title: '품목 단가 [mock]', desc: '품목 단가를 조회합니다. 조회 API 입니다. [mock]' },
    mock_disc_tr_404: { title: '예산 잔액 [mock]', desc: '예산 잔액을 조회합니다. 조회 API 입니다. [mock]' },
    mock_disc_both_stgerr: { title: '구매요청 목록 [mock]', desc: '구매요청 목록을 조회합니다. 조회 API 입니다. [mock]' },
    mock_disc_src_none: { title: '코드 목록 [mock]', desc: '공통 코드 목록을 조회합니다. 조회 API 입니다. [mock]' },
    mock_disc_tr_unknown: { title: '발주 상세 [mock]', desc: '발주 상세를 조회합니다. 조회 API 입니다. [mock]' },
    mock_disc_write_block: {
      title: '구매요청 임시저장 [mock]',
      desc: '구매요청을 임시저장합니다. 데이터를 만들거나 바꾸는 API 입니다. [mock]',
      confirmQ: '구매요청 임시저장 작업을 실행할까요? [mock]',
    },
  },
} as const;

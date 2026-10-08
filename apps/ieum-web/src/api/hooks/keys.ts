// 쿼리 키 한 곳. 무효화는 접두로 한다(['playground']는 region 쪽 키까지 함께 무효화)
// 키 첫 조각은 백엔드 자원 이름(경로 첫 조각)을 따른다

export const keys = {
  /** GET /sources/ — workspace · sources · wizard */
  sources: () => ['sources'] as const,
  /** GET /studio/ — 원본별 도구 */
  tools: () => ['studio'] as const,
  /**
   * GET /playground/ — 같은 경로를 분류마다 따로 캐시한다(먼저 받은 쪽의 실패가 다른 쪽에 남지 않게).
   * 테스트 실행은 화면 조회 ['playground'], 대시보드 구조도 · 로그 필터 · 모델 라벨은 region 조회 ['playground', {region:true}]
   */
  playground: (region = false) => (region ? (['playground', { region: true }] as const) : (['playground'] as const)),
  /** GET /dashboard/summary/ — 대시보드 요약(영역 조회) */
  dashboardSummary: () => ['dashboard', 'summary'] as const,
  /** GET /logs/ — 호출 로그 목록. 상세는 ['logs', id]로 이 키 아래에 둔다 */
  logs: () => ['logs'] as const,
  /** GET /discovery/ — 원본 화면의 탐색 개요(영역 조회) */
  discoveryOverview: () => ['discovery', { region: true }] as const,
  /** GET /deploy/toolsets/ — 도구 묶음 · 배포 상태. 서버 로그는 이 키 아래 따로 둔다 */
  toolsets: () => ['deploy', 'toolsets'] as const,
};

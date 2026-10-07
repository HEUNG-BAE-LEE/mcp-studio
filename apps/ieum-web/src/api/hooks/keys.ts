// 쿼리 키 한 곳. 무효화는 접두로 한다(['playground']는 region 쪽 키까지 함께 무효화)
// 키 첫 조각은 백엔드 자원 이름(경로 첫 조각)을 따른다

export const keys = {
  /** GET /sources/ — workspace · sources · wizard */
  sources: () => ['sources'] as const,
  /** GET /studio/ — 원본별 도구 */
  tools: () => ['studio'] as const,
  /**
   * GET /playground/ — 같은 경로를 분류마다 따로 캐시한다(audit layers-nav.md Q-03 · critic K-18).
   * 테스트 실행은 화면 조회 ['playground'], 대시보드 구조도 · 로그 필터 · 모델 라벨은 region 조회 ['playground', {region:true}]
   */
  playground: (region = false) => (region ? (['playground', { region: true }] as const) : (['playground'] as const)),
};

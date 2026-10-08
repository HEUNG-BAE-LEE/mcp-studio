// 자동 탐색 작업 화면으로 가는 주소 — 작업 표 행 · 마법사 시작 성공 · "같은 설정으로 다시 탐색"이 같이 쓴다(app/nav discovery 경로)

/** 작업 화면 `/sources/discovery/<작업 id>` */
export const jobPath = (jobId: string): string => `/sources/discovery/${encodeURIComponent(jobId)}`;

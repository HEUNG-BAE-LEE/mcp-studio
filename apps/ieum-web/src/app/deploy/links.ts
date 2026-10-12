// AI 연결 배포 화면 주소 — 묶음 선택 · 만들기 성공 이동이 같이 쓴다(app/nav deploy 경로 `/deploy/:toolsetId?`)

/** 배포 화면 `/deploy` — 묶음 id가 없으면 화면이 첫 묶음으로 바꾼다 */
export const DEPLOY_PATH = '/deploy';

/** 묶음 하나를 고른 배포 화면 `/deploy/<묶음 id>` */
export const toolsetPath = (toolsetId: string): string => `${DEPLOY_PATH}/${encodeURIComponent(toolsetId)}`;

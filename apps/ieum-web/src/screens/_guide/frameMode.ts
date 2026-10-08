// 본문만 그리는 모드의 주소 표식 — 뷰어(GuideViewer)가 같은 주소에 이 쿼리를 붙여 iframe으로 띄우고, GuideScreen이 읽는다
export const FRAME_PARAM = 'frame';
export const FRAME_ON = '1';
export const FRAME_SEARCH = `?${FRAME_PARAM}=${FRAME_ON}`;

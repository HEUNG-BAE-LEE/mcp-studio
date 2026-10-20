// 컴포넌트 카탈로그(/_guide) — 부품 · 토큰 목록. 셸 밖에 둔다(routes.tsx OUTSIDE_SHELL).
// `?frame=1`이면 본문(절 목록)만 그린다. 뷰어는 같은 주소에 이 쿼리를 붙여 폭이 정해진 iframe으로 띄운다 —
// 상자 폭만 바꾸면 @media 조건이 그대로라서, 창 폭이 실제로 바뀌는 iframe으로 폭 전환을 한다
import { useSearchParams } from 'react-router-dom';
import { GuideBody } from './GuideBody';
import { GuideViewer } from './GuideViewer';
import { FRAME_ON, FRAME_PARAM } from './frameMode';

export function GuideScreen() {
  const [params] = useSearchParams();
  return params.get(FRAME_PARAM) === FRAME_ON ? <GuideBody /> : <GuideViewer />;
}

// RouteError — 라우트 errorElement. React Router 기본 영문 오류 화면 대신 한국어 문구와 대시보드 링크만 보인다.
// 모양은 3단계 ①에서 디자인의 ErrorBlock으로 바꾼다. 없는 주소는 여기로 오지 않는다(routes.tsx의 '*'가 대시보드로 보낸다)
import { useEffect } from 'react';
import { Link, useRouteError } from 'react-router-dom';
import { ROUTE_ERROR } from '../copy/shell';

export function RouteError() {
  const error = useRouteError();
  // 오류를 삼키지 않는다 — 화면에는 고정 문구만, 원인은 콘솔에 남긴다
  useEffect(() => {
    console.error('[route] 화면을 그리다 오류가 났습니다', error);
  }, [error]);
  return (
    <section role="alert">
      <h2>{ROUTE_ERROR.title}</h2>
      <p>{ROUTE_ERROR.body}</p>
      <Link to="/">{ROUTE_ERROR.home}</Link>
    </section>
  );
}

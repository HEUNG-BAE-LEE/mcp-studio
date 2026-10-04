"""이음(AI 프로토콜 변압기) 게이트웨이.

레거시 원본 시스템(OpenAPI, WSDL, 호출 샘플, 공공데이터포털)의 명세를 읽어 AI 도구로
바꾸고, 도구 묶음을 MCP 서버로 배포한다. 관리 콘솔(정적 파일)은 `apps/web/ieum`.

    routers/       메뉴별 API 라우터 (대시보드, 원본 시스템, 변환 스튜디오, 테스트 실행, 배포, 로그)
                   + MCP 서버 + 시연용 원본 시스템(demo_origin)
    repositories/  메뉴별 저장소 (store.JsonStore 위의 얇은 함수들)
    gateway/       명세 파서, 변환 엔진, 인증 정보 보관, 도구 실행
    data/          메뉴별 시드 JSON. 변경분은 `apps/backend/data/ieum/` 에 쌓인다

`app.main` 이 `routers.router` 를 붙이고 `console.mount_console` 로 콘솔을 `/ieum/` 에 올린다.
"""

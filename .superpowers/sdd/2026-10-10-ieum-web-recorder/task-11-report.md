# Task 11 보고

## 구현
- `recorder/service.py`: finish(analyzing→verifying→review, 예외 흡수, finally 에서 MANAGER.close), update_function, reverify, confirm, register_single/steps.
- `routers/recorder.py`: `MANAGER.on_stopped = service.finish`, 업무 기능 GET/PUT/verify/confirm/register 라우트.
- 지시서 코드에서 바꾼 것
  - 등록 도구에 가린 문자열 금지: 가린 ex 는 비우고 필수 입력으로 남김(inject 안 함), 가린 헤더는 제외, 마지막에 `_scrub` 으로 도구 JSON 전체(응답 샘플 포함)를 훑어 가린 문자열을 비움.
  - 감사: 지시서에 감사 기록이 없어 `_audit` 추가. finish 의 검증과 reverify 마다 `logs.append("recorder", fid, ok/err, ..., note)` 한 줄. note 는 종류·상태·사유 코드·단계 id 만(값·URL 없음).
  - finish 실패 시 기록 status=failed + error, 함수가 있으면 verification.status=failed(reason=pipeline_error)와 notes 에 메시지. 상태 알림 실패·close 실패도 로그만 남기고 삼킴.
  - 금고 키(rec:<rid>)는 finish/confirm 에서 지우지 않음.

## 시험
- RED: `pytest tests/test_ieum_recorder_service.py` → ImportError (service 없음).
- GREEN: 11 passed (지시서 6 + 가린 문자열 없음 / finish 정상 / finish 실패+close / reverify 값 비저장+감사 / 라우트).
- 전체: 704 passed (4분 23초).

## 수정 보고 1
- I-1: `store.update_function(fid, fn)` 추가(LOCK 안에서 최신을 다시 읽어 고치고 저장, fn 예외면 저장 안 함). update_function·confirm·reverify·finish 가 사용. reverify 는 검증 결과(verification/executionMode)만 최신 bf 에 반영하고, 검증 중 입력·단계가 바뀌었으면 verified 를 stale 로 낮춘다. 분석·검증 중이거나 같은 fid 재검증 중이면 `service.Busy` → 409. 시험: 검증 중 확정해도 confirmed 유지.
- I-2/I-3: `_register` 전체를 `store.LOCK` 한 번으로 감쌈(LOCK 은 재진입 가능 RLock+깊이 카운터라 안쪽 저장소 함수와 중첩해도 안전). 같은 fid+method+path 도구는 제자리 교체(id 유지, calls 보존), 원본 desc 개수는 최종 목록 기준. 시험: 스레드 동시 등록, 재등록 시 개수 불변.
- I-4: 입력·정책·steps·promote 를 앞에서 검증하고 ValueError → 400(검증 뒤에만 변경). steps 는 모든 단계를 한 번씩, 건너뛴 단계는 `skip: true` 로 보관(등록·검증에서는 제외). 건너뛴 단계 결과를 쓰는 단계/출력 단계 건너뛰기는 400. 새 단계 id = 최대 번호+1, 출처는 제외된 요청의 base/origin. 이를 위해 `analyze.py` 의 excluded 항목에 base/origin 을 더함(기존 28개 분석 시험 통과). scope/sensitivity 는 분석이 항상 None 으로 내므로 enum 이 없어 60자 이하 글로만 제한.
- 사소: fid `^bf_[0-9a-f]{8}$` 전 라우트 400, mode 검증, `_scrub` 은 desc/name/title/description 등 글 필드와 키를 건드리지 않음, 기존 원본 금고 인증정보는 비어 있을 때만 채움(`loginKnown` 은 원본별 dict), verify 오류는 고정 문구(서버 로그만 상세).
- 비밀 이름 가린 파라미터: 도구 엔진에 파라미터별 금고 주입 장치가 없다(`inject` 는 도구 정의에 값을 담음). 그대로 필수 입력으로 두었고 가린 값은 도구에 굳히지 않음.
- 시험: 서비스 시험 36개 통과, 전체 729개 통과.

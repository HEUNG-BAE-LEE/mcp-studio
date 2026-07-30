# 실측 기록 — 중간결과보고서 근거

보고서에 인용하는 모든 수치의 출처. 각 항목에 실행 일시·명령·원본 출력 요약을 남긴다.

## 환경

- 측정일: 2026-07-30, macOS (Darwin 25.5.0)
- 코드 기준: `docs/interim-report` 브랜치 (5370cbd 이후)
- Python 3.10.20 (Homebrew `python@3.10` — 프로젝트 명세 3.10.11과 같은 3.10 계열), Node v24.15.0
- 신규 설치 이슈 1건 발견·수정: requirements.txt 가 pydantic 을 핀하지 않아
  최신 pydantic 2.12+ 가 설치되면 sqlmodel 0.0.22 와 비호환
  (`Field 'id' requires a type annotation`, 수집 오류 8건). `pydantic<2.12` 핀 추가로 해결
  — 실측: pydantic 2.13.4 → 실패, 2.11.10 → 전체 통과

## 테스트 스위트

실행 일시: 2026-07-30 오후

| 대상 | 명령 | 결과 | 소요 |
|---|---|---|---|
| 백엔드 | `.venv/bin/pytest tests/ -q` | **133 passed** (2 warnings) | 2.94초 |
| 확장 | `npm test` (vitest) | **22 passed** (파일 3개) | 284ms |
| admin 타입체크 | `npx tsc -b` | 통과 | — |
| extension 타입체크 | `npm run compile` | 통과 | — |

합계 자동 테스트 **155개 통과** (백엔드 133 + 확장 22).

## 일괄 수집

- 실행 일시: 2026-07-30 14:04:08 ~ 14:05:40 KST — **총 92초** (CrawlJob #1 `started_at`/`finished_at` 기준)
- 입력: 키워드 "미세먼지" 검색 결과 URL (`data.go.kr/tcs/dss/selectDataSetList.do?dType=API&keyword=미세먼지`), 요청 개수 30
- 결과: 목록에서 서비스 후보 40개 발견 → 상세페이지 34개 순회 → **서비스 16개에서 오퍼레이션 30개 수집** (상한 30 도달로 종료), 상태 `completed`
- 수집 산출물: 세션 #2 (한국환경공단 에어코리아, 기후에너지환경부 국립환경과학원, 제주특별자치도 IoT 센서 등 — GET 오퍼레이션, 파라미터 4~8개·응답 필드 8~32개 자동 추출)
- 준수 사항: 요청 간 1초 간격, 상한 60건 이하(30 설정), 재시도 없음 — `portal_crawler.py` 기본값 그대로
- 캡처: `capture-crawl-progress.png`(진행 중), `capture-crawl-result.png`(결과 목록)

## LLM 콘솔

- 실행 일시: 2026-07-30 14:07~14:09 KST
- 질의: "광화문 근처 아파트 단지 알려줘" (시드 액션 "아파트 단지 마커 조회", 프로젝트 #1)
- 도구 선택: `search_apartment_markers` — **파라미터 6개 전부 LLM이 추론해 채움**
  (minX 126.965 / minY 37.565 / maxX 126.985 / maxY 37.58 / srhYear 2026 / poiType "A"),
  질의 → 표시까지 약 10초 내외 (브라우저 자동화 오버헤드 포함)
- 실행 결과: **HTTP 200 · 227ms** (대상 API 왕복), 한국어 요약에 실제 단지명 반환 —
  세종, 세종로대우, 신문로맨션, 광화문스페이스본, 경희궁자이(3단지), 경희궁의아침2단지,
  신동아블루아광화문의꿈, 두레엘리시안, 대성스카이렉스, 디팰리스
- 요약 생성 포함 실행 단계 소요 약 5~15초 (LLM 요약이 시간을 지배 — 기존 리허설 기록과 일치)
- Azure 호출 횟수: 2회 (도구 선택 1 + 요약 1) — 계획 상한 준수
- 캡처: `capture-console-tool.png`(도구 선택·인자), `capture-console-result.png`(실행 결과·요약)

## 기존 문서 인용 실측치

- 일괄 수집 선행 실측: 미세먼지 25건 → 서비스 13개·오퍼레이션 25개, 약 2분 (README.md §4-6)
- LLM 콘솔 응답 편차: 152ms ~ 5,380ms — LLM 요약 생성이 시간을 지배 (docs/demo-script.md 리허설 기록)
- 트래픽 기록: 지도 확대 클릭 1회당 요청 3건 안팎 포착 (README.md §4-1)
- LLM 실행 왕복 실측 예: HTTP 200 · 126ms (README.md §3)

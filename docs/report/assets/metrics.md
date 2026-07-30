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

(Task 2에서 기록)

## LLM 콘솔

(Task 3에서 기록)

## 기존 문서 인용 실측치

- 일괄 수집 선행 실측: 미세먼지 25건 → 서비스 13개·오퍼레이션 25개, 약 2분 (README.md §4-6)
- LLM 콘솔 응답 편차: 152ms ~ 5,380ms — LLM 요약 생성이 시간을 지배 (docs/demo-script.md 리허설 기록)
- 트래픽 기록: 지도 확대 클릭 1회당 요청 3건 안팎 포착 (README.md §4-1)
- LLM 실행 왕복 실측 예: HTTP 200 · 126ms (README.md §3)

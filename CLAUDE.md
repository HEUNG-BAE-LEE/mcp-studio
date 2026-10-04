# CLAUDE.md — MCP-Studio

MCP-Studio 웹 프런트엔드의 **디자인 가이드 저장소**다. 새 화면 · 컴포넌트는 아래 문서와 스킬을 따르고, 맞는 규칙이 없으면 문서부터 고쳐 가이드를 키운다. LNB · 대시보드 · 프로젝트 상세 · 준비 중 자리는 언제든 바뀌는 샘플 IA(DESIGN 용어집)다. 백엔드 없이 더미 데이터로 돈다. 할 일은 사용자가 준 과제와 DESIGN `## 미정`이다 — 준비 중 자리를 차례로 채우거나 샘플 화면의 기능을 늘리는 것은 목표가 아니다.

## 이 저장소가 개인 전역 규칙보다 우선한다
- 테스트를 쓰지 않는다(화면은 언제든 바뀌는 샘플이다 — 규칙은 타입 · 린트 · 카탈로그 · ui-review로 지킨다)
- 계획 · 설계 · 명세 문서와 할 일 목록을 저장소에 만들지 않는다(과제는 사용자가 준다). 화면의 요구 메모는 화면 파일 머리 주석에 쓴다 (`docs/`에는 두 문서만 — `pnpm lint:docs`가 검사)
- 새 의존성 · UI 킷 · CSS 프레임워크를 들이지 않는다

## 문서 지도
| 찾는 것 | 문서 |
|---|---|
| 핵심 규칙 · 토큰 뜻 · 색 · 레이아웃 · 화면 틀 · 패턴 · 문구 · 접근성 · 용어 | [docs/DESIGN.md](docs/DESIGN.md) — `## 핵심 규칙`(12행)을 먼저, 나머지는 필요한 절만 |
| 컴포넌트 prop · 크기 · 쓰는 곳 · 쓰지 않는 곳 | [docs/COMPONENTS.md](docs/COMPONENTS.md) |
| 토큰 값 | [apps/web/src/styles/tokens.css](apps/web/src/styles/tokens.css) |

## 작업별 스킬
| 작업 | 스킬 |
|---|---|
| 새 화면을 만든다 | `.claude/skills/new-screen` |
| 토큰 · 컴포넌트 · 변형 · 패턴 · 화면 틀을 더하거나 바꾼다 | `.claude/skills/design-change` |
| 마치기 전 점검 | `.claude/skills/ui-review` |

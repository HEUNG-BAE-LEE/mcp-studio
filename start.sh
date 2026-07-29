#!/usr/bin/env bash
# 백엔드(:8000)와 관리자 화면(:5173)을 한 번에 띄운다.
# Ctrl+C 한 번으로 둘 다 내려간다.
#
# 확장은 별도다. 코드를 고쳤으면 `cd apps/extension && npm run build` 후
# chrome://extensions 에서 다시 로드하고, **대상 페이지를 새로고침**해야 한다.
# 새로고침하지 않으면 이미 주입돼 있던 콘텐츠 스크립트가 고아가 되어
# 클릭도 명세 감지도 전달되지 않는다.
set -euo pipefail
cd "$(dirname "$0")"

BACKEND_PORT="${BACKEND_PORT:-8000}"
ADMIN_PORT="${ADMIN_PORT:-5173}"
LOG_DIR="${TMPDIR:-/tmp}"
BACKEND_LOG="$LOG_DIR/mcp-studio-backend.log"
ADMIN_LOG="$LOG_DIR/mcp-studio-admin.log"

# ── 포트 정리 ────────────────────────────────────────────────
# `-sTCP:LISTEN` 은 반드시 있어야 한다. 빼면 그 포트에 **접속한** 프로세스까지
# 잡히는데, 관리자 화면을 열어둔 Chrome 이 거기 포함된다. 실측으로 3개 중
# 2개가 Chrome 이었다 — 브라우저가 통째로 닫힌다.
free_port() {
  local port="$1" label="$2" pids
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  [ -z "$pids" ] && return 0

  echo "  :$port 사용 중 → 기존 $label 종료"
  kill $pids 2>/dev/null || true
  for _ in 1 2 3 4 5; do
    sleep 0.4
    pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    [ -z "$pids" ] && return 0
  done
  # 얌전히 안 죽으면 강제 종료. 여기까지 왔다는 건 이전 프로세스가 멈춘 것이고,
  # 남겨두면 낡은 코드를 계속 서빙한다.
  echo "  :$port 응답 없음 → 강제 종료"
  kill -9 $pids 2>/dev/null || true
  sleep 0.5
}

# ── 사전 점검 ────────────────────────────────────────────────
# 없는 것을 조용히 넘기지 않는다. 서버가 뜬 뒤에 알면 원인을 찾느라 시간을 쓴다.
if [ ! -x apps/backend/.venv/bin/uvicorn ]; then
  echo "✗ apps/backend/.venv 가 없습니다. 먼저 만드세요:"
  echo "    cd apps/backend"
  echo "    python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

if [ ! -d node_modules ] || [ ! -d apps/admin/node_modules ]; then
  echo "✗ npm 패키지가 없습니다. 저장소 루트에서 실행하세요:  npm install"
  exit 1
fi

if [ ! -f apps/backend/.env ]; then
  echo "! apps/backend/.env 가 없습니다. LLM 콘솔은 동작하지 않습니다."
  echo "  (.env.example 을 복사해 Azure 값 네 개를 채우세요)"
fi

# ── 종료 처리 ────────────────────────────────────────────────
BACKEND_PID=""
ADMIN_PID=""
cleanup() {
  trap - INT TERM EXIT
  echo
  echo "종료 중..."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$ADMIN_PID" ] && kill "$ADMIN_PID" 2>/dev/null || true
  # vite 는 자식 프로세스를 따로 띄운다. 부모만 죽이면 포트가 물린 채 남는다.
  free_port "$ADMIN_PORT" "관리자" >/dev/null 2>&1 || true
  free_port "$BACKEND_PORT" "백엔드" >/dev/null 2>&1 || true
  exit 0
}
trap cleanup INT TERM EXIT

echo "MCP Studio 로컬 실행"
free_port "$BACKEND_PORT" "백엔드"
free_port "$ADMIN_PORT" "관리자"

# ── 백엔드 ───────────────────────────────────────────────────
# 기동 시 init_db() + seed() 가 자동으로 돈다. 별도 마이그레이션 명령은 없다.
( cd apps/backend && exec .venv/bin/uvicorn app.main:app --port "$BACKEND_PORT" ) \
  > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

printf "  백엔드 기동"
for _ in $(seq 1 40); do
  if curl -fsS "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
    echo " → http://localhost:$BACKEND_PORT"
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo
    echo "✗ 백엔드가 죽었습니다. 로그: $BACKEND_LOG"
    tail -20 "$BACKEND_LOG"
    exit 1
  fi
  printf "."
  sleep 0.5
done

# ── 관리자 화면 ──────────────────────────────────────────────
# --strictPort 를 준다. 5173 이 막혀 있으면 vite 는 조용히 5174 로 옮겨가는데,
# 확장이 "관리자에서 열기"로 여는 주소는 5173 으로 고정돼 있어 어긋난다.
( cd apps/admin && exec npm run dev -- --port "$ADMIN_PORT" --strictPort ) \
  > "$ADMIN_LOG" 2>&1 &
ADMIN_PID=$!

printf "  관리자 기동"
for _ in $(seq 1 40); do
  if curl -fsS "http://localhost:$ADMIN_PORT/" >/dev/null 2>&1; then
    echo " → http://localhost:$ADMIN_PORT"
    break
  fi
  if ! kill -0 "$ADMIN_PID" 2>/dev/null; then
    echo
    echo "✗ 관리자 화면이 죽었습니다. 로그: $ADMIN_LOG"
    tail -20 "$ADMIN_LOG"
    exit 1
  fi
  printf "."
  sleep 0.5
done

cat <<EOF

  관리자   http://localhost:$ADMIN_PORT
  수집 엔진 http://localhost:$ADMIN_PORT/sources
  백엔드   http://localhost:$BACKEND_PORT
  로그     $BACKEND_LOG
           $ADMIN_LOG

  Ctrl+C 로 둘 다 종료합니다.
EOF

wait

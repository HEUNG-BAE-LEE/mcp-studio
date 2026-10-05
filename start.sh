#!/usr/bin/env bash
# 백엔드(:8000)와 관리자 화면(:5173), 가상조달기관 레거시 4종(:8001~8004)과 레거시 DB(:55432)를 한 번에 띄운다.
# Ctrl+C 한 번으로 모두 내려간다(레거시 DB 컨테이너는 데이터를 남기려고 그대로 둔다).
# 레거시 없이 띄우려면  LEGACY=0 ./start.sh
#
# 이음 게이트웨이(apps/backend/app/ieum)는 백엔드 프로세스에 함께 올라간다. 관리 콘솔
# (apps/web/ieum)도 백엔드가 /ieum/ 에서 정적으로 서빙하므로 따로 띄울 것이 없다.
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
LEGACY="${LEGACY:-1}"
# 이름:포트 — 이음 시연용 값(onboarding_demo.json)이 이 포트를 가리킨다
LEGACY_APPS="ctlg:8001 dhgw:8002 finl:8003 stck:8004"
LEGACY_DB_NAME="pps-legacy-pg"
LEGACY_DB_PORT=55432

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

# requirements.txt 가 바뀐 뒤 pip install 을 건너뛰면 이음(PyYAML, cryptography)을 불러오다
# 백엔드가 죽는다. 뜬 뒤에 로그를 뒤지게 하지 않고 여기서 원인을 보여 준다.
if ! IMPORT_ERR="$(apps/backend/.venv/bin/python -c 'import yaml, cryptography, httpx' 2>&1)"; then
  echo "✗ 백엔드 의존성을 불러오지 못했습니다:"
  echo "$IMPORT_ERR" | tail -3 | sed 's/^/    /'
  echo "  패키지가 없다면:"
  echo "    cd apps/backend && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

if [ "$LEGACY" = 1 ] && ! IMPORT_ERR="$(apps/backend/.venv/bin/python -c 'import psycopg, multipart' 2>&1)"; then
  echo "✗ 레거시 의존성을 불러오지 못했습니다:"
  echo "$IMPORT_ERR" | tail -3 | sed 's/^/    /'
  echo "    apps/backend/.venv/bin/pip install -r apps/legacy-pps/requirements.txt"
  echo "  (레거시 없이 띄우려면  LEGACY=0 ./start.sh)"
  exit 1
fi

if [ ! -f apps/web/ieum/index.html ]; then
  echo "! apps/web/ieum 이 없습니다. 이음 관리 콘솔(/ieum/)은 열리지 않습니다."
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
LEGACY_PIDS=""
cleanup() {
  trap - INT TERM EXIT
  echo
  echo "종료 중..."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$ADMIN_PID" ] && kill "$ADMIN_PID" 2>/dev/null || true
  [ -n "$LEGACY_PIDS" ] && kill $LEGACY_PIDS 2>/dev/null || true
  # vite 는 자식 프로세스를 따로 띄운다. 부모만 죽이면 포트가 물린 채 남는다.
  free_port "$ADMIN_PORT" "관리자" >/dev/null 2>&1 || true
  free_port "$BACKEND_PORT" "백엔드" >/dev/null 2>&1 || true
  if [ "$LEGACY" = 1 ]; then
    for app in $LEGACY_APPS; do free_port "${app#*:}" "${app%%:*}" >/dev/null 2>&1 || true; done
  fi
  exit 0
}
trap cleanup INT TERM EXIT

echo "MCP Studio 로컬 실행"
free_port "$BACKEND_PORT" "백엔드"
free_port "$ADMIN_PORT" "관리자"
if [ "$LEGACY" = 1 ]; then
  for app in $LEGACY_APPS; do free_port "${app#*:}" "레거시 ${app%%:*}"; done
fi

# ── 레거시 DB ────────────────────────────────────────────────
# 포트를 kill 하지 않는다. 55432 를 잡고 있는 건 Docker 프록시라 죽이면 Docker 가 통째로 흔들린다.
# 컨테이너가 있으면 켜기만 하고, 없으면 만들고 적재한다. Docker 가 없으면 DB 소스만 빠진다.
legacy_db() {
  if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    echo "  ! Docker 가 꺼져 있습니다. 레거시 DB(:$LEGACY_DB_PORT) 없이 진행합니다."
    return 0
  fi
  if docker ps --format '{{.Names}}' | grep -qx "$LEGACY_DB_NAME"; then
    echo "  레거시 DB 실행 중 → :$LEGACY_DB_PORT"
    return 0
  fi
  local fresh=0
  if docker ps -a --format '{{.Names}}' | grep -qx "$LEGACY_DB_NAME"; then
    docker start "$LEGACY_DB_NAME" >/dev/null
  else
    docker run -d --name "$LEGACY_DB_NAME" -e POSTGRES_USER=pps -e POSTGRES_PASSWORD=pps -e POSTGRES_DB=pps_legacy \
      -p "127.0.0.1:$LEGACY_DB_PORT:5432" postgres:16-alpine >/dev/null
    fresh=1
  fi
  printf "  레거시 DB 기동"
  for _ in $(seq 1 40); do
    docker exec "$LEGACY_DB_NAME" pg_isready -U pps -d pps_legacy >/dev/null 2>&1 && break
    printf "."
    sleep 0.5
  done
  echo " → :$LEGACY_DB_PORT"
  if [ "$fresh" = 1 ]; then
    apps/backend/.venv/bin/python apps/legacy-pps/db/load.py >/dev/null && echo "  레거시 DB 적재 완료"
  fi
}

# ── 레거시 4종 ───────────────────────────────────────────────
# 이 셸의 자식으로 띄운다. Ctrl+C 때 백엔드와 같이 내려가야 다음 실행에서 포트가 비어 있다.
if [ "$LEGACY" = 1 ]; then
  legacy_db
  for app in $LEGACY_APPS; do
    name="${app%%:*}" port="${app#*:}"
    ( cd apps/legacy-pps && exec ../backend/.venv/bin/uvicorn "legacy_pps.$name.main:app" --host 127.0.0.1 --port "$port" ) \
      > "$LOG_DIR/mcp-studio-legacy-$name.log" 2>&1 &
    LEGACY_PIDS="$LEGACY_PIDS $!"
  done
  printf "  레거시 기동"
  for app in $LEGACY_APPS; do
    for _ in $(seq 1 40); do
      # 루트 경로가 없어 404 가 정상이다. 응답이 오기만 하면 된다(-f 를 주지 않는다)
      curl -sS -o /dev/null "http://127.0.0.1:${app#*:}/" 2>/dev/null && break
      sleep 0.25
    done
    printf " %s" "${app%%:*}"
  done
  echo " → :8001~8004"
fi

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
  이음 콘솔 http://localhost:$BACKEND_PORT/ieum/
  레거시   http://127.0.0.1:8001~8004  (LEGACY=0 이면 띄우지 않음)
  로그     $BACKEND_LOG
           $ADMIN_LOG
           $LOG_DIR/mcp-studio-legacy-*.log

  Ctrl+C 로 모두 종료합니다(레거시 DB 컨테이너는 남깁니다).
EOF

wait

#!/usr/bin/env bash
# 가상조달기관 레거시 4종을 백그라운드로 띄운다. PYTHON 으로 인터프리터를 바꿀 수 있다.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="${PYTHON:-$HERE/../backend/.venv/bin/python}"
PID_DIR="$HERE/.pids"; mkdir -p "$PID_DIR"
start() {
  local name="$1" port="$2" pid_file="$PID_DIR/$1.pid"
  if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then echo "[skip]  $name 실행 중"; return; fi
  # & 는 nohup 한 명령에만 건다. `cd && nohup … &` 로 묶으면 $! 가 서브셸 PID 라 stop_all 이 python 을 못 죽인다
  (cd "$HERE"; nohup "$PY" -m uvicorn "legacy_pps.$name.main:app" --host "${HOST:-127.0.0.1}" --port "$port" > "$PID_DIR/$name.log" 2>&1 & echo $! > "$pid_file")
  echo "[start] $name :$port"
}
start ctlg 18001; start dhgw 18002; start finl 18003; start stck 18004

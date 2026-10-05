#!/usr/bin/env bash
# 가상조달기관 레거시 4종을 백그라운드로 띄운다. PYTHON 으로 인터프리터를 바꿀 수 있다.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="${PYTHON:-$HERE/../backend/.venv/bin/python}"
PID_DIR="$HERE/.pids"; mkdir -p "$PID_DIR"
start() {
  local name="$1" port="$2" pid_file="$PID_DIR/$1.pid"
  if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then echo "[skip]  $name 실행 중"; return; fi
  (cd "$HERE" && nohup "$PY" -m uvicorn "legacy_pps.$name.main:app" --host "${HOST:-127.0.0.1}" --port "$port" > "$PID_DIR/$name.log" 2>&1 & echo $! > "$pid_file")
  echo "[start] $name :$port"
}
start ctlg 8001; start dhgw 8002; start finl 8003; start stck 8004

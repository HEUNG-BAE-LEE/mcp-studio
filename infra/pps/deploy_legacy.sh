#!/usr/bin/env bash
# =============================================================================
# deploy_legacy.sh — 가상조달기관 레거시(apps/legacy-pps)를 레거시 VM 에 반입한다
#
# 레거시 VM 은 공인 IP 가 없다. 파일은 az vm run-command(관리 채널)로만 들어간다 —
# 망분리 기관의 "관리 채널을 통한 소프트웨어 반입" 절차와 같은 모양이다.
#
# 순서: terraform apply(internet_lockdown=false) → 이 스크립트 → terraform apply(internet_lockdown=true)
# 기본값을 두지 않는다. 다른 서비스의 스크립트를 그대로 쓰다 엉뚱한 리소스 그룹으로 들어가는 사고를 막기 위해서다.
#
#   ./deploy_legacy.sh --rg <리소스그룹> --vm <VM 이름> --kv <Key Vault 이름> --pg <PG FQDN>
# =============================================================================
set -euo pipefail

RG= VM= KV= PG=
while [ $# -gt 0 ]; do
  case "$1" in
    --rg) RG="$2"; shift 2 ;;
    --vm) VM="$2"; shift 2 ;;
    --kv) KV="$2"; shift 2 ;;
    --pg) PG="$2"; shift 2 ;;
    *) echo "알 수 없는 인자: $1" >&2; exit 2 ;;
  esac
done
[ -n "$RG" ] && [ -n "$VM" ] && [ -n "$KV" ] && [ -n "$PG" ] || { echo "--rg --vm --kv --pg 를 모두 지정할 것" >&2; exit 2; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$HERE/../../apps/legacy-pps"

echo "[1/3] 비밀값 읽기 (Key Vault: $KV)"
ADMIN_PW="$(az keyvault secret show --vault-name "$KV" -n pps-legacy-pg-password --query value -o tsv)"
READER_PW="$(az keyvault secret show --vault-name "$KV" -n pps-legacy-pg-reader-password --query value -o tsv)"

echo "[2/3] apps/legacy-pps 묶기"
TARBALL="$(mktemp -t legacy-pps-XXXXXX).tar.gz"
tar czf "$TARBALL" -C "$SRC/.." --exclude='.pids' --exclude='__pycache__' legacy-pps
B64="$(base64 -i "$TARBALL" | tr -d '\n')"; rm -f "$TARBALL"
KB=$(( ${#B64} / 1024 )); echo "      묶음 크기(base64) ${KB}KB"
[ "$KB" -lt 240 ] || { echo "run-command 한도(약 256KB)에 가깝다. Storage 반입으로 바꿀 것" >&2; exit 1; }

echo "[3/3] VM 안에서 설치·DB 적재·서비스 등록 (수 분)"
REMOTE=$(cat <<'EOS'
set -e
echo "$1" | base64 -d > /tmp/lp.tgz
rm -rf /opt/legacy-pps && mkdir -p /opt && tar xzf /tmp/lp.tgz -C /opt && rm -f /tmp/lp.tgz
cd /opt/legacy-pps
python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt
PGPASSWORD="$2" PPS_LEGACY_DSN="postgresql://ppsadmin@$4:5432/pps_legacy?sslmode=require" .venv/bin/python db/load.py
# 이음이 쓰는 계정은 읽기 전용 역할 — 관리자 계정은 이음에 주지 않는다
PGPASSWORD="$2" psql "host=$4 dbname=pps_legacy user=ppsadmin sslmode=require" -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pps_reader') THEN CREATE ROLE pps_reader LOGIN; END IF;
END \$\$;
ALTER ROLE pps_reader PASSWORD '$3';
ALTER ROLE pps_reader SET default_transaction_read_only = on;
GRANT CONNECT ON DATABASE pps_legacy TO pps_reader;
GRANT USAGE ON SCHEMA public TO pps_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO pps_reader;
SQL
chown -R legacy:legacy /opt/legacy-pps
cp deploy/*.service /etc/systemd/system/
systemctl daemon-reload
for s in ctlg dhgw finl stck; do systemctl enable --now "$s"; systemctl restart "$s"; done
sleep 2; for p in 18001 18002 18003 18004; do curl -s -o /dev/null -w "port $p → %{http_code}\n" "http://127.0.0.1:$p/" || true; done
EOS
)
az vm run-command invoke -g "$RG" -n "$VM" --command-id RunShellScript \
  --scripts "$REMOTE" --parameters "$B64" "$ADMIN_PW" "$READER_PW" "$PG" --query "value[0].message" -o tsv
echo "완료. 밀봉: terraform apply -var internet_lockdown=true"

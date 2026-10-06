#!/usr/bin/env bash
# 레거시 4종의 시대별 인증 동작과 매설 결함을 확인한다. 실패가 하나라도 있으면 종료코드 1.
set -u
B="${BASE_HOST:-127.0.0.1}"; FAILS=0
ok() { echo "PASS  $1"; }; ng() { echo "FAIL  $1"; FAILS=$((FAILS+1)); }

# CTLG — 2009년식: 세션 없으면 401 이 아니라 200 + text/html
r="$(curl -s -i "http://$B:18001/ctlg/clsfc/selectPrdctClsfcList.do")"
echo "$r" | head -1 | grep -q " 200" && echo "$r" | grep -qi "content-type: text/html" && echo "$r" | grep -q "세션이 만료" \
  && ok "CTLG 비로그인 → 200 text/html 세션만료" || ng "CTLG 비로그인 응답"
j="$(mktemp)"
curl -s -c "$j" -X POST "http://$B:18001/ctlg/actionLogin.do" -d userId=bad -d password=bad | grep -q '"resultCode":"9001"' \
  && ok "CTLG 로그인 실패도 200 + resultCode 9001" || ng "CTLG 로그인 실패 코드"
curl -s -c "$j" -X POST "http://$B:18001/ctlg/actionLogin.do" -d userId="${CTLG_USER:-ctlgsvc}" -d password="${CTLG_PW:-ctlg2009!}" >/dev/null
curl -s -b "$j" "http://$B:18001/ctlg/clsfc/selectPrdctClsfcList.do?PRDCT_CLSFC_NO=5610" | grep -q '"DTL_PRDCT_CLSFC_NO":"5610150401"' \
  && ok "CTLG 세션 로그인 후 물품분류 조회" || ng "CTLG 업무 조회"
curl -s "http://$B:18001/ctlg/v2/api-docs" | grep -q '"swagger": "2.0"' && ok "CTLG Swagger 2.0 명세" || ng "CTLG 명세"

# DHGW — 신형: OAuth2, 공개 오픈API 규격
P="/dhgw/ad/BidPublicInfoService/getBidPblancListInfoThng"
s="$(curl -s -o /dev/null -w '%{http_code}' "http://$B:18002$P")"; [ "$s" = 401 ] && ok "DHGW 토큰 없음 → 401" || ng "DHGW 무인증 $s"
t="$(curl -s -X POST "http://$B:18002/oauth2/token" -d grant_type=client_credentials -d client_id="${DHGW_CLIENT_ID:-dhgw-ieum}" -d client_secret="${DHGW_CLIENT_SECRET:-dhgw-secret-26}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')"
h="$(curl -s -i -H "Authorization: Bearer $t" "http://$B:18002$P?inqryDiv=1&inqryBgnDt=202609150000&inqryEndDt=202610042359&pageNo=1&numOfRows=3")"
echo "$h" | grep -qi "x-ratelimit-remaining" && echo "$h" | grep -q '"resultCode":"00"' && echo "$h" | grep -Eq '"bidNtceNo":"R26BK[0-9]{8}"' \
  && ok "DHGW 입찰공고 조회 (봉투·번호형식·RateLimit)" || ng "DHGW 입찰공고"
curl -s -H "Authorization: Bearer $t" "http://$B:18002$P?inqryDiv=1&inqryBgnDt=202606010000&inqryEndDt=202610042359&pageNo=1&numOfRows=3" | grep -q '"resultCode":"07"' \
  && ok "DHGW 조회기간 1개월 초과 → 07" || ng "DHGW 07"
curl -s -H "Authorization: Bearer $t" "http://$B:18002$P?inqryDiv=1&inqryBgnDt=2026-09-01&inqryEndDt=202610042359&pageNo=1&numOfRows=3" | grep -q '"resultCode":"06"' \
  && ok "DHGW 날짜 형식 오류 → 06" || ng "DHGW 06"
curl -s -H "Authorization: Bearer $t" "http://$B:18002/dhgw/ao/CntrctInfoService/getCntrctInfoListThng?inqryDiv=1&inqryBgnDt=202609150000&inqryEndDt=202610042359&pageNo=1&numOfRows=1" | grep -Eq '"dcsnCntrctNo":"R26TA[0-9]{10}"' \
  && ok "DHGW 계약 확정계약번호 15자리" || ng "DHGW 계약번호"

# FINL — 2015년식: X-API-KEY, 명세 없음, 정의서와 다른 응답
s="$(curl -s -o /dev/null -w '%{http_code}' -H 'X-API-KEY: wrong' "http://$B:18003/finl/pymnt/selectPymntList")"; [ "$s" = 403 ] && ok "FINL 키 틀림 → 403" || ng "FINL 403 $s"
K="${FINL_API_KEY:-FINL-KEY-2015}"
no="$(curl -s -H "X-API-KEY: $K" "http://$B:18003/finl/pymnt/selectPymntList" | python3 -c 'import sys,json;print(json.load(sys.stdin)["DATA"][0]["PYMNT_REQ_NO"])')"
r="$(curl -s -H "X-API-KEY: $K" "http://$B:18003/finl/pymnt/selectPymntSttus?PYMNT_REQ_NO=$no")"
echo "$r" | grep -q '"RESULT_CODE":"S"' && ! echo "$r" | grep -q ACNT_DIV_CD && echo "$r" | grep -Eq '"REQ_AMT":"[0-9,]+"' \
  && ok "FINL 대금 상태 — ACNT_DIV_CD 없음(매설 결함), 금액 쉼표" || ng "FINL 매설 결함"
s="$(curl -s -o /dev/null -w '%{http_code}' "http://$B:18003/openapi.json")"; [ "$s" = 404 ] && ok "FINL 기계가독 명세 없음" || ng "FINL 명세 노출 $s"

# STCK — SOAP + WS-Security
W="$(curl -s "http://$B:18004/stck/StockService?wsdl")"; echo "$W" | grep -q "GetStockpileInventory" && ok "STCK WSDL" || ng "STCK WSDL"
env='<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://stck.virtual-pps.local/ws"><soapenv:Header>%s</soapenv:Header><soapenv:Body><ws:GetStockpileInventory><ws:ITEM_CD>CU</ws:ITEM_CD></ws:GetStockpileInventory></soapenv:Body></soapenv:Envelope>'
sec='<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"><wsse:UsernameToken><wsse:Username>stckws</wsse:Username><wsse:Password>stck-ws-01</wsse:Password></wsse:UsernameToken></wsse:Security>'
curl -s -X POST "http://$B:18004/stck/StockService" -H 'Content-Type: text/xml' --data "$(printf "$env" "")" | grep -q FailedAuthentication && ok "STCK 토큰 없음 → Fault" || ng "STCK 무인증"
curl -s -X POST "http://$B:18004/stck/StockService" -H 'Content-Type: text/xml' --data "$(printf "$env" "$sec")" | grep -q "<ws:ITEM_NM>구리</ws:ITEM_NM>" && ok "STCK 구리 재고 조회" || ng "STCK 조회"

curl -s -i "http://$B:18003/finl/pymnt/selectPymntList" -H "X-API-KEY: $K" | grep -qi "x-demo-system: virtual" && ok "가상 시스템 표시 헤더" || ng "가상 표시 헤더"
echo "---- 실패 $FAILS 건"; [ "$FAILS" = 0 ]

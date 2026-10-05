"""STCK 비축물자 재고 — 가상 레거시 (SOAP 1.1, port 8004).

시연용 가상 시스템이다. 조달청 원자재 비축 사업의 품목군(비철금속)만 빌렸고, 재고량과 기지 이름은 지어낸 것이다.
인증은 WS-Security UsernameToken. 문서는 WSDL 하나 (/stck/StockService?wsdl).
"""
import os
import xml.etree.ElementTree as ET

from fastapi import FastAPI, Request
from fastapi.responses import Response

from legacy_pps.common.routes import VIRTUAL
from legacy_pps.common.seed import DATA

USER = os.environ.get("STCK_USER", "stckws")
PW = os.environ.get("STCK_PW", "stck-ws-01")
NS = "http://stck.virtual-pps.local/ws"
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

_IN = {"GetStockpileInventory": ["ITEM_CD"], "GetReleaseHistory": ["ITEM_CD"]}
_OUT = {
    "GetStockpileInventory": [("ITEM_CD", "string"), ("ITEM_NM", "string"), ("TOT_STOCK_QTY", "decimal"), ("UNIT_NM", "string"),
                              ("SITE_CNT", "int"), ("BASE_YMD", "string")],
    "GetReleaseHistory": [("ITEM_CD", "string"), ("ITEM_NM", "string"), ("LAST_RELS_NO", "string"), ("LAST_RELS_YMD", "string"),
                          ("LAST_RELS_QTY", "decimal"), ("RELS_CNT_90D", "int")],
}


def _wsdl(loc):
    el = lambda n, fs: ('<xsd:element name="%s"><xsd:complexType><xsd:sequence>%s</xsd:sequence></xsd:complexType></xsd:element>'
                        % (n, "".join('<xsd:element name="%s" type="xsd:%s"/>' % f for f in fs)))
    types = "".join(el(op, [(f, "string") for f in fs]) + el(op + "Response", _OUT[op]) for op, fs in _IN.items())
    msgs = "".join('<wsdl:message name="%sIn"><wsdl:part name="p" element="tns:%s"/></wsdl:message>'
                   '<wsdl:message name="%sOut"><wsdl:part name="p" element="tns:%sResponse"/></wsdl:message>' % (o, o, o, o) for o in _IN)
    pt = "".join('<wsdl:operation name="%s"><wsdl:input message="tns:%sIn"/><wsdl:output message="tns:%sOut"/></wsdl:operation>' % (o, o, o) for o in _IN)
    bd = "".join('<wsdl:operation name="%s"><soap:operation soapAction="urn:%s"/></wsdl:operation>' % (o, o) for o in _IN)
    return ('<?xml version="1.0" encoding="UTF-8"?>'
            '<wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" '
            'xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:tns="%s" targetNamespace="%s" name="StockService">'
            '<wsdl:documentation>STCK 비축물자 재고 (시연용 가상 시스템)</wsdl:documentation>'
            '<wsdl:types><xsd:schema targetNamespace="%s" elementFormDefault="qualified">%s</xsd:schema></wsdl:types>%s'
            '<wsdl:portType name="StockPort">%s</wsdl:portType>'
            '<wsdl:binding name="StockBinding" type="tns:StockPort"><soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>%s</wsdl:binding>'
            '<wsdl:service name="StockService"><wsdl:port name="StockPort" binding="tns:StockBinding"><soap:address location="%s"/></wsdl:port></wsdl:service>'
            '</wsdl:definitions>' % (NS, NS, NS, types, msgs, pt, bd, loc))


@app.get("/stck/StockService")
def wsdl(request: Request):
    if "wsdl" not in {k.lower() for k in request.query_params}:
        return Response("WSDL 은 ?wsdl 로 요청하십시오.", media_type="text/plain; charset=utf-8", headers=VIRTUAL)
    loc = str(request.base_url).rstrip("/") + "/stck/StockService"
    return Response(_wsdl(loc), media_type="text/xml; charset=utf-8", headers=VIRTUAL)


def _fault(code, msg):
    xml = ('<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><soapenv:Fault>'
           '<faultcode>%s</faultcode><faultstring>%s</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>' % (code, msg))
    return Response(xml, status_code=500, media_type="text/xml; charset=utf-8", headers=VIRTUAL)


def _text(root, name):
    return next((e.text for e in root.iter() if e.tag.split("}")[-1] == name), None)


@app.post("/stck/StockService")
async def call(request: Request):
    try:
        root = ET.fromstring(await request.body())
    except ET.ParseError:
        return _fault("soapenv:Client", "SOAP 메시지를 해석할 수 없습니다.")
    if _text(root, "Username") != USER or _text(root, "Password") != PW:
        return _fault("wsse:FailedAuthentication", "보안 토큰을 확인할 수 없습니다.")
    op = next((o for o in _IN if any(e.tag.split("}")[-1] == o for e in root.iter())), None)
    if not op:
        return _fault("soapenv:Client", "지원하지 않는 오퍼레이션입니다.")
    item = (_text(root, "ITEM_CD") or "").strip().upper()
    rows = [s for s in DATA["stock"] if s["item_cd"] == item]
    if not rows:
        return _fault("soapenv:Client", "품목코드를 찾을 수 없습니다: %s" % item)
    if op == "GetStockpileInventory":
        vals = [item, rows[0]["item_nm"], "%.1f" % sum(r["stock_qty"] for r in rows), rows[0]["unit"], str(len(rows)), rows[0]["base_ymd"]]
    else:
        rel = sorted([r for r in DATA["release"] if r["item_cd"] == item], key=lambda r: r["rels_ymd"], reverse=True)
        last = rel[0] if rel else {"rels_no": "", "rels_ymd": "", "rels_qty": 0}
        recent = [r for r in rel if r["rels_ymd"] >= "20260707"]
        vals = [item, rows[0]["item_nm"], last["rels_no"], last["rels_ymd"], "%.1f" % last["rels_qty"], str(len(recent))]
    body = "".join("<ws:%s>%s</ws:%s>" % (f[0], v, f[0]) for f, v in zip(_OUT[op], vals))
    xml = ('<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body>'
           '<ws:%sResponse xmlns:ws="%s">%s</ws:%sResponse></soapenv:Body></soapenv:Envelope>' % (op, NS, body, op))
    return Response(xml, media_type="text/xml; charset=utf-8", headers=VIRTUAL)

"""이음에 연결해 볼 수 있는 시연용 원본 시스템 (레거시 인사 시스템 흉내). 인증: X-API-KEY: demo-key"""
import json
import xml.etree.ElementTree as ET
from typing import Optional

from fastapi import APIRouter, Header, Query, Request
from fastapi.responses import JSONResponse, Response

router = APIRouter(prefix="/demo-origin", tags=["ieum-demo-origin"])

API_KEY = "demo-key"
EMPLOYEES = {
    "20190412": {"EMP_NO": "20190412", "EMP_NM": "홍길동", "DEPT_CD": "D1030", "DEPT_NM": "인사팀", "MBL_TELNO": "010-4821-5678", "EML_ADDR": "gildong.hong@hanbit.local", "JNCMP_YMD": "20190412"},
    "20210803": {"EMP_NO": "20210803", "EMP_NM": "이서연", "DEPT_CD": "D2010", "DEPT_NM": "영업1팀", "MBL_TELNO": "010-7312-9984", "EML_ADDR": "seoyeon.lee@hanbit.local", "JNCMP_YMD": "20210803"},
    "20230110": {"EMP_NO": "20230110", "EMP_NM": "박지훈", "DEPT_CD": "D4010", "DEPT_NM": "구매팀", "MBL_TELNO": "010-5566-1203", "EML_ADDR": "jihun.park@hanbit.local", "JNCMP_YMD": "20230110"},
}
VACATIONS = {"20190412": {"tot": 15.0, "use": 9.5}, "20210803": {"tot": 15.0, "use": 3.0}, "20230110": {"tot": 11.0, "use": 0.0}}
REQUESTS = []

OPENAPI = {
    "openapi": "3.0.3",
    "info": {"title": "시연용 인사 시스템", "description": "레거시 형식(대문자 필드, YYYYMMDD 날짜, 문자열 숫자)을 흉내 낸 시연용 API"},
    "servers": [{"url": "/demo-origin"}],
    "paths": {
        "/employees": {"get": {
            "operationId": "searchEmployee", "summary": "직원 검색", "description": "이름이나 부서코드로 직원을 검색해 사번, 부서, 연락처를 알려줍니다.",
            "parameters": [
                {"name": "SRCH_NM", "in": "query", "description": "이름 전체 또는 일부", "schema": {"type": "string", "example": "홍길동"}},
                {"name": "DEPT_CD", "in": "query", "description": "부서코드", "schema": {"type": "string", "enum": ["D1030", "D2010", "D4010"]}}],
            "responses": {"200": {"description": "ok", "content": {"application/json": {"schema": {"type": "object", "properties": {
                "list": {"type": "array", "items": {"type": "object", "properties": {
                    "EMP_NO": {"type": "string", "example": "20190412"}, "EMP_NM": {"type": "string", "example": "홍길동"},
                    "DEPT_NM": {"type": "string", "example": "인사팀"}, "MBL_TELNO": {"type": "string", "example": "010-4821-5678"},
                    "EML_ADDR": {"type": "string", "example": "gildong.hong@hanbit.local"}}}}}}}}}}}},
        "/vacation/{EMP_NO}": {"get": {
            "operationId": "getVacationBalance", "summary": "연차 잔여일수 조회", "description": "직원의 올해 연차 총일수, 사용일수, 남은 일수를 조회합니다.",
            "parameters": [
                {"name": "EMP_NO", "in": "path", "required": True, "description": "사번 8자리", "schema": {"type": "string", "example": "20190412"}},
                {"name": "BASE_YMD", "in": "query", "description": "기준일 (YYYYMMDD). 비우면 오늘", "schema": {"type": "string", "example": "20261001"}}],
            "responses": {"200": {"description": "ok", "content": {"application/json": {"schema": {"type": "object", "properties": {
                "EMP_NM": {"type": "string", "example": "홍길동"}, "ANNUAL_TOT_CNT": {"type": "string", "example": "15.0"},
                "ANNUAL_USE_CNT": {"type": "string", "example": "9.5"}, "ANNUAL_REM_CNT": {"type": "string", "example": "5.5"},
                "EXPIRE_YMD": {"type": "string", "example": "20261231"}}}}}}}}},
        "/vacation": {"post": {
            "operationId": "requestVacation", "summary": "연차 신청", "description": "직원 대신 연차를 신청합니다. 실제 결재 문서가 만들어지므로 사용자 확인이 필요합니다.",
            "requestBody": {"required": True, "content": {"application/json": {"schema": {"type": "object", "required": ["EMP_NO", "STRT_YMD", "END_YMD"], "properties": {
                "EMP_NO": {"type": "string", "description": "사번 8자리", "example": "20190412"},
                "VAC_TP_CD": {"type": "string", "description": "휴가 종류", "enum": ["01", "02", "03"]},
                "STRT_YMD": {"type": "string", "description": "시작일", "example": "20261008"},
                "END_YMD": {"type": "string", "description": "종료일", "example": "20261008"}}}}}},
            "responses": {"200": {"description": "ok", "content": {"application/json": {"schema": {"type": "object", "properties": {
                "RSLT_CD": {"type": "string", "example": "0000"}, "APPR_DOC_NO": {"type": "string", "example": "HR-2026-10-0412"}}}}}}}}},
    },
}


def _denied():
    return JSONResponse({"RSLT_CD": "E401", "MSG": "X-API-KEY 가 올바르지 않습니다."}, status_code=401)


@router.get("/openapi.json")
def openapi():
    return OPENAPI


@router.get("/employees")
def employees(nm: str = Query("", alias="SRCH_NM"), dept: str = Query("", alias="DEPT_CD"), x_api_key: Optional[str] = Header(None)):
    if x_api_key != API_KEY:
        return _denied()
    rows = [e for e in EMPLOYEES.values() if nm in e["EMP_NM"] and (not dept or e["DEPT_CD"] == dept)]
    return {"RSLT_CD": "0000", "list": rows}


@router.get("/vacation/{emp_no}")
def vacation(emp_no: str, x_api_key: Optional[str] = Header(None)):
    if x_api_key != API_KEY:
        return _denied()
    e, v = EMPLOYEES.get(emp_no), VACATIONS.get(emp_no)
    if not e:
        return JSONResponse({"RSLT_CD": "E404", "MSG": "사번을 찾을 수 없습니다."}, status_code=404)
    return {"EMP_NM": e["EMP_NM"], "ANNUAL_TOT_CNT": "%.1f" % v["tot"], "ANNUAL_USE_CNT": "%.1f" % v["use"],
            "ANNUAL_REM_CNT": "%.1f" % (v["tot"] - v["use"]), "EXPIRE_YMD": "20261231"}


@router.post("/vacation")
async def vacation_request(request: Request, x_api_key: Optional[str] = Header(None)):
    if x_api_key != API_KEY:
        return _denied()
    try:
        b = json.loads(await request.body() or "{}")
    except ValueError:
        return JSONResponse({"RSLT_CD": "E400"}, status_code=400)
    if not isinstance(b, dict) or b.get("EMP_NO") not in EMPLOYEES:
        return JSONResponse({"RSLT_CD": "E404", "MSG": "사번을 찾을 수 없습니다."}, status_code=404)
    REQUESTS.append(b)
    return {"RSLT_CD": "0000", "APPR_DOC_NO": "HR-2026-10-%04d" % (len(REQUESTS) + 411)}


# ---- SOAP
NS = "http://hr.demo.local/ws"
WSDL = '''<?xml version="1.0" encoding="UTF-8"?>
<wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:tns="%(ns)s" targetNamespace="%(ns)s" name="HrService">
  <wsdl:types><xsd:schema targetNamespace="%(ns)s" elementFormDefault="qualified">
    <xsd:element name="GetEmpInfo"><xsd:complexType><xsd:sequence><xsd:element name="EMP_NO" type="xsd:string"/></xsd:sequence></xsd:complexType></xsd:element>
    <xsd:element name="GetEmpInfoResponse"><xsd:complexType><xsd:sequence>
      <xsd:element name="EMP_NM" type="xsd:string"/><xsd:element name="DEPT_NM" type="xsd:string"/><xsd:element name="JNCMP_YMD" type="xsd:string"/>
    </xsd:sequence></xsd:complexType></xsd:element>
  </xsd:schema></wsdl:types>
  <wsdl:message name="GetEmpInfoIn"><wsdl:part name="p" element="tns:GetEmpInfo"/></wsdl:message>
  <wsdl:message name="GetEmpInfoOut"><wsdl:part name="p" element="tns:GetEmpInfoResponse"/></wsdl:message>
  <wsdl:portType name="HrPort"><wsdl:operation name="GetEmpInfo"><wsdl:input message="tns:GetEmpInfoIn"/><wsdl:output message="tns:GetEmpInfoOut"/></wsdl:operation></wsdl:portType>
  <wsdl:binding name="HrBinding" type="tns:HrPort"><soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <wsdl:operation name="GetEmpInfo"><soap:operation soapAction="urn:GetEmpInfo"/></wsdl:operation></wsdl:binding>
  <wsdl:service name="HrService"><wsdl:port name="HrPort" binding="tns:HrBinding"><soap:address location="%(loc)s"/></wsdl:port></wsdl:service>
</wsdl:definitions>'''


@router.get("/hr.wsdl")
def wsdl(request: Request):
    loc = str(request.base_url).rstrip("/") + "/demo-origin/soap"
    return Response(WSDL % {"ns": NS, "loc": loc}, media_type="text/xml; charset=utf-8")


@router.post("/soap")
async def soap(request: Request):
    try:
        root = ET.fromstring(await request.body())
        emp = next((e.text for e in root.iter() if e.tag.endswith("}EMP_NO") or e.tag == "EMP_NO"), None)
    except ET.ParseError:
        return Response(status_code=400)
    e = EMPLOYEES.get((emp or "").strip())
    if not e:
        body = "<soapenv:Fault><faultcode>Client</faultcode><faultstring>사번을 찾을 수 없습니다</faultstring></soapenv:Fault>"
    else:
        body = ('<ws:GetEmpInfoResponse xmlns:ws="%s"><ws:EMP_NM>%s</ws:EMP_NM><ws:DEPT_NM>%s</ws:DEPT_NM><ws:JNCMP_YMD>%s</ws:JNCMP_YMD></ws:GetEmpInfoResponse>'
                % (NS, e["EMP_NM"], e["DEPT_NM"], e["JNCMP_YMD"]))
    xml = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body>%s</soapenv:Body></soapenv:Envelope>' % body
    return Response(xml, media_type="text/xml; charset=utf-8", status_code=500 if not e else 200)

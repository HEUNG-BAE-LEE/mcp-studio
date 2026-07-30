"""문서 기반 수집 — 활용가이드 파일에서 API 명세를 뽑는다.

포털에 게시되지도, 화면에서 실행되지도 않는 API 가 있다. 기관이 문서로만 배포한
경우다. 이때 남는 방법은 그 문서를 읽는 것뿐이다.

LLM 에게 문서 전체를 던지고 구조를 받는다. 규칙 기반 파싱은 문서 서식이
제각각이라(표·글머리표·본문 서술) 곧 무너진다. 대신 **LLM 이 지어낸 값을 그대로
믿지 않는다** — 뽑은 결과는 화면에서 사람이 확인한 뒤 액션이 된다.
"""

import json
import os
import re
from dataclasses import dataclass, field
from typing import Optional

from urllib.parse import urlsplit

from openai import AzureOpenAI

# 문서에서 뽑을 수 있는 최대 분량. 너무 긴 문서는 앞부분만 본다 —
# 활용가이드는 앞쪽에 엔드포인트와 요청/응답 표가 오는 것이 보통이다.
MAX_CHARS = 24000

SYSTEM = """너는 공공 API 활용가이드 문서에서 API 명세를 추출하는 도구다.

규칙:
1. 문서에 **적혀 있는 것만** 쓴다. 엔드포인트·파라미터를 추측해 만들지 마라.
2. 엔드포인트가 문서에 없으면 그 오퍼레이션은 아예 넣지 마라.
3. 한글 항목명은 description 에, 영문 항목명은 name 에 넣는다.
4. 필수 여부가 '필수/필/Y' 로 적혀 있으면 required=true.
5. 샘플값이 있으면 example 에 넣는다. 없으면 null.
6. 확신이 없는 항목은 warnings 에 이유를 적는다.

출력은 JSON 만. 설명문·코드펜스를 붙이지 마라.
{
  "serviceName": "서비스명",
  "provider": "제공기관",
  "operations": [
    {
      "opName": "영문 오퍼레이션명",
      "summary": "한 줄 설명",
      "method": "GET",
      "baseUrl": "http://...",
      "path": "/...",
      "params": [
        {"name":"serviceKey","type":"string","required":true,"description":"인증키","example":null}
      ],
      "warnings": ["확신이 없는 부분"]
    }
  ]
}"""


@dataclass
class DocResult:
    service_name: str = ""
    provider: str = ""
    operations: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    extracted_chars: int = 0


def extract_text(filename: str, data: bytes) -> tuple:
    """파일에서 텍스트를 뽑는다. (텍스트, 안내문) 을 돌려준다.

    PDF 는 pypdf 가 있으면 쓴다. 없거나 스캔 이미지라 글자가 안 나오면 그 사실을
    돌려준다 — 빈 문자열을 조용히 LLM 에 넘기면 모델이 그럴듯한 명세를 지어낸다.
    """
    lower = filename.lower()

    if lower.endswith((".txt", ".md", ".json", ".yaml", ".yml", ".csv", ".html", ".htm")):
        text = data.decode("utf-8", errors="replace")
        if lower.endswith((".html", ".htm")):
            text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", text, flags=re.S | re.I)
            text = re.sub(r"<[^>]+>", " ", text)
        return re.sub(r"[ \t]+", " ", text), None

    if lower.endswith(".pdf"):
        try:
            import io

            from pypdf import PdfReader
        except ImportError:
            return "", "PDF 를 읽는 도구(pypdf)가 설치되지 않았습니다. 텍스트·HWP 변환 파일을 올려 주세요"
        try:
            reader = PdfReader(io.BytesIO(data))
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as exc:  # noqa: BLE001
            return "", f"PDF 를 읽지 못했습니다 ({exc.__class__.__name__})"
        if len(text.strip()) < 80:
            return "", "PDF 에서 글자를 찾지 못했습니다. 스캔 이미지 문서라면 텍스트 문서로 변환해 주세요"
        return text, None

    if lower.endswith((".hwp", ".hwpx")):
        # HWP 는 바이너리 포맷이라 별도 변환기가 필요하다. 지금은 정직하게 막는다 —
        # 억지로 읽어 깨진 글자를 LLM 에 넘기면 없는 명세가 만들어진다.
        return "", "HWP 는 아직 직접 읽지 못합니다. PDF 또는 텍스트로 저장해 올려 주세요"

    if lower.endswith((".doc", ".docx")):
        try:
            import io
            import zipfile

            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                xml = archive.read("word/document.xml").decode("utf-8", errors="replace")
            text = re.sub(r"<[^>]+>", " ", xml)
            return re.sub(r"[ \t]+", " ", text), None
        except Exception:  # noqa: BLE001
            return "", "워드 문서를 읽지 못했습니다. PDF 또는 텍스트로 변환해 주세요"

    return "", f"지원하지 않는 형식입니다 ({filename.rsplit('.', 1)[-1]})"


def _client() -> Optional[AzureOpenAI]:
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    key = os.environ.get("AZURE_OPENAI_API_KEY")
    version = os.environ.get("AZURE_OPENAI_API_VERSION")
    if not (endpoint and key and version):
        return None
    return AzureOpenAI(azure_endpoint=endpoint, api_key=key, api_version=version)


def _parse(raw: str) -> dict:
    text = re.sub(r"^```(?:json)?|```$", "", (raw or "").strip(), flags=re.M).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}


# ── 규칙 기반 폴백 ───────────────────────────────────────────
#
# 공공 활용가이드는 상당수가 포털 상세페이지와 같은 표 서식을 쓴다.
#   요청주소: http://...
#   항목명(국문) | 항목명(영문) | 항목크기 | 항목구분 | 샘플데이터 | 항목설명
# 이 패턴이면 LLM 없이도 읽을 수 있다. LLM 을 못 쓰는 환경에서 아무것도 못
# 하는 것보다, 확실한 패턴만이라도 읽어 주는 편이 낫다.

_ENDPOINT_RE = re.compile(r"(?:요청\s*주소|End\s*Point|엔드포인트|요청\s*URL)\s*[:：]?\s*(https?://\S+)", re.I)
_REQUIRED_TOKENS = {"필", "필수", "y", "yes", "o", "필수항목"}
_EMPTY = {"", "-", "–", "—", "없음"}


def _rule_based(text: str, filename: str) -> DocResult:
    endpoints = _ENDPOINT_RE.findall(text)
    if not endpoints:
        return DocResult()

    service_name = ""
    m = re.search(r"서비스\s*명\s*[:：]\s*(.+)", text)
    if m:
        service_name = m.group(1).strip().splitlines()[0][:80]
    provider = ""
    m = re.search(r"제공\s*기관\s*[:：]\s*(.+)", text)
    if m:
        provider = m.group(1).strip().splitlines()[0][:40]

    # 파이프로 구분된 표만 읽는다. 공백 정렬 표는 열 경계를 신뢰할 수 없어
    # 잘못 읽는 대신 LLM 에 맡긴다.
    params = []
    for line in text.splitlines():
        if "|" not in line:
            continue
        cells = [c.strip() for c in line.split("|")]
        if len(cells) < 4 or "항목명" in line:
            continue
        ko, en, size, kind = cells[0], cells[1], cells[2], cells[3]
        name = re.sub(r"[^A-Za-z0-9_\-]", "", en)
        if not name:
            continue
        sample = cells[4] if len(cells) > 4 else ""
        desc = cells[5] if len(cells) > 5 else ""
        params.append({
            "name": name,
            "type": "integer" if re.fullmatch(r"\d{1,6}", sample.strip()) and len(sample.strip()) < 8 else "string",
            "required": kind.strip().lower() in _REQUIRED_TOKENS,
            "description": f"{ko} — {desc}".strip(" —") if ko else desc,
            "example": None if sample.strip() in _EMPTY else sample.strip(),
        })

    operations = []
    seen = set()
    for endpoint in endpoints:
        endpoint = endpoint.rstrip(").,")
        parts = [p for p in urlsplit(endpoint).path.split("/") if p]
        if not parts:
            continue
        op_name = parts[-1]
        if op_name in seen:
            continue
        seen.add(op_name)
        base = f"{urlsplit(endpoint).scheme}://{urlsplit(endpoint).netloc}/" + "/".join(parts[:-1])
        operations.append({
            "opName": op_name,
            "summary": op_name,
            "method": "GET",
            "baseUrl": base,
            "path": f"/{op_name}",
            "params": list(params),
            "warnings": [
                "문서의 표 서식으로 읽었습니다(LLM 미사용). 값을 확인한 뒤 사용하세요"
            ],
        })

    # 엔드포인트가 여러 개면 마지막 하나는 서비스 공통 주소일 수 있다.
    # 파라미터를 못 찾았으면 신뢰도가 낮으므로 경고를 더한다.
    if operations and not params:
        for op in operations:
            op["warnings"].append("요청 변수 표를 찾지 못해 파라미터가 비어 있습니다")

    return DocResult(
        service_name=service_name or filename.rsplit(".", 1)[0],
        provider=provider,
        operations=operations,
        extracted_chars=len(text),
    )


def collect_from_document(filename: str, data: bytes) -> DocResult:
    """문서 하나에서 명세를 뽑는다. 실패해도 예외를 던지지 않고 warnings 로 알린다."""
    text, notice = extract_text(filename, data)
    if notice:
        return DocResult(warnings=[notice])
    if not text.strip():
        return DocResult(warnings=["문서에서 글자를 찾지 못했습니다"])

    client = _client()
    if client is None:
        fallback = _rule_based(text, filename)
        if fallback.operations:
            fallback.warnings.append("LLM 미설정이라 표 서식만으로 읽었습니다")
            return fallback
        return DocResult(warnings=[
            "표 서식을 찾지 못했습니다. 문서 분석에는 Azure OpenAI 설정이 필요합니다"
            " (apps/backend/.env)"
        ])

    try:
        response = client.chat.completions.create(
            model=os.environ["AZURE_OPENAI_DEPLOYMENT"],
            max_completion_tokens=4096,
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": f"파일명: {filename}\n\n=== 문서 내용 ===\n{text[:MAX_CHARS]}"},
            ],
        )
        parsed = _parse(response.choices[0].message.content or "")
    except Exception as exc:  # noqa: BLE001
        # LLM 이 안 되면 표 서식이라도 읽어 본다. 아무것도 못 주는 것보다 낫다.
        fallback = _rule_based(text, filename)
        if fallback.operations:
            fallback.warnings.append(
                f"LLM 분석이 실패해 표 서식으로 읽었습니다 ({exc.__class__.__name__})"
            )
            return fallback
        return DocResult(warnings=[f"문서 분석에 실패했습니다 ({exc.__class__.__name__})"])

    if not parsed.get("operations"):
        return DocResult(
            service_name=parsed.get("serviceName", ""),
            provider=parsed.get("provider", ""),
            warnings=["문서에서 API 명세를 찾지 못했습니다. 엔드포인트와 요청 변수가 적힌 문서인지 확인해 주세요"],
            extracted_chars=len(text),
        )

    operations = []
    for op in parsed["operations"]:
        if not op.get("opName") or not (op.get("baseUrl") or op.get("path")):
            continue
        warnings = list(op.get("warnings") or [])
        # 문서에서 뽑은 명세는 실호출로 확인하기 전까지 신뢰하지 않는다.
        warnings.append("문서에서 추출한 명세입니다. 값을 확인한 뒤 사용하세요")
        operations.append({
            "opName": op["opName"],
            "summary": op.get("summary") or op["opName"],
            "method": (op.get("method") or "GET").upper(),
            "baseUrl": (op.get("baseUrl") or "").rstrip("/"),
            "path": op.get("path") or "",
            "params": [
                {
                    "name": p.get("name", ""),
                    "type": p.get("type") or "string",
                    "required": bool(p.get("required")),
                    "description": p.get("description") or "",
                    "example": p.get("example"),
                }
                for p in (op.get("params") or [])
                if p.get("name")
            ],
            "warnings": warnings,
        })

    return DocResult(
        service_name=parsed.get("serviceName") or filename.rsplit(".", 1)[0],
        provider=parsed.get("provider", ""),
        operations=operations,
        extracted_chars=len(text),
    )

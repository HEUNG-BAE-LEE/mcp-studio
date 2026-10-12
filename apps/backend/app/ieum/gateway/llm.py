"""도구 설명 다시 쓰기처럼 짧은 글을 LLM 에 시키는 호출.

백엔드가 LLM 콘솔에서 이미 쓰는 Azure OpenAI(GPT) 설정(AZURE_OPENAI_*)을 그대로 쓴다. 그 설정이 없고
ANTHROPIC_API_KEY 가 있으면 Claude 로 부른다. 둘 다 없으면 이 기능만 꺼진다(나머지 화면은 그대로 돈다).
"""
import json
import re
from typing import Optional

import httpx
import openai
from openai import AzureOpenAI

from app.ieum import config

TIMEOUT = 60                 # 초(한 번 시도당). 추론 모델은 짧은 글에도 10초를 넘기곤 한다
# Azure 의 gpt-5 계열은 추론 모델이라 max_completion_tokens 에 "생각한 토큰"이 들어간다. 작게 잡으면 본문 없이 잘린다.
MAX_TOKENS = 4096
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

UNAVAILABLE = ("AI 설정이 없어 다시 쓸 수 없습니다. 설명을 직접 고치거나, apps/backend/.env 에 "
               "AZURE_OPENAI_* 네 개(LLM 콘솔과 같은 값)를 넣어 주세요.")


class LlmError(Exception):
    """호출에 실패했다. 메시지는 화면에 그대로 보인다. 키나 응답 본문은 담지 않는다."""

    def __init__(self, message: str, status: int = 502) -> None:
        super().__init__(message)
        self.status = status


def provider() -> Optional[str]:
    """쓸 수 있는 모델. GPT(Azure OpenAI)를 먼저 보고, 없으면 Claude."""
    if config.azure_openai():
        return "azure"
    return "anthropic" if config.anthropic_key() else None


def complete(system: str, user: str) -> str:
    """system/user 메시지를 보내 답 문장을 돌려준다. 쓸 수 있는 모델이 없으면 LlmError(400)."""
    which = provider()
    if which is None:
        raise LlmError(UNAVAILABLE, 400)
    return _azure(system, user) if which == "azure" else _anthropic(system, user)


def _azure(system: str, user: str) -> str:
    endpoint, key, version, deployment = config.azure_openai()
    try:
        with AzureOpenAI(azure_endpoint=endpoint, api_key=key, api_version=version, timeout=TIMEOUT, max_retries=1) as client:
            # model 은 모델 이름이 아니라 배포 이름이다. max_tokens 는 이 배포가 받지 않는다(max_completion_tokens 만).
            # temperature 도 넣지 않는다 — 추론 모델은 기본값 말고는 거절한다.
            resp = client.chat.completions.create(model=deployment, max_completion_tokens=MAX_TOKENS,
                                                  messages=[{"role": "system", "content": system}, {"role": "user", "content": user}])
    except openai.AuthenticationError:
        raise LlmError("GPT 인증에 실패했습니다. AZURE_OPENAI_API_KEY 를 확인해 주세요.")
    except openai.NotFoundError:
        raise LlmError("GPT 배포를 찾지 못했습니다. AZURE_OPENAI_DEPLOYMENT(모델 이름이 아니라 배포 이름)와 엔드포인트를 확인해 주세요.")
    except openai.RateLimitError:
        raise LlmError("GPT 호출 한도를 넘었습니다. 잠시 뒤 다시 시도해 주세요.")
    except openai.APITimeoutError:
        raise LlmError("GPT 응답이 %d초 안에 오지 않았습니다. 잠시 뒤 다시 시도해 주세요." % TIMEOUT)
    except openai.APIConnectionError:
        raise LlmError("GPT 서버에 연결하지 못했습니다. 사내망·프록시 설정과 AZURE_OPENAI_ENDPOINT 를 확인해 주세요.")
    except openai.APIStatusError as e:
        code = getattr(e, "code", None) or getattr(e, "status_code", "")
        raise LlmError("GPT 가 요청을 처리하지 못했습니다. (%s)" % code)
    except openai.OpenAIError as e:
        raise LlmError("GPT 호출에 실패했습니다. (%s)" % type(e).__name__)
    choice = resp.choices[0] if resp.choices else None
    text = ((choice.message.content if choice else "") or "").strip()
    if not text:
        why = "생각하느라 토큰을 다 써서" if choice is not None and choice.finish_reason == "length" else "내용 없이"
        raise LlmError("GPT 가 %s 끝났습니다. 다시 시도해 주세요." % why)
    return text


def _anthropic(system: str, user: str) -> str:
    try:
        r = httpx.post(ANTHROPIC_URL, timeout=60, headers={"x-api-key": config.anthropic_key(), "anthropic-version": "2023-06-01"},
                       json={"model": config.chat_model(), "max_tokens": 400, "system": system, "messages": [{"role": "user", "content": user}]})
        r.raise_for_status()
        text = "".join(b.get("text", "") for b in r.json()["content"] if b["type"] == "text").strip()
    except httpx.HTTPError as e:
        raise LlmError("Claude API 호출에 실패했습니다. (%s)" % type(e).__name__)
    if not text:
        raise LlmError("Claude 가 내용 없이 끝났습니다. 다시 시도해 주세요.")
    return text


def complete_json(system: str, user: str):
    """JSON 으로 답하게 시킨다. 코드 펜스나 앞뒤 설명이 붙어도 JSON 부분을 읽는다. 읽지 못하면 LlmError."""
    text = complete(system, user)
    body = re.sub(r"^```[a-z]*\s*|\s*```$", "", text.strip())
    for candidate in (body, body[body.find("{"):body.rfind("}") + 1], body[body.find("["):body.rfind("]") + 1]):
        try:
            return json.loads(candidate)
        except ValueError:
            continue
    raise LlmError("AI 답을 읽지 못했습니다(JSON 형식이 아님).")


def clean(text: str, limit: int = 800) -> str:
    """모델이 붙이곤 하는 군더더기(코드 펜스, 따옴표, "설명:" 머리말)를 걷고 길이를 제한한다."""
    s = re.sub(r"^```[a-z]*\s*|\s*```$", "", text.strip())
    s = re.sub(r"^(?:도구\s*)?설명\s*[:：]\s*", "", s).strip()
    if len(s) >= 2 and s[0] in "\"'“‘" and s[-1] in "\"'”’":
        s = s[1:-1].strip()
    return re.sub(r"[ \t]+", " ", s)[:limit].strip()

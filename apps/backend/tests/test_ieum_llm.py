"""도구 설명 "AI로 다시 쓰기": 백엔드의 Azure OpenAI(GPT) 설정으로 부르고, 없으면 Claude, 둘 다 없으면 꺼진다.

진짜 모델은 부르지 않는다. 대역이 받은 인자를 확인한다(`ieum_state` 가 개발자 PC 의 AZURE_OPENAI_* 도 치워 둔다).
"""
import types

import httpx
import openai
import pytest

from app.ieum import config
from app.ieum.gateway import llm
from app.ieum.routers import studio

AZURE = {"AZURE_OPENAI_ENDPOINT": "https://example.openai.azure.com/", "AZURE_OPENAI_API_KEY": "SECRET-KEY-VALUE",
         "AZURE_OPENAI_API_VERSION": "2024-12-01-preview", "AZURE_OPENAI_DEPLOYMENT": "my-gpt-deployment"}
REQ = httpx.Request("POST", "https://example.openai.azure.com/openai/deployments/x/chat/completions")


@pytest.fixture
def azure(ieum_state, monkeypatch):
    """AzureOpenAI 대역. 만들 때와 부를 때의 인자를 기록하고, 정해 둔 답이나 오류를 돌려준다."""
    rec = types.SimpleNamespace(inits=[], calls=[], answer="직원을 이름으로 찾습니다.", finish="stop", error=None)

    class Completions:
        def create(self, **kwargs):
            rec.calls.append(kwargs)
            if rec.error:
                raise rec.error
            message = types.SimpleNamespace(content=rec.answer)
            return types.SimpleNamespace(choices=[types.SimpleNamespace(message=message, finish_reason=rec.finish)])

    class Client:
        def __init__(self, **kwargs):
            rec.inits.append(kwargs)
            self.chat = types.SimpleNamespace(completions=Completions())

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    monkeypatch.setattr(llm, "AzureOpenAI", Client)
    for name, value in AZURE.items():
        monkeypatch.setenv(name, value)
    return rec


def rewrite(console, body=None, tool="search_employee"):
    return console.api("POST", "/studio/%s/rewrite/" % tool, body or {})


# ------------------------------------------------------------------ 어떤 모델을 쓰나
def test_rewrite_is_off_without_any_model(console):
    console.connect_demo()
    st, msg = rewrite(console)
    assert st == 400 and "AZURE_OPENAI_*" in msg and "설명을 직접 고치" in msg
    assert llm.provider() is None


def test_rewrite_calls_gpt_with_the_backends_azure_settings(console, azure):
    console.connect_demo()
    st, out = rewrite(console, {"desc": "지금 설명입니다."})
    assert st == 200 and out == {"desc": "직원을 이름으로 찾습니다."}

    # LLM 콘솔과 같은 설정으로 클라이언트를 만든다
    init = azure.inits[0]
    assert (init["azure_endpoint"], init["api_key"], init["api_version"]) == (AZURE["AZURE_OPENAI_ENDPOINT"], AZURE["AZURE_OPENAI_API_KEY"], AZURE["AZURE_OPENAI_API_VERSION"])
    call = azure.calls[0]
    assert call["model"] == AZURE["AZURE_OPENAI_DEPLOYMENT"]                      # 모델 이름이 아니라 배포 이름
    assert call["max_completion_tokens"] >= 2048 and "max_tokens" not in call     # 이 배포는 max_tokens 를 받지 않고, 추론 모델이라 생각 토큰까지 들어간다
    assert "temperature" not in call                                              # 추론 모델은 기본값 말고는 거절한다
    assert [m["role"] for m in call["messages"]] == ["system", "user"]
    user = call["messages"][1]["content"]
    assert "search_employee" in user and "srch_nm" in user and "현재 설명: 지금 설명입니다." in user
    assert AZURE["AZURE_OPENAI_API_KEY"] not in str(call["messages"])


def test_gpt_is_preferred_when_both_models_are_configured(console, azure, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-unused")
    assert llm.provider() == "azure"
    console.connect_demo()
    assert rewrite(console)[0] == 200 and len(azure.calls) == 1


def test_rewrite_falls_back_to_claude_when_only_that_key_exists(console, ieum_state, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    sent = {}

    def fake_post(url, **kwargs):
        sent.update(url=url, **kwargs)
        return types.SimpleNamespace(raise_for_status=lambda: None, json=lambda: {"content": [{"type": "text", "text": "클로드가 쓴 설명입니다."}]})
    monkeypatch.setattr(llm.httpx, "post", fake_post)
    console.connect_demo()
    st, out = rewrite(console)
    assert (st, out) == (200, {"desc": "클로드가 쓴 설명입니다."}) and llm.provider() == "anthropic"
    assert sent["url"] == llm.ANTHROPIC_URL and sent["headers"]["x-api-key"] == "sk-ant-test"
    assert sent["json"]["model"] == config.chat_model() and "search_employee" in sent["json"]["messages"][0]["content"] and sent["json"]["system"]


def test_incomplete_azure_settings_count_as_not_configured(ieum_state, monkeypatch):
    for name, value in AZURE.items():
        monkeypatch.setenv(name, value)
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "  ")
    assert config.azure_openai() is None and llm.provider() is None


# ------------------------------------------------------------------ 실패는 읽을 수 있는 말로
@pytest.mark.parametrize("error, expect", [
    (openai.AuthenticationError("bad key", response=httpx.Response(401, request=REQ), body=None), "AZURE_OPENAI_API_KEY"),
    (openai.NotFoundError("no deployment", response=httpx.Response(404, request=REQ), body=None), "배포 이름"),
    (openai.RateLimitError("slow down", response=httpx.Response(429, request=REQ), body=None), "한도"),
    (openai.APITimeoutError(request=REQ), "초 안에"),
    (openai.APIConnectionError(request=REQ), "사내망"),
    (openai.BadRequestError("filtered", response=httpx.Response(400, request=REQ), body={"code": "content_filter", "message": "x"}), "content_filter"),
    (openai.InternalServerError("boom", response=httpx.Response(500, request=REQ), body=None), "500"),
])
def test_gpt_failures_become_readable_errors(console, azure, error, expect):
    azure.error = error
    console.connect_demo()
    st, msg = rewrite(console)
    assert st == 502 and expect in msg
    assert AZURE["AZURE_OPENAI_API_KEY"] not in msg and "SECRET" not in msg      # 키는 어디에도 새지 않는다


def test_empty_answers_say_why(console, azure):
    console.connect_demo()
    azure.answer, azure.finish = "", "length"
    st, msg = rewrite(console)
    assert st == 502 and "토큰" in msg                                             # 추론에 토큰을 다 쓰고 본문이 없다
    azure.finish = "stop"
    assert "내용 없이" in rewrite(console)[1]


def test_unknown_tool_is_not_found_even_with_a_model(console, azure):
    assert rewrite(console, tool="nope")[0] == 404


# ------------------------------------------------------------------ 요청과 답 다듬기
TOOL = {"id": "get_vacation_balance", "title": "연차 잔여일수 조회", "mode": "read", "method": "GET", "path": "/vacation/{EMP_NO}", "desc": "예전 설명",
        "params": [{"a": "emp_no", "at": "string", "d": "사번 8자리", "req": 1, "rule": "name"},
                   {"a": "base_ymd", "at": "string (date)", "d": "base_ymd", "rule": "date"},
                   {"a": "service_key", "rule": "inject", "v": "SECRET-INJECTED"}],
        "res": [{"a": "annual_rem_cnt", "ov": "5.5", "rule": "num"}, {"a": "emp_nm", "ov": "홍길동"}, {"o": "ignored", "rule": "name"}]}


def test_prompt_shows_what_the_ai_will_actually_see():
    system, user = studio.rewrite_prompt(TOOL)
    assert "읽기" in user and "GET /vacation/{EMP_NO}" in user and "현재 설명: 예전 설명" in user
    assert "- emp_no (string) 필수: 사번 8자리" in user and "- base_ymd (string)" in user      # 설명이 이름과 같으면 되풀이하지 않는다
    assert "- annual_rem_cnt (예: 5.5)" in user and "- emp_nm (예: 홍길동)" in user and "ignored" not in user
    assert "service_key" not in user and "SECRET-INJECTED" not in user                       # AI 에게 숨기는 값은 모델에게도 보내지 않는다
    assert "소스 파일 경로" in system and "URL" in system                                    # 근거 문구를 설명에 옮기지 말라고 시킨다
    assert "이전과 다른 표현" not in user and "이전과 다른 표현" in studio.rewrite_prompt(TOOL, again=True)[1]


def test_prompt_marks_writes_and_handles_tools_without_parameters_or_path():
    _, user = studio.rewrite_prompt({"id": "soap_call", "mode": "write", "op": "UpdateEmp", "params": [], "res": []}, desc="")
    assert "쓰기(데이터 변경)" in user and "호출: UpdateEmp" in user and "입력 파라미터: 없음" in user and "응답 필드" not in user
    assert "현재 설명: (없음)" in user


@pytest.mark.parametrize("raw, expected", [
    ('"따옴표로 감싼 설명입니다."', "따옴표로 감싼 설명입니다."),
    ("설명: 머리말이 붙은 설명입니다.", "머리말이 붙은 설명입니다."),
    ("```\n코드 펜스로 감싼 설명입니다.\n```", "코드 펜스로 감싼 설명입니다."),
    ("“둥근 따옴표” 로 시작하는 설명", "“둥근 따옴표” 로 시작하는 설명"),               # 짝이 맞지 않으면 건드리지 않는다
    ("두  칸   공백은   줄인다", "두 칸 공백은 줄인다"),
])
def test_clean_strips_what_models_like_to_add(raw, expected):
    assert llm.clean(raw) == expected


def test_clean_caps_the_length():
    assert len(llm.clean("가" * 2000)) == 800

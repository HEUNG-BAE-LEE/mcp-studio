# apps/backend/tests/test_ieum_recorder_analyze.py
"""분석: 기록 → 업무 기능. 브라우저 없이 돈다."""
import json

from app.ieum.recorder import analyze, htmltable

BASE = "http://h:8080/po"


def net(method, path, query="", res=None, post=None, rtype="xhr", status=200, held=False, decision="", data=None, base=BASE, charset=None):
    origin = base.split("/po")[0] if base == BASE else base
    return {"method": method, "url": f"{origin}{'/po' if base == BASE else ''}{path}" + (f"?{query}" if query else ""),
            "origin": origin, "base": base, "path": path, "status": status, "ctype": "", "charset": charset, "rtype": rtype,
            "headers": {"x-requested-with": "XMLHttpRequest"}, "post": post,
            "res": json.dumps(res, ensure_ascii=False) if isinstance(res, (dict, list)) else (res or ""),
            "data": data, "file": False, "held": held, "decision": decision, "primary": base == BASE, "t": 0}


def span(seq, target, network, post_aria="", fills=None, title="발주 현황", hidden=None, href=f"{BASE}/x"):
    return {"seq": seq, "action": {"type": "click", "target": target, "isTrusted": True, "t": seq}, "fills": fills or [],
            "pre": {"url": "/x", "href": href, "title": title, "aria": "", "hidden": hidden or {}, "shot": None},
            "network": network, "post": {"url": "/x", "href": href, "title": title, "aria": post_aria, "hidden": {}, "shot": None}}


LIST = {"RSLT": "0000", "resultList": [{"PO_NO": "PO-2609-0142", "VEND_NM": "한빛상사"}, {"PO_NO": "PO-2609-0138", "VEND_NM": "대한문구"}]}
DETAIL = {"RSLT": "0000", "po": {"PO_NO": "PO-2609-0142", "VEND_NM": "한빛상사", "PO_AMT": "4,850,000"}}
CODES = {"RSLT": "0000", "resultList": [{"CD": "10", "CD_NM": "작성"}, {"CD": "20", "CD_NM": "승인대기"}]}
REC = {"id": "rec_00000001", "name": "발주 상세 조회", "owner": "홍길동", "sourceBase": BASE, "env": "op", "readPost": "",
       "login": {"mode": "auto", "recipe": {"userField": "userId"}, "path": "/po/loginProc.do"}, "approvals": []}

READ = [
    span(1, {"tag": "A", "text": "발주 현황"}, [net("GET", "/common/codeList.do", "grpCd=PO_STTS", CODES)]),
    span(2, {"tag": "BUTTON", "id": "btnSearch", "text": "조회"}, [net("GET", "/poList.do", "fromDt=20260901&toDt=20260930&sttsCd=", LIST)],
         post_aria="- table:\n  - row: PO-2609-0142 한빛상사\n  - row: PO-2609-0138 대한문구",
         fills=[{"target": {"id": "fromDt", "label": "발주일"}, "value": "20260901"}, {"target": {"id": "toDt", "label": ""}, "value": "20260930"}]),
    span(3, {"tag": "TR", "text": "PO-2609-0142 한빛상사"}, [net("GET", "/poDetail.do", "poNo=PO-2609-0142", DETAIL)],
         post_aria="- heading: 발주 상세 PO-2609-0142\n- text: 한빛상사 4,850,000"),
]


def test_핵심_단계와_값_연결을_찾는다():
    bf = analyze.analyze(REC, READ)
    assert [(s["method"], s["path"]) for s in bf["steps"]] == [("GET", "/poList.do"), ("GET", "/poDetail.do")]
    s1, s2 = bf["steps"]
    assert s1["outputs"] == {"PO_NO": "$.resultList[0].PO_NO"} and s1["kind"] == "json" and s1["base"] == BASE
    po = next(p for p in s2["params"] if p["a"] == "poNo")
    assert po["from"] == "s1.PO_NO" and po["source"] == "PREVIOUS_STEP_OUTPUT" and po["confidence"] == "high"
    assert bf["evidence"] == {"s1": [2], "s2": [3]}


def test_사용자가_입력한_값은_USER_INPUT_이고_라벨이_붙는다():
    inputs = {i["name"]: i for i in analyze.analyze(REC, READ)["inputs"]}
    assert inputs["fromDt"]["source"] == "USER_INPUT" and inputs["fromDt"]["screenLabel"] == "발주일" and inputs["fromDt"]["type"] == "date"
    assert inputs["sttsCd"]["confidence"] == "low" and inputs["fromDt"]["needsValue"] is False


def test_코드성_요청은_참조이고_출력은_마지막_화면에_보인_필드():
    bf = analyze.analyze(REC, READ)
    assert any(r["path"] == "/common/codeList.do" and r["role"] == "code" for r in bf["references"])
    assert bf["output"]["from"] == "s2" and {"$.po.VEND_NM", "$.po.PO_AMT"} <= set(bf["output"]["fields"])


def test_읽기만_있으면_READ_LOW_NONE_이고_설명_초안이_있다():
    bf = analyze.analyze(REC, READ)
    p = bf["policy"]
    assert (p["operation"], p["risk"], p["approval"], p["scope"], p["sensitivity"]) == ("READ", "LOW", "NONE", None, None)
    assert "발주 현황" in bf["desc"] and "발주일" in bf["desc"]


def test_승인한_쓰기가_있으면_CREATE():
    spans = [span(1, {"tag": "BUTTON", "id": "btnSave", "text": "저장"},
                  [net("POST", "/poSave.do", "", {"RSLT": "0000", "PO_NO": "PO-2610-0001"}, post="vendCd=V0012&qty=10", held=True, decision="approve")],
                  post_aria="- text: 발주를 등록했습니다. 발주번호 PO-2610-0001", fills=[{"target": {"id": "qty", "label": "수량"}, "value": "10"}])]
    bf = analyze.analyze(REC, spans)
    assert bf["steps"][0]["write"] is True and bf["steps"][0]["role"] == "core"
    assert (bf["policy"]["operation"], bf["policy"]["risk"], bf["policy"]["approval"]) == ("CREATE", "MEDIUM", "CONFIRM")


def test_행동_없는_요청은_잡음이다():
    spans = READ + [span(4, None, [net("GET", "/chart/monthly.do", "yyyy=2026", {"resultList": [1, 2]})])]
    bf = analyze.analyze(REC, spans)
    assert "/chart/monthly.do" not in [s["path"] for s in bf["steps"]]
    assert any(x["path"] == "/chart/monthly.do" and x["role"] == "noise" for x in bf["excluded"])


def test_같은_값이_두_곳에_있으면_확신도를_낮춘다():
    dup = {"resultList": [{"PO_NO": "PO-2609-0142", "REF_NO": "PO-2609-0142"}]}
    spans = [span(1, {"tag": "BUTTON", "text": "조회"}, [net("GET", "/poList.do", "fromDt=20260901", dup)], post_aria="PO-2609-0142"),
             span(2, {"tag": "TR", "text": "PO-2609-0142"}, [net("GET", "/poDetail.do", "poNo=PO-2609-0142", DETAIL)], post_aria="한빛상사")]
    po = next(p for p in analyze.analyze(REC, spans)["steps"][1]["params"] if p["a"] == "poNo")
    assert po["source"] == "PREVIOUS_STEP_OUTPUT" and po["confidence"] == "low"


def test_서버가_그린_HTML_표에서_값을_꺼내_잇고_숨은_토큰은_브라우저_실행():
    list_html = ('<table><tr><th>거래처코드</th><th>거래처명</th></tr><tr><td><a href="vendDetail.do?vendCd=V0012">V0012</a></td>'
                 '<td>한빛상사</td></tr></table>')
    detail_html = "<table><tr><th>거래처명</th><td>한빛상사</td><th>대표자</th><td>홍길동</td></tr></table>"
    spans = [
        span(1, {"tag": "BUTTON", "text": "검색"}, [net("POST", "/vendSearch.do", "", list_html, post="_csrf=tok-9&vendNm=%ED%95%9C%EB%B9%9B",
                                                          rtype="document", data=htmltable.to_data(list_html), charset="EUC-KR")],
             post_aria="- table: V0012 한빛상사", fills=[{"target": {"id": "vendNm", "label": "거래처명"}, "value": "한빛"}],
             hidden={"_csrf": "tok-9"}, href=f"{BASE}/vendSearchView.do"),
        span(2, {"tag": "A", "text": "V0012"}, [net("GET", "/vendDetail.do", "vendCd=V0012", detail_html, rtype="document",
                                                    data=htmltable.to_data(detail_html))], post_aria="- text: 한빛상사 홍길동"),
    ]
    bf = analyze.analyze(REC, spans)
    s1, s2 = bf["steps"]
    assert s1["kind"] == "html" and s1["exec"] == "browser" and s1["formPage"] == f"{BASE}/vendSearchView.do" and s1["charset"] == "EUC-KR"
    csrf = next(p for p in s1["params"] if p["a"] == "_csrf")
    assert csrf["source"] == "SESSION_CONTEXT" and csrf["from"] == "session.hidden._csrf"
    v = next(p for p in s2["params"] if p["a"] == "vendCd")
    assert v["source"] == "PREVIOUS_STEP_OUTPUT" and analyze.get_path(s1_data := htmltable.to_data(list_html), "$.tables[0].rows[0].거래처코드") == "V0012"
    assert bf["output"]["fields"] and all(f.startswith("$.fields.") for f in bf["output"]["fields"])


def test_같은_경로라도_구분_파라미터가_다르면_나눈다():
    spans = [span(1, {"tag": "BUTTON", "text": "조회"}, [net("GET", "/po.do", "cmd=list&q=1", LIST)], post_aria="PO-2609-0142"),
             span(2, {"tag": "TR", "text": "x"}, [net("GET", "/po.do", "cmd=detail&poNo=PO-2609-0142", DETAIL)], post_aria="4,850,000")]
    bf = analyze.analyze(REC, spans)
    assert [s["discriminator"] for s in bf["steps"]] == ["cmd=list", "cmd=detail"]


def test_다른_출처_단계는_그_출처를_기준으로_둔다():
    other = "http://appr.corp:9090"
    spans = [span(1, {"tag": "BUTTON", "text": "결재 현황"}, [net("GET", "/appr/list.do", "q=1", {"rows": [{"DOC": "D-77"}]}, base=other)],
                  post_aria="D-77")]
    s = analyze.analyze(REC, spans)["steps"][0]
    assert s["base"] == other and s["path"] == "/appr/list.do"


def test_마스킹된_입력은_값_다시_입력_필요():
    spans = [span(1, {"tag": "BUTTON", "text": "조회"}, [net("GET", "/custList.do", "tel=010****5678", {"rows": [{"NM": "홍길동"}]})],
                  post_aria="홍길동", fills=[{"target": {"id": "tel", "label": "연락처"}, "value": "010****5678"}])]
    inp = analyze.analyze(REC, spans)["inputs"][0]
    assert inp["name"] == "tel" and inp["needsValue"] is True


def test_날짜_모양_고정값은_확인_필요():
    spans = [span(1, {"tag": "BUTTON", "text": "조회"}, [net("GET", "/poList.do", "baseDt=20260915", LIST)], post_aria="PO-2609-0142")]
    p = analyze.analyze(REC, spans)["steps"][0]["params"][0]
    assert p["source"] == "CONSTANT" and p["confidence"] == "low"


def test_JSON_이_아닌_응답도_분석이_멈추지_않고_핵심을_못_찾으면_안내():
    r1 = analyze.analyze(REC, [span(1, {"tag": "BUTTON", "text": "조회"}, [net("GET", "/legacyList.do", "q=1", "<p>PO-1</p>")], post_aria="PO-1")])
    assert r1["steps"][0]["kind"] == "other"
    r2 = analyze.analyze(REC, [span(1, {"tag": "A", "text": "메인"}, [])])
    assert r2["steps"] == [] and any("핵심 요청을 찾지 못했습니다" in n for n in r2["notes"])


def test_JSON_잎_경로와_링크_쿼리_꺼내기():
    assert analyze.get_path(LIST, "$.resultList[1].PO_NO") == "PO-2609-0138"
    assert analyze.get_path({"rows": [{"_links": ["poDetail.do?poNo=PO-1&x=2"]}]}, "$.rows[0]._links[0]?poNo") == "PO-1"
    assert ("$.po.PO_AMT", "4,850,000") in analyze.leaves(DETAIL)


def test_가려진_값은_상수로_굳히지_않고_같은_가림_문자열끼리_연결된다():
    from app.ieum.discovery.masking import HIDDEN
    # 비밀 필드 값(HIDDEN)은 고정값이 아니라 입력이어야 한다. 사용자가 채우지 않은 채 나가도 마찬가지다.
    spans = [span(1, {"tag": "BUTTON", "text": "조회"},
                  [net("GET", "/custList.do", f"pwd={HIDDEN}&tel=***-****-5678", {"rows": [{"TEL": "***-****-5678", "NM": "홍길동"}]})],
                  post_aria="홍길동", fills=[{"target": {"id": "pwd", "label": "비밀번호"}, "value": HIDDEN}]),
             span(2, {"tag": "TR", "text": "홍길동"},
                  [net("GET", "/custDetail.do", "tel=***-****-5678&secret=" + HIDDEN, {"c": {"NM": "홍길동", "AGE": "40세"}})],
                  post_aria="홍길동 40세")]
    bf = analyze.analyze(REC, spans)
    s1, s2 = bf["steps"]
    for st in bf["steps"]:
        for p in st["params"]:
            assert p["source"] != "CONSTANT" and HIDDEN not in p["ex"] and "const:" not in p["from"]
    pwd = next(p for p in s1["params"] if p["a"] == "pwd")
    assert pwd["source"] == "USER_INPUT" and pwd["ex"] == ""
    assert {i["name"]: i["screenLabel"] for i in bf["inputs"]}["pwd"] == "비밀번호"      # 이름(id)으로 짝지은 라벨
    sec = next(p for p in s2["params"] if p["a"] == "secret")
    assert sec["source"] == "USER_INPUT" and sec["ex"] == ""
    inp = {i["name"]: i for i in bf["inputs"]}
    assert inp["pwd"]["needsValue"] is True and inp["pwd"]["ex"] == "" and inp["secret"]["needsValue"] is True
    tel = next(p for p in s2["params"] if p["a"] == "tel")
    assert tel["source"] == "PREVIOUS_STEP_OUTPUT" and tel["from"] == "s1.TEL"


def _masked_span(query, res=None, fills=None, seq=1, aria="홍길동", headers=None):
    n = net("GET", "/custList.do", query, res or {"rows": [{"NM": "홍길동"}]})
    if headers:
        n["headers"] = headers
    return span(seq, {"tag": "BUTTON", "text": "조회"}, [n], post_aria=aria, fills=fills)


def test_채우지_않은_가림_값은_라벨을_빌리지_않고_높은_확신도가_아니다():
    from app.ieum.discovery.masking import HIDDEN
    fills = [{"target": {"id": "pwd", "label": "비밀번호"}, "value": HIDDEN}]
    bf = analyze.analyze(REC, [_masked_span(f"pwd={HIDDEN}&pin={HIDDEN}", fills=fills)])
    inp = {i["name"]: i for i in bf["inputs"]}
    assert inp["pwd"]["screenLabel"] == "비밀번호"
    assert inp["pin"]["screenLabel"] == "" and inp["pin"]["confidence"] != "high" and inp["pin"]["needsValue"] is True and inp["pin"]["ex"] == ""


def test_가린_값끼리_우연히_같아도_앞_단계_출력으로_잇지_않는다():
    from app.ieum.discovery.masking import HIDDEN
    spans = [_masked_span("q=1", {"rows": [{"NM": "홍길동"}], "token": HIDDEN}, aria="홍길동"),
             span(2, {"tag": "BUTTON", "text": "확인"}, [net("GET", "/custDetail.do", f"password={HIDDEN}", {"c": {"NM": "홍길동"}})], post_aria="홍길동")]
    p = next(p for p in analyze.analyze(REC, spans)["steps"][1]["params"] if p["a"] == "password")
    assert p["source"] == "USER_INPUT" and p["ex"] == ""


def test_부분_가림_값은_고정값이_아니라_입력이다():
    bf = analyze.analyze(REC, [_masked_span("tel=010-****-5678")])
    p = bf["steps"][0]["params"][0]
    assert p["source"] == "USER_INPUT" and bf["inputs"][0]["needsValue"] is True


def test_가린_헤더는_단계에서_빼고_알린다():
    bf = analyze.analyze(REC, [_masked_span("q=1", headers={"x-auth-token": "\u2022" * 8, "x-requested-with": "XMLHttpRequest"})])
    assert bf["steps"][0]["headers"] == {"x-requested-with": "XMLHttpRequest"}
    assert bf["auth"]["droppedHeaders"] == ["x-auth-token"] and any("x-auth-token" in n for n in bf["notes"])


def test_입력이_앞_단계_출력보다_먼저다():
    # 사용자가 친 값이 앞 응답에도 있으면 사용자 입력으로 본다(설계 6절 5번 표 순서)
    spans = [span(1, {"tag": "BUTTON", "text": "조회"}, [net("GET", "/poList.do", "q=1", LIST)], post_aria="PO-2609-0142"),
             span(2, {"tag": "BUTTON", "text": "상세"}, [net("GET", "/poDetail.do", "poNo=PO-2609-0142", DETAIL)], post_aria="4,850,000",
                  fills=[{"target": {"id": "poNo", "label": "발주번호"}, "value": "PO-2609-0142"}])]
    p = next(p for p in analyze.analyze(REC, spans)["steps"][1]["params"] if p["a"] == "poNo")
    # 같은 값이 앞 응답에도 있으므로 출처는 입력이되 확신도는 낮춰 검토 화면에서 묻는다
    assert p["source"] == "USER_INPUT" and p["confidence"] == "low"


def test_입력만_맞으면_확신도가_높다():
    p = next(p for p in analyze.analyze(REC, READ)["steps"][0]["params"] if p["a"] == "fromDt")
    assert p["source"] == "USER_INPUT" and p["confidence"] == "high"


def test_화면에_안_보이지만_뒤_단계가_쓰는_응답은_prereq():
    spans = [span(1, {"tag": "BUTTON", "text": "조회"}, [net("GET", "/poList.do", "q=1", LIST)], post_aria="결과 없음"),
             span(2, {"tag": "BUTTON", "text": "상세"}, [net("GET", "/poDetail.do", "poNo=PO-2609-0142", DETAIL)], post_aria="4,850,000")]
    bf = analyze.analyze(REC, spans)
    assert [(s["id"], s["role"]) for s in bf["steps"]] == [("s1", "prereq"), ("s2", "core")]
    assert next(p for p in bf["steps"][1]["params"] if p["a"] == "poNo")["from"] == "s1.PO_NO"
    # 쓰이지 않으면 빠진다
    bf2 = analyze.analyze(REC, spans[:1] + [span(2, {"tag": "BUTTON", "text": "상세"}, [net("GET", "/poDetail.do", "poNo=ZZ", DETAIL)], post_aria="4,850,000")])
    assert [s["role"] for s in bf2["steps"]] == ["core"] and bf2["steps"][0]["id"] == "s1"


import pytest


@pytest.mark.parametrize("method,path,rtype,write", [
    ("GET", "/poList.do", "xhr", False),
    ("GET", "/deleteItem.do", "xhr", True),                  # 이름이 쓰기 같은 화면 스크립트 GET
    ("POST", "/selectList.do", "xhr", False),
    ("POST", "/selectAndUpdate.do", "xhr", True),            # 조회 낱말이 있어도 변경 낱말이 있으면 쓰기
    ("POST", "/getOrCreateSummary.do", "xhr", True),
    ("POST", "/save.do", "xhr", True),
    ("POST", "/poData.do", "xhr", True),                     # 낱말 없는 POST 는 쓰기(애매하면 쓰기)
    ("POST", "/po/발주조회.do", "xhr", False),
    ("POST", "/po_list_view.do", "xhr", False),
    ("POST", "/ord-search.do", "xhr", False),
])
def test_조회_쓰기_판정_표(method, path, rtype, write):
    bf = analyze.analyze(REC, [span(1, {"tag": "BUTTON", "text": "실행"}, [net(method, path, "", LIST, post="q=1" if method == "POST" else None,
                                                                          rtype=rtype)], post_aria="PO-2609-0142 한빛상사")])
    st = bf["steps"][0]
    assert st["write"] is write and st["writeWhy"]


def test_writeWhy_는_근거를_남긴다():
    def why(method, path):
        bf = analyze.analyze(REC, [span(1, {"tag": "BUTTON", "text": "실행"}, [net(method, path, "", LIST, post="q=1")], post_aria="PO-2609-0142")])
        return bf["steps"][0]["writeWhy"]
    assert why("GET", "/poList.do") == "GET"
    assert why("GET", "/deleteItem.do") == "이름이 쓰기 같은 GET(deleteItem)"
    assert why("POST", "/selectList.do") == "POST — 조회 낱말(select)"
    assert why("POST", "/poSave.do") == "POST — 변경 낱말(save)"
    assert why("POST", "/poData.do") == "POST — 기본 쓰기"


def test_held_나_decision_은_판정에_쓰지_않는다():
    # 3판: 기록 중 쓰기는 붙잡지 않고 보내므로 held 가 근거가 될 수 없다. 이름만 본다
    n = net("GET", "/poList.do", "q=1", LIST, held=True, decision="approve")
    assert analyze.analyze(REC, [span(1, {"tag": "BUTTON", "text": "조회"}, [n], post_aria="PO-2609-0142")])["steps"][0]["write"] is False
    n = net("POST", "/selectList.do", "", LIST, post="q=1", decision="staging")
    assert analyze.analyze(REC, [span(1, {"tag": "BUTTON", "text": "조회"}, [n], post_aria="PO-2609-0142")])["steps"][0]["write"] is False


def test_예전_기록의_readPost_는_무시한다():
    rec = dict(REC, readPost="/po/poData*")
    bf = analyze.analyze(rec, [span(1, {"tag": "BUTTON", "text": "검색"}, [net("POST", "/poData.do", "", LIST, post="q=1")], post_aria="PO-2609-0142")])
    assert bf["steps"][0]["write"] is True


def test_정책은_단계의_write_로_정한다():
    rd = analyze.analyze(REC, [span(1, {"tag": "BUTTON", "text": "검색"}, [net("POST", "/selectList.do", "", LIST, post="q=1")], post_aria="PO-2609-0142")])
    assert rd["policy"]["operation"] == "READ" and rd["policy"]["approval"] == "NONE" and rd["policy"]["envPolicy"] == "op-auto"
    wr = analyze.analyze(REC, [span(1, {"tag": "BUTTON", "text": "삭제"}, [net("POST", "/poDelete.do", "", LIST, post="q=1")], post_aria="PO-2609-0142")])
    assert wr["policy"]["operation"] == "DELETE" and wr["policy"]["envPolicy"] == "op-confirm"


def test_로그인_경로의_jsessionid_는_떼고_비교한다():
    rec = dict(REC, login=dict(REC["login"], path="/po/loginProc.do"))
    n = net("POST", "/loginProc.do;jsessionid=ABC", "", {"ok": 1}, post="userId=a")
    n["url"] = "http://h:8080/po/loginProc.do;jsessionid=ABC"
    bf = analyze.analyze(rec, [span(1, {"tag": "BUTTON", "text": "로그인"}, [n])])
    assert bf["steps"] == [] and any(x["role"] == "auth" for x in bf["excluded"])


def test_get_path_문자열_인덱싱과_점이_든_키():
    assert analyze.get_path({"a": "abc"}, "$.a[0]") is None
    assert analyze.get_path({"a": 5}, "$.a?x") is None
    data = {"No.": "7", "rows": [{"a[1]": "z"}]}
    assert ("$['No.']", "7") in analyze.leaves(data) and analyze.get_path(data, "$['No.']") == "7"
    assert analyze.get_path(data, "$.rows[0]['a[1]']") == "z"


def test_이름이_다른_숫자_연결은_확신도가_낮다():
    spans = [span(1, {"tag": "BUTTON", "text": "조회"}, [net("GET", "/poList.do", "q=1", {"rows": [{"QTY": "12345"}]})], post_aria="12345"),
             span(2, {"tag": "BUTTON", "text": "상세"}, [net("GET", "/poDetail.do", "seqNo=12345", DETAIL)], post_aria="4,850,000")]
    p = next(p for p in analyze.analyze(REC, spans)["steps"][1]["params"] if p["a"] == "seqNo")
    assert p["source"] == "PREVIOUS_STEP_OUTPUT" and p["confidence"] == "low"


def test_get_path_물음표가_든_키_왕복():
    data = {"a?b": "v", "rows": [{"_links": ["x.do?k=1"]}]}
    assert analyze.get_path(data, "$['a?b']") == "v"
    assert ("$['a?b']", "v") in analyze.leaves(data)
    assert analyze.get_path(data, "$.rows[0]._links[0]?k") == "1"


def test_빠진_후보가_남긴_출력과_헤더는_지운다():
    unused = net("GET", "/poList.do", "q=1", LIST)
    unused["headers"] = {"x-auth-token": "\u2022" * 8}
    spans = [span(1, {"tag": "BUTTON", "text": "조회"}, [unused], post_aria="결과 없음"),
             span(2, {"tag": "BUTTON", "text": "상세"}, [net("GET", "/poDetail.do", "poNo=ZZ", DETAIL)], post_aria="4,850,000")]
    bf = analyze.analyze(REC, spans)
    assert [s["role"] for s in bf["steps"]] == ["core"]
    assert bf["auth"]["droppedHeaders"] == [] and not any("x-auth-token" in n for n in bf["notes"])


def test_표_머리글과_안내_행만_있는_화면_이동은_핵심_단계가_아니라_page():
    page_html = ('<table><tr><th>발주번호</th><th>거래처</th></tr><tr><td colspan="2">조회 조건을 입력하고 [조회] 버튼을 누르세요.</td></tr></table>')
    spans = [span(1, {"tag": "A", "text": "발주 현황"}, [net("GET", "/poListView.do", "", page_html, rtype="document", data=htmltable.to_data(page_html))],
                  post_aria="- table:\n  - columnheader: 발주번호\n  - columnheader: 거래처\n  - cell: 조회 조건을 입력하고 [조회] 버튼을 누르세요.")]
    bf = analyze.analyze(REC, spans)
    assert not bf["steps"]
    assert any(e["path"] == "/poListView.do" and e["role"] == "page" for e in bf["excluded"]), bf.get("excluded")


def test_두_열이_같은_값인_데이터_행도_화면에_보이면_핵심_단계():
    html = '<table><tr><th>코드</th><th>이름</th></tr><tr><td>PO-2026-0001</td><td>PO-2026-0001</td></tr></table>'
    spans = [span(1, {"tag": "BUTTON", "text": "조회"}, [net("GET", "/poFind.do", "", html, rtype="document", data=htmltable.to_data(html))],
                  post_aria="- table: PO-2026-0001 PO-2026-0001")]
    assert [s["path"] for s in analyze.analyze(REC, spans)["steps"]] == ["/poFind.do"]


def test_JSON_rows_의_같은_값도_화면에_보이면_핵심_단계():
    res = {"rows": [{"a": "x1x1x1", "b": "x1x1x1"}]}
    spans = [span(1, {"tag": "BUTTON", "text": "조회"}, [net("GET", "/jFind.do", "", res)], post_aria="- row: x1x1x1")]
    assert [s["path"] for s in analyze.analyze(REC, spans)["steps"]] == ["/jFind.do"]

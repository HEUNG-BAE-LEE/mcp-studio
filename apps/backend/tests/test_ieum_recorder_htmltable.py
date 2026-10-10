"""HTML 표 변환. 레거시 JSP 가 그려 주는 화면을 데이터로 바꾼다."""
from app.ieum.recorder import htmltable

LIST = """<html><body><div id="menu"><a href="main.do">메인</a></div>
<form><input type="hidden" name="_csrf" value="t0k3n"></form>
<table class="list"><tr><th>발주번호</th><th>거래처</th><th>금액</th><th>금액</th></tr>
<tr onclick="openDetail('PO-2609-0142')"><td><a href="poDetail.do?poNo=PO-2609-0142">PO-2609-0142</a></td><td> 한빛
상사 </td><td>4,850,000</td><td>1</td></tr>
<tr><td><a href="poDetail.do?poNo=PO-2609-0138">PO-2609-0138</a></td><td colspan="2">대한문구</td><td>2</td></tr>
</table></body></html>"""

DETAIL = """<table class="form"><tr><th>거래처명</th><td>한빛상사</td><th>대표자</th><td>홍길동</td></tr>
<tr><th>연락처</th><td>010-4821-5678</td></tr></table>
<table><tr><td><img src="logo.png"></td><td>배치용</td></tr></table>"""


def test_목록_표를_행_데이터로_바꾼다():
    d = htmltable.to_data(LIST)
    t = d["tables"][0]
    assert t["columns"] == ["발주번호", "거래처", "금액", "금액_2"]
    assert t["rows"][0]["발주번호"] == "PO-2609-0142" and t["rows"][0]["거래처"] == "한빛 상사"
    assert "poDetail.do?poNo=PO-2609-0142" in t["rows"][0]["_links"] and "PO-2609-0142" in t["rows"][0]["_links"]   # href 와 onclick 값
    assert t["rows"][1]["거래처"] == "대한문구" and t["rows"][1]["금액"] == "대한문구"                          # colspan 은 같은 값으로 채운다
    assert d["hidden"] == {"_csrf": "t0k3n"}


def test_상세_화면은_이름값으로_모으고_배치용_표는_버린다():
    d = htmltable.to_data(DETAIL)
    assert d["fields"] == {"거래처명": "한빛상사", "대표자": "홍길동", "연락처": "010-4821-5678"}
    assert d["tables"] == []


def test_표도_필드도_숨은_값도_없으면_None():
    assert htmltable.to_data("<div>안녕하세요</div>") is None


def test_구조_비교용_키():
    assert htmltable.shape(htmltable.to_data(DETAIL)) == {"f:거래처명", "f:대표자", "f:연락처"}
    assert "t0:발주번호" in htmltable.shape(htmltable.to_data(LIST))


def test_HTML_판별():
    assert htmltable.looks_html("text/html;charset=EUC-KR", "")
    assert htmltable.looks_html("", "  <table>")
    assert not htmltable.looks_html("application/json", '{"a":1}')


def test_닫는_태그를_생략한_표():
    d = htmltable.to_data("<table><tr><th>A<th>B<tr><td>1<td>2<tr><td>3<td>4</table>")
    assert d["tables"][0]["columns"] == ["A", "B"]
    assert d["tables"][0]["rows"] == [{"A": "1", "B": "2"}, {"A": "3", "B": "4"}]


def test_닫는_태그를_생략한_상세_화면():
    d = htmltable.to_data("<table><tr><th>거래처명<td>한빛상사<th>대표자<td>홍길동</table>")
    assert d["fields"] == {"거래처명": "한빛상사", "대표자": "홍길동"}


def test_onclick_빈_문자열_인자가_있어도_값을_잃지_않는다():
    d = htmltable.to_data("<table><tr><th>A</th><th>B</th></tr><tr onclick=\"f('', 'PO-1')\"><td>1</td><td>2</td></tr></table>")
    links = d["tables"][0]["rows"][0]["_links"]
    assert "PO-1" in links
    assert not any(", " in x for x in links)


def test_onclick_큰따옴표_인자와_빈_인자를_함께_읽는다():
    # &quot; 는 HTML 속성 안의 큰따옴표다. html.parser 가 풀어서 onclick 값에 " 가 들어간다.
    html = '<table><tr><th>A</th><th>B</th></tr><tr onclick="go(&quot;X-9&quot;, \'\')"><td>1</td><td>2</td></tr></table>'
    d = htmltable.to_data(html)
    assert "X-9" in d["tables"][0]["rows"][0]["_links"]


def test_colspan_한_칸이_모든_열을_덮는_안내_행은_버리고_같은_값의_데이터_행은_둔다():
    guide = '<table><tr><th>코드</th><th>이름</th></tr><tr><td colspan="2">조회 결과가 없습니다.</td></tr></table>'
    assert htmltable.to_data(guide)["tables"][0]["rows"] == []
    same = '<table><tr><th>코드</th><th>이름</th></tr><tr><td>PO-1</td><td>PO-1</td></tr></table>'
    assert htmltable.to_data(same)["tables"][0]["rows"] == [{"코드": "PO-1", "이름": "PO-1"}]

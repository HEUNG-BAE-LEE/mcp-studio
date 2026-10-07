"""MyBatis / iBatis 구문 색인: 매퍼 XML 과 어노테이션 매퍼에서 select·insert·update·delete 를 모은다.

XML 은 파서를 쓰지 않고 정규식으로 읽는다. 레거시 매퍼는 DOCTYPE(DTD 주소)을 달고 있어 표준 파서가
외부 DTD 를 받으러 가거나 터진다. 필요한 것은 네임스페이스와 구문 id·종류뿐이다.

호출 사슬 추적(java.py)이 "이 구문이 읽기냐 쓰기냐"를 물으면 여기서 답한다.
"""
import re
from typing import Dict, Optional

# 가장 강한 구문이 그 API 의 성격을 정한다. 하나라도 쓰기가 있으면 쓰기다.
STRENGTH = {"SELECT": 1, "INSERT": 2, "UPDATE": 3, "DELETE": 4}

_COMMENT = re.compile(r"<!--.*?-->", re.S)
_MAPPER = re.compile(r"<mapper\b([^>]*)>", re.S)
_SQLMAP = re.compile(r"<sqlMap\b([^>]*)>", re.S)
_STMT = re.compile(r"<(select|insert|update|delete)\b([^>]*?)>", re.S | re.I)
_ATTR_ID = re.compile(r"""(?:^|\s)id\s*=\s*(["'])(.*?)\1""", re.S)
_ATTR_NS = re.compile(r"""(?:^|\s)namespace\s*=\s*(["'])(.*?)\1""", re.S)
_SELECT_END = re.compile(r"</select", re.I)
_CDATA = re.compile(r"<!\[CDATA\[|\]\]>")
_TAG = re.compile(r"</?[A-Za-z!][^>]*>")
_SQL_COMMENT = re.compile(r"--[^\n]*|/\*.*?\*/", re.S)
# select 태그 안에서 INSERT/UPDATE/DELETE 를 하는 매퍼가 실제로 있다(프로시저 대신, 복붙 실수). 태그가 아니라 SQL 이 말해 준다.
_WRITE_WORDS = {"INSERT": "INSERT", "UPDATE": "UPDATE", "DELETE": "DELETE", "MERGE": "UPDATE"}

ANNOTATION_KINDS = {
    "Select": "SELECT", "SelectProvider": "SELECT", "Insert": "INSERT", "InsertProvider": "INSERT",
    "Update": "UPDATE", "UpdateProvider": "UPDATE", "Delete": "DELETE", "DeleteProvider": "DELETE",
}


class Stmt:
    __slots__ = ("kind", "ns", "id", "file", "flavor")

    def __init__(self, kind: str, ns: str, id_: str, file: str, flavor: str):
        self.kind, self.ns, self.id, self.file, self.flavor = kind, ns, id_, file, flavor


def _first_sql_word(body: str) -> str:
    body = _CDATA.sub(" ", body)
    body = _TAG.sub(" ", body)
    body = _SQL_COMMENT.sub(" ", body)
    m = re.search(r"[A-Za-z]+", body)
    return m.group().upper() if m else ""


class StatementIndex:
    """구문 이름(`네임스페이스.id`)으로 구문 종류를 찾는다. 키는 대소문자를 가리지 않는다."""

    def __init__(self):
        self._by_key: Dict[str, Stmt] = {}
        self.xml_mybatis = 0          # <mapper> XML 파일 수
        self.xml_ibatis = 0           # <sqlMap> XML 파일 수
        self.annotation = 0           # @Select 등 어노테이션 구문 수
        self.count = 0

    def add_xml(self, rel: str, text: str) -> int:
        """매퍼 XML 한 파일을 읽는다. 매퍼가 아니면 0. 읽은 구문 수를 돌려준다."""
        if "<mapper" not in text and "<sqlMap" not in text:
            return 0
        text = _COMMENT.sub(lambda m: " " * len(m.group()), text)       # 주석 처리된 구문은 없는 것이다
        m = _MAPPER.search(text)
        if m:
            flavor = "mybatis"
            attrs = m.group(1)
        else:
            m = _SQLMAP.search(text)
            if not m:
                return 0
            flavor = "ibatis"
            attrs = m.group(1)
        ns_m = _ATTR_NS.search(attrs)
        ns = ns_m.group(2).strip() if ns_m else ""
        if flavor == "mybatis":
            self.xml_mybatis += 1
        else:
            self.xml_ibatis += 1
        n = 0
        for sm in _STMT.finditer(text, m.end()):
            id_m = _ATTR_ID.search(sm.group(2))
            if not id_m or not id_m.group(2).strip():
                continue
            tag = sm.group(1).lower()
            kind = tag.upper()
            if tag == "select":
                end = _SELECT_END.search(text, sm.end())
                kind = _WRITE_WORDS.get(_first_sql_word(text[sm.end():end.start() if end else len(text)]), "SELECT")
            self._add(Stmt(kind, ns, id_m.group(2).strip(), rel, flavor))
            n += 1
        return n

    def add_annotation(self, fqcn: str, name: str, method: str, kind: str, rel: str, flavor: str = "annotation") -> None:
        """`@Select("...")` 같은 어노테이션 매퍼(MyBatis)나 스프링 데이터 `@Query`(jpa). 네임스페이스는 인터페이스 이름이다."""
        if flavor == "annotation":
            self.annotation += 1
        self._add(Stmt(kind, fqcn, method, rel, flavor))

    def _add(self, st: Stmt) -> None:
        self.count += 1
        keys = []
        if st.ns:
            keys.append("%s.%s" % (st.ns, st.id))
            if "." in st.ns:
                keys.append("%s.%s" % (st.ns.rsplit(".", 1)[-1], st.id))
        if st.flavor == "ibatis" or not st.ns:
            keys.append(st.id)           # iBatis 는 네임스페이스 없이 id 만으로 부르기도 한다
        for k in keys:
            self._by_key.setdefault(k.lower(), st)

    def find(self, key: str) -> Optional[Stmt]:
        return self._by_key.get(key.lower()) if key else None

"""명세(OpenAPI/Swagger, WSDL, 호출 샘플)를 읽어 AI 도구 후보를 만든다."""
import copy
import json
import re
import shlex
import xml.etree.ElementTree as ET
from urllib.parse import parse_qsl, urljoin, urlparse

import yaml

HTTP_METHODS = ('get', 'post', 'put', 'patch', 'delete')
MASK_NAMES = re.compile(r'(phone|mobile|tel|email|eml|mail|ssn|rrn|resident|card|passwd|password)', re.I)


class SpecError(ValueError):
    pass


def snake(s):
    s = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', s or '')
    s = re.sub(r'[^0-9A-Za-z]+', '_', s).strip('_').lower()
    return s or 'tool'


def _sample(schema):
    if not isinstance(schema, dict):
        return 'sample'
    for k in ('example', 'default'):
        if k in schema:
            return schema[k]
    if schema.get('enum'):
        return schema['enum'][0]
    t, f = schema.get('type'), schema.get('format')
    if t == 'integer':
        return 1
    if t == 'number':
        return 1.5
    if t == 'boolean':
        return True
    if t == 'array':
        return [_sample(schema.get('items'))]
    if t == 'object':
        return {k: _sample(v) for k, v in (schema.get('properties') or {}).items()}
    return {'date': '2026-01-01', 'date-time': '2026-01-01T09:00:00+09:00'}.get(f, 'sample')


def _type_label(schema):
    t = (schema or {}).get('type') or 'string'
    f = (schema or {}).get('format')
    return '%s (%s)' % (t, f) if f in ('date', 'date-time') else t


# ---------------------------------------------------------------- OpenAPI
class _Resolver:
    def __init__(self, doc):
        self.doc = doc

    def ref(self, node, depth=0):
        while isinstance(node, dict) and '$ref' in node and depth < 20:
            target = self.doc
            for part in node['$ref'].lstrip('#/').split('/'):
                target = target.get(part.replace('~1', '/').replace('~0', '~'), {}) if isinstance(target, dict) else {}
            node, depth = target, depth + 1
        return node

    def schema(self, node, depth=0):
        """$ref, allOf 를 풀어 하나의 스키마로 만든다."""
        node = self.ref(node)
        if not isinstance(node, dict) or depth > 6:
            return {}
        if 'allOf' in node:
            merged = {'type': 'object', 'properties': {}, 'required': []}
            for part in node['allOf']:
                p = self.schema(part, depth + 1)
                merged['properties'].update(p.get('properties') or {})
                merged['required'] += p.get('required') or []
            return merged
        for k in ('oneOf', 'anyOf'):
            if node.get(k):
                return self.schema(node[k][0], depth + 1)
        out = dict(node)
        if out.get('type') == 'array':
            out['items'] = self.schema(out.get('items'), depth + 1)
        if out.get('properties'):
            out['properties'] = {k: self.schema(v, depth + 1) for k, v in out['properties'].items()}
        return out


def _flatten(schema, prefix='', depth=0, out=None):
    """응답 스키마의 말단 필드를 {경로: 스키마} 로 펼친다. 배열은 [] 로 표시."""
    out = {} if out is None else out
    # 공공데이터포털 표준 봉투(response.body.items[].필드)는 말단이 5단계 아래에 있다 — 4 에서 끊으면 업무 필드가 전부 빠진다
    if len(out) >= 40 or depth > 6:
        return out
    t = schema.get('type')
    if t == 'array':
        return _flatten(schema.get('items') or {}, prefix + '[]', depth + 1, out)
    if t == 'object' or schema.get('properties'):
        for k, v in (schema.get('properties') or {}).items():
            _flatten(v, (prefix + '.' if prefix and not prefix.endswith('[]') else prefix + ('.' if prefix else '')) + k, depth + 1, out)
        return out
    out[prefix or 'value'] = schema
    return out


def _ai_path(origin_path):
    """원본 경로를 AI 쪽 이름(snake_case)으로."""
    return '.'.join(re.sub(r'\w+', lambda m: snake(m.group(0)), seg) for seg in origin_path.split('.'))


DATE_NAME = re.compile(r'(ymd|dt$|date|일자|일$)', re.I)   # fromDt, to_dt, poYmd. 값이 YYYYMMDD 일 때만 날짜로 보므로 이름은 느슨해도 된다
NUM_NAME = re.compile(r'(cnt|count|amt|amount|qty|price|num|total|sum)', re.I)


def _guess_rule(name, sch, example):
    """이름과 예시 값으로 변환 규칙을 추정한다. (레거시 시스템의 YYYYMMDD 날짜, 문자열 숫자)"""
    ex = str(example) if example is not None else ''
    if sch.get('type') in (None, 'string'):
        if MASK_NAMES.search(name):
            return 'mask', 'string'
        if DATE_NAME.search(name) and re.fullmatch(r'\d{8}', ex):
            return 'date', 'string (date)'
        if NUM_NAME.search(name) and re.fullmatch(r'-?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?', ex):
            return 'num', 'number'
    return None, None


def _res_rows(schema, example=None):
    rows = []
    for path, sch in _flatten(schema).items():
        name = path.split('.')[-1].replace('[]', '')
        t = _type_label(sch)
        sample = _sample(sch)
        rule, at = _guess_rule(name, sch, sample)
        a = _ai_path(path)
        row = {'o': path, 'a': a, 'at': at or t, 'ov': str(sample), 'rule': rule or ('name' if a != path else 'keep')}
        rows.append(row)
    return rows


def parse_openapi(doc, spec_url=None, base_override=None):
    r = _Resolver(doc)
    is3 = str(doc.get('openapi', '')).startswith('3')
    if base_override:
        base = base_override.rstrip('/')
    elif is3 and doc.get('servers'):
        base = urljoin(spec_url or '', doc['servers'][0]['url']).rstrip('/')
    elif doc.get('host'):
        base = '%s://%s%s' % ((doc.get('schemes') or ['https'])[0], doc['host'], doc.get('basePath', '')).rstrip('/')
    elif spec_url:
        p = urlparse(spec_url)
        base = '%s://%s' % (p.scheme, p.netloc)
    else:
        raise SpecError('서버 주소를 찾을 수 없습니다. 서버 주소를 직접 입력해 주세요.')

    tools, used = [], set()
    for path, item in (doc.get('paths') or {}).items():
        item = r.ref(item)
        for method in HTTP_METHODS:
            op = item.get(method)
            if not isinstance(op, dict):
                continue
            tid = snake(op.get('operationId') or '%s_%s' % (method, path))
            n, base_id = 2, tid
            while tid in used:
                tid, n = '%s_%d' % (base_id, n), n + 1
            used.add(tid)

            params = []
            for p in (item.get('parameters') or []) + (op.get('parameters') or []):
                p = r.ref(p)
                loc = p.get('in')
                if loc == 'body':
                    sch = r.schema(p.get('schema'))
                    for k, v in (sch.get('properties') or {}).items():
                        params.append(_param(k, 'body', v, k in (sch.get('required') or [])))
                    continue
                sch = r.schema(p.get('schema') or {k: p[k] for k in ('type', 'format', 'enum', 'default', 'items') if k in p})
                if p.get('example') is not None:
                    sch['example'] = p['example']
                loc = 'form' if loc == 'formData' else loc
                if loc not in ('path', 'query', 'header', 'form', 'body'):
                    continue
                params.append(_param(p['name'], loc, sch, bool(p.get('required')) or loc == 'path', p.get('description')))
            body = r.ref(op.get('requestBody') or {})
            for ctype, media in (body.get('content') or {}).items():
                if 'json' in ctype or 'form' in ctype:
                    sch = r.schema(media.get('schema'))
                    for k, v in (sch.get('properties') or {}).items():
                        params.append(_param(k, 'body' if 'json' in ctype else 'form', v, k in (sch.get('required') or [])))
                    break
            params = [p for p in params if p['loc'] != 'header' or p['o'].lower() not in ('authorization', 'content-type', 'accept')]

            res_schema = {}
            responses = op.get('responses') or {}
            ok = next((responses[c] for c in sorted(responses) if str(c).startswith('2')), responses.get('default'))
            ok = r.ref(ok or {})
            if is3:
                media = next((m for c, m in (ok.get('content') or {}).items() if 'json' in c), None)
                res_schema = r.schema((media or {}).get('schema'))
            else:
                res_schema = r.schema(ok.get('schema'))

            mode = 'read' if method == 'get' else 'write'
            title = op.get('summary') or op.get('operationId') or '%s %s' % (method.upper(), path)
            desc = (op.get('description') or op.get('summary') or title).strip()
            tool = {'id': tid, 'method': method.upper(), 'path': path, 'title': title[:80], 'status': 'review', 'mode': mode,
                    'desc': desc[:400], 'params': params, 'res': _res_rows(res_schema)}
            if method == 'delete':
                tool['destructive'] = True
            if mode == 'write':
                tool['confirmQ'] = '%s 작업을 실행할까요?' % title
            tools.append(tool)
    if not tools:
        raise SpecError('명세에서 호출할 수 있는 작업을 찾지 못했습니다.')

    info = doc.get('info') or {}
    return {'name': info.get('title') or '', 'desc': (info.get('description') or '')[:120], 'base': base,
            'spec': ('OpenAPI %s' % doc['openapi']) if is3 else ('Swagger %s' % doc.get('swagger', '2.0'))}, tools[:200]


def _param(name, loc, sch, required, desc=None):
    sch = sch or {}
    t = _type_label(sch)
    ex = _sample(sch)
    p = {'o': name, 'ot': sch.get('type') or 'string', 'a': snake(name), 'at': t, 'loc': loc, 'rule': 'name' if snake(name) != name else 'keep',
         'd': (desc or sch.get('description') or name)[:120], 'ex': ex}
    if DATE_NAME.search(name) and sch.get('type') in (None, 'string') and re.fullmatch(r'\d{8}', str(ex)) and not sch.get('enum'):
        p.update(rule='date', ot='YYYYMMDD', at='string (date)', ax='%s-%s-%s' % (str(ex)[:4], str(ex)[4:6], str(ex)[6:]))
    if required:
        p['req'] = 1
    if sch.get('enum'):
        p['enum'] = sch['enum']
    return p


def parse_spec_text(text, spec_url=None, base_override=None):
    text = text.strip().lstrip('\ufeff')
    try:
        doc = json.loads(text)
    except ValueError:
        try:
            doc = yaml.safe_load(text)
        except yaml.YAMLError as e:
            raise SpecError('명세를 읽을 수 없습니다. JSON 또는 YAML 형식이어야 합니다. (%s)' % str(e)[:80])
    if not isinstance(doc, dict) or not ('openapi' in doc or 'swagger' in doc):
        raise SpecError('OpenAPI(Swagger) 명세가 아닙니다.')
    return parse_openapi(doc, spec_url, base_override)


# ---------------------------------------------------------------- WSDL
_NS = {'wsdl': 'http://schemas.xmlsoap.org/wsdl/', 'xsd': 'http://www.w3.org/2001/XMLSchema',
       'soap': 'http://schemas.xmlsoap.org/wsdl/soap/', 'soap12': 'http://schemas.xmlsoap.org/wsdl/soap12/'}


def _local(tag):
    return tag.rsplit('}', 1)[-1]


def _xsd_fields(el_name, root):
    """xsd:element 이름으로 하위 요소(이름, 타입)를 찾는다."""
    xs = '{%s}' % _NS['xsd']
    for el in root.iter(xs + 'element'):
        if el.get('name') == el_name:
            ct = el.find(xs + 'complexType')
            if ct is None and el.get('type'):
                for c in root.iter(xs + 'complexType'):
                    if c.get('name') == el.get('type').split(':')[-1]:
                        ct = c
            if ct is None:
                return []
            return [(c.get('name'), (c.get('type') or 'xsd:string').split(':')[-1], c.get('minOccurs') != '0')
                    for c in ct.iter(xs + 'element') if c.get('name')]
    return []


def parse_wsdl(text, base_override=None):
    try:
        root = ET.fromstring(text.strip().lstrip('\ufeff').encode('utf-8'))
    except ET.ParseError as e:
        raise SpecError('WSDL을 읽을 수 없습니다. (%s)' % e)
    if _local(root.tag) != 'definitions':
        raise SpecError('WSDL 문서가 아닙니다.')
    tns = root.get('targetNamespace', '')
    messages = {m.get('name'): [(p.get('element') or p.get('type') or '').split(':')[-1] for p in m.findall('wsdl:part', _NS)]
                for m in root.findall('wsdl:message', _NS)}
    addr = None
    for port in root.iter('{%s}port' % _NS['wsdl']):
        for child in port:
            if _local(child.tag) == 'address' and child.get('location'):
                addr = child.get('location')
    base = base_override or addr
    if not base:
        raise SpecError('WSDL에서 서비스 주소를 찾지 못했습니다. 서버 주소를 직접 입력해 주세요.')

    actions = {}
    for b in root.findall('wsdl:binding', _NS):
        for op in b.findall('wsdl:operation', _NS):
            for child in op:
                if _local(child.tag) == 'operation':
                    actions[op.get('name')] = child.get('soapAction', '')
    tools = []
    for pt in root.findall('wsdl:portType', _NS):
        for op in pt.findall('wsdl:operation', _NS):
            name = op.get('name')
            inp, out = op.find('wsdl:input', _NS), op.find('wsdl:output', _NS)
            in_el = (messages.get((inp.get('message') or '').split(':')[-1]) or [name])[0] if inp is not None else name
            out_el = (messages.get((out.get('message') or '').split(':')[-1]) or [name + 'Response'])[0] if out is not None else name + 'Response'
            params = [{'o': n, 'ot': 'string(%s)' % t, 'a': snake(n), 'at': 'integer' if t in ('int', 'integer', 'long') else 'number' if t in ('decimal', 'double', 'float') else 'boolean' if t == 'boolean' else 'string',
                       'loc': 'soap', 'rule': 'name', 'd': n, 'ex': 1 if t in ('int', 'integer', 'long') else 'sample', **({'req': 1} if req else {})}
                      for n, t, req in _xsd_fields(in_el, root)]
            res = [{'o': n, 'a': snake(n), 'at': 'number' if t in ('int', 'integer', 'long', 'decimal', 'double', 'float') else 'string',
                    'ov': 'sample', 'rule': 'num' if t in ('int', 'integer', 'long', 'decimal', 'double', 'float') else 'name'}
                   for n, t, _ in _xsd_fields(out_el, root)]
            write = bool(re.match(r'(create|update|delete|cancel|insert|save|req|submit|approve|set|add|remove)', name, re.I))
            tool = {'id': snake(name), 'op': name, 'soapAction': actions.get(name, ''), 'inEl': in_el, 'outEl': out_el, 'title': name,
                    'status': 'review', 'mode': 'write' if write else 'read', 'desc': '%s 작업을 수행합니다.' % name, 'params': params, 'res': res}
            if write:
                tool['confirmQ'] = '%s 작업을 실행할까요?' % name
            tools.append(tool)
    if not tools:
        raise SpecError('WSDL에서 오퍼레이션을 찾지 못했습니다.')
    return {'name': root.get('name') or '', 'desc': 'SOAP 서비스', 'base': base, 'ns': tns, 'spec': 'WSDL (SOAP 1.1)'}, tools


# ---------------------------------------------------------------- 호출 샘플
def parse_sample(request_text, response_text, base_override=None):
    request_text = (request_text or '').strip()
    if not request_text:
        raise SpecError('요청 샘플을 입력해 주세요.')
    text = request_text.replace('\\\n', ' ')
    method, url, body = 'GET', None, None
    if text.lower().startswith('curl'):
        toks = shlex.split(text)
        i = 1
        while i < len(toks):
            t = toks[i]
            if t in ('-X', '--request'):
                method, i = toks[i + 1].upper(), i + 1
            elif t in ('-d', '--data', '--data-raw', '--data-binary'):
                body, i = toks[i + 1], i + 1
                if method == 'GET':
                    method = 'POST'
            elif t in ('-H', '--header', '-u', '--user'):
                i += 1
            elif t.startswith('http'):
                url = t
            i += 1
    else:
        m = re.match(r'(GET|POST|PUT|PATCH|DELETE)\s+(\S+)', text)
        if not m:
            raise SpecError('curl 명령이나 "METHOD URL" 형식으로 입력해 주세요.')
        method, url = m.group(1), m.group(2)
    if not url:
        raise SpecError('요청 URL을 찾을 수 없습니다.')
    pu = urlparse(url)
    base = base_override or '%s://%s' % (pu.scheme, pu.netloc)
    params = []
    for k, v in parse_qsl(pu.query):
        params.append({'o': k, 'ot': 'string', 'a': snake(k), 'at': 'string', 'loc': 'query', 'rule': 'name' if snake(k) != k else 'keep', 'd': k, 'ex': v})
    if body:
        try:
            for k, v in json.loads(body).items():
                params.append({'o': k, 'ot': type(v).__name__, 'a': snake(k), 'at': 'number' if isinstance(v, (int, float)) else 'string', 'loc': 'body',
                               'rule': 'name' if snake(k) != k else 'keep', 'd': k, 'ex': v})
        except (ValueError, AttributeError):
            for k, v in parse_qsl(body):
                params.append({'o': k, 'ot': 'string', 'a': snake(k), 'at': 'string', 'loc': 'form', 'rule': 'name' if snake(k) != k else 'keep', 'd': k, 'ex': v})
    res = []
    if response_text and response_text.strip():
        try:
            sample = json.loads(response_text)
        except ValueError:
            raise SpecError('응답 샘플은 JSON이어야 합니다.')
        schema = _schema_of(sample)
        res = _res_rows(schema)
        for row in res:
            row['guess'] = 1
    seg = [s for s in pu.path.split('/') if s]
    tid = snake('_'.join(seg[-2:]) or 'call')
    tool = {'id': tid, 'method': method, 'path': pu.path or '/', 'title': '%s %s' % (method, pu.path or '/'), 'status': 'review',
            'mode': 'read' if method == 'GET' else 'write', 'desc': '%s %s 를 호출합니다.' % (method, pu.path or '/'), 'params': params, 'res': res, 'guess': 1}
    return {'name': pu.netloc, 'desc': '호출 샘플로 추론한 시스템', 'base': base, 'spec': '호출 샘플로 추론'}, [tool]


def _schema_of(v):
    if isinstance(v, dict):
        return {'type': 'object', 'properties': {k: _schema_of(x) for k, x in v.items()}}
    if isinstance(v, list):
        return {'type': 'array', 'items': _schema_of(v[0]) if v else {}}
    t = 'boolean' if isinstance(v, bool) else 'integer' if isinstance(v, int) else 'number' if isinstance(v, float) else 'string'
    return {'type': t, 'example': v}


# ---------------------------------------------------------------- 공공데이터포털 프리셋
GOV_PRESETS = {
    'holi': {
        'name': '특일 정보', 'desc': '공공데이터포털 한국천문연구원 특일 정보 (공휴일, 기념일, 24절기)',
        'base': 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService',
        'tools': [
            ('get_public_holidays', 'getRestDeInfo', '공휴일 조회', '연도와 월로 그달의 공휴일 날짜와 이름을 조회합니다. 쉬는 날, 연휴를 물을 때 사용합니다.'),
            ('get_anniversaries', 'getAnniversaryInfo', '기념일 조회', '연도와 월로 그달의 기념일을 조회합니다.'),
            ('get_solar_terms', 'get24DivisionsInfo', '24절기 조회', '연도와 월로 그달의 24절기 날짜를 조회합니다.'),
        ],
    },
}


# 조달청 나라장터 오픈API — 활용가이드(입찰공고 1.2, 낙찰 1.2, 계약 1.0, 물품목록 1.2) 기준.
# 응답 봉투: response.body.items[] , 값은 전부 문자열, 일시 'YYYY-MM-DD HH:MM:SS'. 조회일시는 YYYYMMDDHHMM, 등록일시 범위 최대 1개월.
_PPS_COMMON = [
    {'o': 'pageNo', 'ot': 'int', 'loc': 'query', 'rule': 'inject', 'd': '첫 페이지', 'ex': '1', 'v': '1'},
    {'o': 'type', 'ot': 'string', 'loc': 'query', 'rule': 'inject', 'd': '응답 형식을 JSON으로 고정', 'ex': 'json', 'v': 'json'},
    {'o': 'numOfRows', 'ot': 'int', 'a': 'limit', 'at': 'integer', 'loc': 'query', 'rule': 'num', 'd': '가져올 건수 (기본 10)', 'ex': '10', 'ax': 10},
]
_PPS_RANGE = [
    {'o': 'inqryBgnDt', 'ot': 'YYYYMMDDHHMM', 'a': 'from', 'at': 'string (date)', 'loc': 'query', 'req': 1, 'rule': 'date',
     'd': '조회 시작일 (등록일시 기준, 끝일과 최대 1개월)', 'ex': '202609010000', 'ax': '2026-09-01'},
    {'o': 'inqryEndDt', 'ot': 'YYYYMMDDHHMM', 'a': 'to', 'at': 'string (date)', 'loc': 'query', 'req': 1, 'rule': 'date', 'end': 1,
     'd': '조회 종료일', 'ex': '202609302359', 'ax': '2026-09-30'},
]


def _items(*cols):
    out = []
    for o, a, d, rule in cols:
        r = {'o': 'response.body.items[].%s' % o, 'a': 'items[].%s' % a, 'at': 'number' if rule == 'num' else 'string', 'ov': '', 'rule': rule, 'd': d}
        out.append(r)
    return out


_BID_RES = _items(('bidNtceNo', 'notice_no', '입찰공고번호', 'keep'), ('bidNtceOrd', 'notice_order', '입찰공고차수', 'keep'),
                  ('bidNtceNm', 'title', '입찰공고명', 'name'), ('ntceInsttNm', 'notice_agency', '공고기관명', 'name'),
                  ('dminsttNm', 'demand_agency', '수요기관명', 'name'), ('presmptPrce', 'estimated_price', '추정가격(원)', 'num'),
                  ('cntrctCnclsMthdNm', 'contract_method', '계약체결방법', 'name'), ('bidClseDt', 'bid_close_at', '입찰마감일시', 'name'),
                  ('opengDt', 'opening_at', '개찰일시', 'name'), ('bidNtceDtlUrl', 'detail_url', '공고 상세 주소', 'name'))
PPS_PRESETS = {
    'pps_bid': {'name': '조달청 나라장터 입찰공고정보', 'desc': '공공데이터포털 조달청_나라장터 입찰공고정보서비스 (물품)',
                'base': 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService', 'tools': [
        {'id': 'search_pps_bid_notices', 'op': 'getBidPblancListInfoThng', 'title': '물품 입찰공고 목록 조회',
         'desc': '기간을 주면 그 사이 등록된 물품 입찰공고를 조회합니다. 기간은 최대 1개월입니다.',
         'params': [{'o': 'inqryDiv', 'ot': 'string', 'loc': 'query', 'rule': 'inject', 'd': '조회구분 1(등록일시)', 'ex': '1', 'v': '1'}] + _PPS_RANGE + _PPS_COMMON,
         'res': _BID_RES},
        {'id': 'get_pps_bid_notice', 'op': 'getBidPblancListInfoThng', 'title': '입찰공고번호로 공고 조회',
         'desc': '입찰공고번호(예: R26BK01234567)로 공고 한 건과 변경 차수를 조회합니다.',
         'params': [{'o': 'inqryDiv', 'ot': 'string', 'loc': 'query', 'rule': 'inject', 'd': '조회구분 2(입찰공고번호)', 'ex': '2', 'v': '2'},
                    {'o': 'bidNtceNo', 'ot': 'string(13)', 'a': 'notice_no', 'at': 'string', 'loc': 'query', 'req': 1, 'rule': 'name', 'd': '입찰공고번호 13자리', 'ex': 'R26BK01234567'}] + _PPS_COMMON,
         'res': _BID_RES}]},
    'pps_scsbid': {'name': '조달청 나라장터 낙찰정보', 'desc': '공공데이터포털 조달청_나라장터 낙찰정보서비스 (물품)',
                   'base': 'https://apis.data.go.kr/1230000/as/ScsbidInfoService', 'tools': [
        {'id': 'get_pps_award', 'op': 'getScsbidListSttusThng', 'title': '입찰공고번호로 낙찰 결과 조회',
         'desc': '입찰공고번호로 최종 낙찰업체, 낙찰금액, 낙찰률, 참가업체 수를 조회합니다.',
         'params': [{'o': 'inqryDiv', 'ot': 'string', 'loc': 'query', 'rule': 'inject', 'd': '조회구분 4(입찰공고번호)', 'ex': '4', 'v': '4'},
                    {'o': 'bidNtceNo', 'ot': 'string(13)', 'a': 'notice_no', 'at': 'string', 'loc': 'query', 'req': 1, 'rule': 'name', 'd': '입찰공고번호', 'ex': 'R26BK01234567'}] + _PPS_COMMON,
         'res': _items(('bidNtceNo', 'notice_no', '입찰공고번호', 'keep'), ('bidwinnrNm', 'winner', '최종낙찰업체명', 'name'),
                       ('sucsfbidAmt', 'award_amount', '최종낙찰금액(원)', 'num'), ('sucsfbidRate', 'award_rate', '최종낙찰률(%)', 'num'),
                       ('prtcptCnum', 'bidders', '참가업체수', 'num'), ('rlOpengDt', 'opened_at', '실개찰일시', 'name'))}]},
    'pps_cntrct': {'name': '조달청 나라장터 계약정보', 'desc': '공공데이터포털 조달청_나라장터 계약정보서비스 (물품)',
                   'base': 'https://apis.data.go.kr/1230000/ao/CntrctInfoService', 'tools': [
        {'id': 'search_pps_contracts', 'op': 'getCntrctInfoListThng', 'title': '물품 계약 목록 조회',
         'desc': '기간을 주면 그 사이 등록된 물품 계약을 조회합니다. 업체·수요기관은 ^ 로 구분된 목록 문자열로 옵니다.',
         'params': [{'o': 'inqryDiv', 'ot': 'string', 'loc': 'query', 'rule': 'inject', 'd': '조회구분 1(등록일시)', 'ex': '1', 'v': '1'}] + _PPS_RANGE + _PPS_COMMON,
         'res': _items(('untyCntrctNo', 'contract_no', '통합계약번호', 'keep'), ('cntrctNm', 'title', '계약명', 'name'),
                       ('cntrctCnclsDate', 'signed_on', '계약체결일자', 'date'), ('totCntrctAmt', 'total_amount', '총계약금액(원)', 'num'),
                       ('cntrctInsttNm', 'contract_agency', '계약기관명', 'name'), ('corpList', 'companies', '계약업체 목록 문자열', 'name'))}]},
    'pps_thng': {'name': '조달청 물품목록정보', 'desc': '공공데이터포털 조달청_물품목록정보서비스',
                 'base': 'https://apis.data.go.kr/1230000/ao/ThngListInfoService02', 'tools': [
        {'id': 'search_pps_items', 'op': 'getThngPrdnmLocplcAccotListInfoInfoPrdlstSearch02', 'title': '품명으로 물품 조회',
         'desc': '품명으로 물품분류번호(8자리)와 물품식별번호(8자리), 제조사를 조회합니다.',
         'params': [{'o': 'prdctClsfcNoNm', 'ot': 'string', 'a': 'item_name', 'at': 'string', 'loc': 'query', 'req': 1, 'rule': 'name', 'd': '품명', 'ex': '사무용의자'}] + _PPS_COMMON,
         'res': _items(('prdctClsfcNo', 'class_no', '물품분류번호 8자리', 'keep'), ('prdctIdntNo', 'item_id', '물품식별번호 8자리', 'keep'),
                       ('prdctClsfcNoNm', 'item_name', '품명', 'name'), ('krnPrdctNm', 'korean_name', '한글품목명', 'name'),
                       ('mnfctCorpNm', 'maker', '제조업체명', 'name'))}]},
}


def gov_preset(key):
    if key in PPS_PRESETS:
        p = PPS_PRESETS[key]
        tools = [dict(t, method='GET', path='/' + t['op'], status='review', mode='read') for t in p['tools']]
        return {'name': p['name'], 'desc': p['desc'], 'base': p['base'], 'spec': '공공데이터포털 OpenAPI (조달청 활용가이드)'}, copy.deepcopy(tools)
    p = GOV_PRESETS.get(key)
    if not p:
        raise SpecError('지원하지 않는 공공데이터 API입니다.')
    tools = []
    for tid, op, title, desc in p['tools']:
        tools.append({
            'id': tid, 'op': op, 'method': 'GET', 'path': '/' + op, 'title': title, 'status': 'review', 'mode': 'read', 'desc': desc,
            'params': [
                {'o': 'solYear', 'ot': 'YYYY', 'a': 'year', 'at': 'integer', 'loc': 'query', 'req': 1, 'rule': 'num', 'd': '연도', 'ex': '2026', 'ax': 2026},
                {'o': 'solMonth', 'ot': 'MM', 'a': 'month', 'at': 'integer', 'loc': 'query', 'rule': 'pad', 'd': '월, 두 자리로 맞춰 전달', 'ex': '10', 'ax': 10},
                {'o': '_type', 'ot': 'string', 'loc': 'query', 'rule': 'inject', 'd': '응답 형식을 JSON으로 고정', 'ex': 'json', 'v': 'json'},
            ],
            'res': [
                {'o': 'response.body.items.item[].locdate', 'a': 'days[].date', 'at': 'string (date)', 'ov': '20261009', 'av': '2026-10-09', 'rule': 'date'},
                {'o': 'response.body.items.item[].dateName', 'a': 'days[].name', 'at': 'string', 'ov': '한글날', 'rule': 'name'},
                {'o': 'response.body.items.item[].isHoliday', 'a': 'days[].is_day_off', 'at': 'boolean', 'ov': 'Y', 'av': True, 'rule': 'code',
                 'codes': [['Y', True, '쉬는 날'], ['N', False, '평일']]},
            ],
        })
    return {'name': p['name'], 'desc': p['desc'], 'base': p['base'], 'spec': '공공데이터포털 OpenAPI'}, tools

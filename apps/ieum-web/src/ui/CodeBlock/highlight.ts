// 코드 강조 — 옛 hlJSON · hlXML · hlHTTP(js/common/convert.js:137-158)를 원문 위에서 같은 경계로 나눈다.
// 옛은 이스케이프한 글(&quot; · &lt; · &amp;) 위에서 정규식을 돌렸다 — 여기서는 그 엔티티를 원문 글자(" · < · &)로 바꾼 같은 정규식을 쓴다.
// 결과는 글 조각과 강조 조각의 트리이고, 그리기(React 노드)는 CodeBlock이 한다(dangerouslySetInnerHTML 없음)
import type { TraceCode } from '@/app/trace/types';

/** 강조 종류 → 색 토큰(CodeBlock.module.css). 옛 클래스 k · s · n · b · t · a · c · m */
export type CodeTokenKind = 'key' | 'string' | 'number' | 'literal' | 'tag' | 'comment' | 'method';

/** 글 조각 또는 강조 조각. 강조 조각 안에 또 강조가 들어갈 수 있다(XML 주석 안의 태그 — 옛도 겹쳐 칠했다) */
export type CodeSegment = string | Readonly<{ kind: CodeTokenKind; parts: readonly CodeSegment[] }>;

const token = (kind: CodeTokenKind, ...parts: CodeSegment[]): CodeSegment => ({ kind, parts });
const asText = (text: string): CodeSegment[] => (text ? [text] : []);
/** 반드시 잡히는 무리의 글(정규식 모양상 늘 있다 — 타입만 좁힌다) */
const group = (match: RegExpExecArray, index: number): string => match[index] ?? '';

/** g 정규식으로 글을 훑어 맞은 자리는 onMatch로, 사이 글은 between으로 바꾼다(옛 String.replace와 같은 훑기) */
function splitBy(
  text: string,
  pattern: RegExp,
  onMatch: (match: RegExpExecArray) => CodeSegment[],
  between: (text: string) => CodeSegment[] = asText,
): CodeSegment[] {
  const matches = [...text.matchAll(pattern)];
  const ends = matches.map((m) => m.index + m[0].length);
  const pieces = matches.flatMap((m, i) => [...between(text.slice(i === 0 ? 0 : ends[i - 1], m.index)), ...onMatch(m)]);
  return [...pieces, ...between(text.slice(matches.length === 0 ? 0 : ends[ends.length - 1]))];
}

// ── JSON — 키(뒤에 :) · 문자열 · 수 · true false null. 문자열은 첫 "에서 끝난다(옛 &quot; 경계 그대로) ──
const JSON_TOKEN = /("[^"]*")(\s*:)?|(-?\b\d+(?:\.\d+)?\b)|\b(true|false|null)\b/g;

export const highlightJson = (text: string): CodeSegment[] =>
  splitBy(text, JSON_TOKEN, (match) => {
    const [, str, colon, num] = match;
    if (str !== undefined) return colon !== undefined ? [token('key', str), colon] : [token('string', str)];
    return num !== undefined ? [token('number', num)] : [token('literal', group(match, 4))];
  });

// ── XML — 주석을 먼저 나누고, 주석 안팎 모두에서 태그 · 속성을 칠한다(옛은 주석 span 안의 태그도 다시 칠했다) ──
const XML_COMMENT = /<!--[\s\S]*?-->/g;
const XML_TAG = /(<\/?)([\w:.-]+)((?:\s+[\w:.-]+=".*?")*)(\s*\/?>)/g;
const XML_ATTR = /([\w:.-]+)=(".*?")/g;

const highlightAttrs = (attrs: string): CodeSegment[] =>
  splitBy(attrs, XML_ATTR, (match) => [token('key', group(match, 1)), '=', token('string', group(match, 2))]);

const highlightTags = (text: string): CodeSegment[] =>
  splitBy(text, XML_TAG, (match) => [
    token('tag', group(match, 1) + group(match, 2)),
    ...highlightAttrs(group(match, 3)),
    token('tag', group(match, 4)),
  ]);

export const highlightXml = (text: string): CodeSegment[] =>
  splitBy(text, XML_COMMENT, (match) => [token('comment', ...highlightTags(group(match, 0)))], highlightTags);

// ── HTTP — 처음 나오는 빈 줄에서 머리 · 본문. 머리 첫 줄은 메서드(또는 HTTP/1.1), 이어진 쿼리 줄은 쿼리 키, 그 밖은 헤더 이름 ──
const HEAD_BODY_GAP = '\n\n';
const LINE_BREAK = '\n';
const START_LINE = /^(GET|POST|PUT|PATCH|DELETE|HTTP\/1\.1)(\s)/;
const QUERY_KEY = /(\?|&)(\w+)=/g;
const QUERY_LINE = /^\s+(\?|&)/;
const HEADER_NAME = /^([\w-]+):/;

const highlightQuery = (line: string): CodeSegment[] =>
  splitBy(line, QUERY_KEY, (match) => [group(match, 1), token('key', group(match, 2)), '=']);

function highlightHeadLine(line: string, index: number): CodeSegment[] {
  if (index === 0) {
    const start = START_LINE.exec(line);
    if (!start) return highlightQuery(line);
    const method = group(start, 1);
    return [token('method', method), ...highlightQuery(line.slice(method.length))];
  }
  if (QUERY_LINE.test(line)) return highlightQuery(line);
  const header = HEADER_NAME.exec(line);
  if (!header) return asText(line);
  const name = group(header, 1);
  return [token('key', name), ...asText(line.slice(name.length))];
}

const highlightBody = (body: string, lang: TraceCode['bodyLang']): CodeSegment[] => {
  if (lang === 'xml') return highlightXml(body);
  if (lang === 'json') return highlightJson(body);
  return asText(body);
};

/** 본문이 빈 글이면 머리만 그린다 — 글 끝의 빈 줄도 옛처럼 그리지 않는다 */
export function highlightHttp(text: string, bodyLang: TraceCode['bodyLang']): CodeSegment[] {
  const gap = text.indexOf(HEAD_BODY_GAP);
  const head = gap < 0 ? text : text.slice(0, gap);
  const body = gap < 0 ? '' : text.slice(gap + HEAD_BODY_GAP.length);
  const headParts = head
    .split(LINE_BREAK)
    .flatMap((line, index) => [...(index > 0 ? [LINE_BREAK] : []), ...highlightHeadLine(line, index)]);
  return body ? [...headParts, HEAD_BODY_GAP, ...highlightBody(body, bodyLang)] : headParts;
}

/** 언어별 강조. plain은 나누지 않는다 */
export function highlightCode({ text, lang, bodyLang }: TraceCode): CodeSegment[] {
  switch (lang) {
    case 'json':
      return highlightJson(text);
    case 'xml':
      return highlightXml(text);
    case 'http':
      return highlightHttp(text, bodyLang);
    case 'plain':
      return asText(text);
  }
}

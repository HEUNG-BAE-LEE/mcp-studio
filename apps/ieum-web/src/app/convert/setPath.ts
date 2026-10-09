// 점 경로(`a.b[].c`)에 값을 넣은 새 객체 — 옛 setPath(js/common/convert.js:29-37)는 객체를 고쳤고, 여기는 지나는 칸마다 새로 만든다.
// 결과를 JSON으로 바꾼 글자가 옛과 같아야 한다(원본 응답 · AI 결과 미리보기):
// - 있는 키는 제자리에서 값만 바뀌고(키 순서 유지) 새 키는 끝에 붙는다 — 옛 대입과 같다
// - `[]` 칸은 배열의 첫 칸으로 들어간다. 마지막 칸이 `[]`면 [값]으로 덮는다
// - 지나는 칸의 값이 거짓(null · 0 · '')이면 빈 객체([] 칸이면 [{}])로 바꾸고, 참인 원시값이면 그대로 둔다
//   (옛은 비엄격 모드 스크립트라 원시값에 속성을 넣어도 아무 일이 없었다)
// - 옛이 예외로 멈추던 자리(undefined · null 안으로 들어감)는 그 칸을 그대로 둔다
type JsonRecord = Readonly<Record<string, unknown>>;

const ARRAY_MARK = '[]';
const FIRST = '0';

const isObjectLike = (value: unknown): value is object => typeof value === 'object' && value !== null;

/** 옛 `cur[k]`와 같은 읽기(상속 속성 포함). 원시값의 속성도 읽는다 */
const readKey = (container: unknown, key: string): unknown =>
  container === null || container === undefined ? undefined : (Object(container) as Record<string, unknown>)[key];

/** 옛 `cur[k] = v`를 사본에 한다. 객체 · 배열이 아니면(원시값 · 함수) 그대로 */
function assignKey(container: unknown, key: string, value: unknown): unknown {
  if (Array.isArray(container)) return Object.assign([...(container as readonly unknown[])], { [key]: value });
  if (isObjectLike(container)) return Object.assign({ ...container }, { [key]: value });
  return container;
}

function setIn(container: unknown, parts: readonly string[], value: unknown): unknown {
  const [part, ...rest] = parts;
  if (part === undefined || container === null || container === undefined) return container;
  const isArray = part.endsWith(ARRAY_MARK);
  const key = isArray ? part.slice(0, -ARRAY_MARK.length) : part;
  const existing = readKey(container, key);
  return assignKey(container, key, childOf(existing, isArray, rest, value));
}

function childOf(existing: unknown, isArray: boolean, rest: readonly string[], value: unknown): unknown {
  if (rest.length === 0) return isArray ? [value] : value;
  if (!isArray) return setIn(existing || {}, rest, value);
  const list = existing || [{}];
  return assignKey(list, FIRST, setIn(readKey(list, FIRST), rest, value));
}

/** path의 칸마다 새 객체를 만들어 value를 넣은 결과. target은 고치지 않는다 */
export const setPath = (target: JsonRecord, path: string, value: unknown): JsonRecord =>
  setIn(target, path.split('.'), value) as JsonRecord;

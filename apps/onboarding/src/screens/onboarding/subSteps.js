/**
 * 연결 단계의 작은 스텝 목록 — 고른 채널에서 스텝 배열을 만든다.
 *
 * JSX 파일에서 떼어낸 이유는 검증 때문이다. 이 계산이 틀리면 "다음" 을 눌러도 화면이 안
 * 넘어가는 것처럼 보이는데, 그건 눈으로 잡기 어렵고 잡아도 원인이 여기라는 걸 알기 어렵다.
 * 순수 함수라 파일만 옮기면 node --test 로 바로 확인된다.
 *
 * `titles` 를 인자로 받는 이유도 같다. sources.jsx 에서 직접 가져오면 JSX 를 import 하게
 * 되고, 그 순간 테스트에서 못 부른다.
 */

/** 클라우드는 채널이 둘이지만 스텝은 하나다. */
const CLOUD = ["cloud", "clouddb"];

/**
 * @param {string[]} selected  고른 채널 id 목록
 * @param {Record<string,string>} titles  채널 id → 사람이 읽을 이름
 * @returns {{id: string, label: string}[]}
 */
export function buildSubSteps(selected, titles = {}) {
  const steps = [{ id: "pick", label: "무엇을 연결할까" }];
  let cloudAdded = false;
  for (const id of selected) {
    // 구독을 훑는 일은 한 번이고 결과만 API·DB 로 갈린다. 스텝까지 둘로 두면 같은 화면이
    // 연달아 두 번 나와서, 넘어가도 안 넘어간 것처럼 보이고 버튼을 두 번 누르게 된다.
    if (CLOUD.includes(id)) {
      if (cloudAdded) continue;
      cloudAdded = true;
      steps.push({ id: "in:cloud", label: "클라우드 확인" });
      continue;
    }
    steps.push({ id: `in:${id}`, label: `${titles[id] || id} 입력` });
  }
  // 아무것도 안 골랐으면 "함께 읽기" 도 없다 — 읽을 것이 없는데 실행 스텝만 남으면
  // 다음 버튼이 빈 화면으로 데려간다.
  if (selected.length) steps.push({ id: "run", label: "함께 읽기" });
  return steps;
}

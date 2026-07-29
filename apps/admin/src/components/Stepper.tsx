// 5단계 중 ①②는 확장 프로그램에서 일어나며 관리자 화면이 아니다. 세션이
// 존재한다는 것 자체가 두 단계를 거쳤다는 뜻이므로 항상 완료로 표시한다.
//
// 수집 방식이 달라도 **뼈대는 하나**로 둔다. 앞 세 단계의 라벨만 맥락에 맞게
// 바꾸고 뒤 두 단계는 글자까지 같다 — 사용자가 "수집 방식만 다르고 그 다음은
// 똑같다"를 화면에서 학습하게 하려는 것이다. 방식마다 다른 진행 표시를 만들면
// 도구가 두 개인 것처럼 읽힌다.
const STEPS_BY_KIND: Record<string, string[]> = {
  traffic: ["기록 시작", "클릭 기록", "API 분석", "액션 생성", "테스트"],
  portal: ["페이지 열기", "명세 감지", "명세 파싱", "액션 생성", "테스트"],
  document: ["문서 업로드", "텍스트 추출", "구조화", "액션 생성", "테스트"],
};

export default function Stepper({ current, kind = "traffic" }: { current: number; kind?: string }) {
  const steps = STEPS_BY_KIND[kind] ?? STEPS_BY_KIND.traffic;
  return (
    <section className="stepper" aria-label="작업 단계">
      {steps.map((label, index) => (
        <div
          key={label}
          className={`${index === current ? "current" : ""} ${index < current ? "done" : ""}`}
        >
          <span>{index < current ? "✓" : index + 1}</span>
          <div>
            <small>STEP {index + 1}</small>
            <strong>{label}</strong>
          </div>
        </div>
      ))}
    </section>
  );
}

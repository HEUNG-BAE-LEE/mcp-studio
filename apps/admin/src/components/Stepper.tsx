// 5단계 중 ①기록 시작과 ②클릭 기록은 확장 프로그램에서 일어나며 관리자
// 화면이 아니다. 세션이 존재한다는 것 자체가 두 단계를 거쳤다는 뜻이므로
// 항상 완료로 표시한다.
const STEPS = ["기록 시작", "클릭 기록", "API 분석", "액션 생성", "테스트"];

export default function Stepper({ current }: { current: number }) {
  return (
    <section className="stepper" aria-label="작업 단계">
      {STEPS.map((label, index) => (
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

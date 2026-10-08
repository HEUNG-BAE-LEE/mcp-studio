import React from "react";
// framer-motion 은 motion 패키지로 개명됐다 — 이 레포는 motion 만 설치한다(package.json).
import { motion, useReducedMotion } from "motion/react";

/**
 * 로딩 스피너 — 회전하는 점 5개. 선두가 가장 진하고 뒤로 갈수록 흐려져 꼬리를 만든다.
 *
 * 앱의 유일한 로딩 표시다. 예전엔 화면마다 테두리 링 스피너를 따로 만들어 굵기·색·속도가
 * 제각각이었다(#496). 새 로딩 표시가 필요하면 CSS 를 새로 짜지 말고 이걸 쓴다.
 *
 * 지정 디자인은 Tailwind 기준(w-10 h-10 컨테이너 / w-2 h-2 점)이었는데 이 저장소엔
 * Tailwind 가 없어 인라인 스타일 + 앱 토큰으로 옮겼다. 비율(점 = 컨테이너의 1/5)과
 * 모션(1.5s easeInOut, 0.1s 스태거)은 그대로다. easeInOut + 스태거라 점들이 양 끝에서
 * 모였다 가운데서 벌어지는데, 그 수축·이완이 이 스피너의 인상이다.
 *
 * @param size   컨테이너 한 변(px). 버튼 안 12~15, 패널 로딩 26~40.
 * @param color  선두 점 색. 기본은 부모 글자색을 따라간다.
 * @param trail  꼬리 점 색. 기본은 선두색을 옅게 섞는다.
 */
export default function TrailingDots({ size = 40, color = "currentColor", trail, label = "불러오는 중" }) {
  // 작은 크기에서 1/5 비율을 그대로 쓰면 점이 2px 대로 내려가 회전이 안 읽힌다.
  // 버튼 안에서도 형태가 남도록 하한을 둔다.
  const dot = Math.max(3, Math.round(size * 0.2));
  const tail = trail || `color-mix(in srgb, ${color} 42%, transparent)`;
  // 회전을 멈추면 점 5개가 한 자리에 겹쳐 사라진 것처럼 보인다. 대신 호로 펼쳐 세워둔다.
  const still = useReducedMotion();

  return (
    <span
      role="status"
      aria-label={label}
      style={{ position: "relative", display: "inline-block", width: size, height: size, flexShrink: 0 }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.span
          key={i}
          /* rotate 를 style 에 두면 정적 값이 모션 값을 눌러 회전이 아예 안 걸린다.
             각도는 initial/animate 로만 준다. */
          style={{ position: "absolute", inset: 0, display: "block" }}
          initial={{ rotate: still ? i * 26 : 0 }}
          animate={still ? { rotate: i * 26 } : { rotate: 360 }}
          transition={still ? { duration: 0 }
            : { duration: 1.5, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
        >
          <span
            style={{
              position: "absolute", top: 0, left: "50%", marginLeft: -dot / 2,
              width: dot, height: dot, borderRadius: "50%",
              background: i === 0 ? color : tail,
              opacity: 1 - i * 0.2,
            }}
          />
        </motion.span>
      ))}
    </span>
  );
}

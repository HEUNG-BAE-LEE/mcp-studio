// 카탈로그 RuleChip 절 — 분류 넷(name · convert · inject · mask) × 설명 툴팁 유무, 규칙 17종 전부(앱 층 ruleChips)와 고정 칩 둘
import { RuleChip } from '../../ui';
import { AUTH_INJECT_CHIP, NAME_FALLBACK_CHIP, ruleChips } from '../../app/trace/ruleChip';
import { RULES } from '../../copy/trace';
import catalog from './catalog.module.css';

const ALL_RULES = ruleChips(Object.keys(RULES));

export function RuleChipSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        알약 · 고유 높이 20. 색은 분류(category)가 정한다. 설명(description)이 있을 때만 마우스 툴팁(title)과 도움말 커서가
        있다 — 고정 &quot;이름 정리&quot; 칩은 없다. 상태는 없다.
      </p>

      <h3 className={catalog.heading}>category × 설명 유무</h3>
      <div className={catalog.row}>
        <RuleChip label="이름 정리" category="name" description="원본 필드 이름을 AI가 이해하기 쉬운 이름으로 바꿉니다" />
        <RuleChip label="날짜 형식" category="convert" description="YYYYMMDD, epoch 같은 원본 형식과 ISO 8601 날짜를 서로 바꿉니다" />
        <RuleChip label="자동 주입" category="inject" description="AI에게 보이지 않고 이음이 설정값을 넣어 보냅니다" />
        <RuleChip label="마스킹" category="mask" description="개인정보 일부를 가려서 AI에 전달합니다" />
      </div>
      <div className={catalog.row}>
        <RuleChip label="이름 정리" category="name" />
        <RuleChip label="날짜 형식" category="convert" />
        <RuleChip label="자동 주입" category="inject" />
        <RuleChip label="마스킹" category="mask" />
      </div>

      <h3 className={catalog.heading}>규칙 17종 · 고정 칩(인증 정보 주입 · 이름 정리)</h3>
      <div className={catalog.row}>
        {[...ALL_RULES, AUTH_INJECT_CHIP, NAME_FALLBACK_CHIP].map((chip, index) => (
          <RuleChip key={`${chip.label}-${index}`} label={chip.label} category={chip.category} description={chip.description} />
        ))}
      </div>
    </div>
  );
}

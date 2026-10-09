// 보안 정책 요약 — 소절 제목 "보안 정책" + 보조 "도구별 설정을 따릅니다" + 머리 없는 정책 상자 안 읽기 전용 넷 줄(옛 js/menu/deploy.js:89-95)
// 사용자 확인 후 실행(실행 방식 confirm인 도구 수) · 개인정보 마스킹(마스킹 켠 도구 수) · 호출 기록 "항상" · 호출 한도 "도구별".
// 수는 이 묶음 도구의 저장본(기본값 채운 것 — api/hooks/useTools)으로 센다. 설명 문장은 서버 사실과 다른 옛 문구 그대로다(이식 기간 보존)
import type { Tool } from '../../api/types';
import { DEPLOY } from '../../copy/deploy';
import { Box, SectionTitle, SettingRow } from '@/ui';

const P = DEPLOY.policy;

export function PolicySummary({ tools }: Readonly<{ tools: readonly Tool[] }>) {
  const confirmCount = tools.filter((t) => t.exec === 'confirm').length;
  const maskCount = tools.filter((t) => t.mask).length;
  return (
    <div>
      <SectionTitle level="sub" title={P.title} description={P.sub} />
      <Box variant="policy">
        <SettingRow title={P.confirm} description={P.confirmDesc} control={<b>{P.count(confirmCount)}</b>} />
        <SettingRow title={P.mask} description={P.maskDesc} control={<b>{P.count(maskCount)}</b>} />
        <SettingRow title={P.log} description={P.logDesc} control={<b>{P.always}</b>} />
        <SettingRow title={P.limit} description={P.limitDesc} control={<b>{P.perTool}</b>} />
      </Box>
    </div>
  );
}

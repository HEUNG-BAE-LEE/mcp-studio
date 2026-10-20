// 카탈로그 LiveIndicator 절 — 단독 · Box actions 자리 예. 모션 줄이기는 브라우저 설정으로 본다(켜면 점이 멈춘다)
import { Box, LiveIndicator } from '../../ui';
import catalog from './catalog.module.css';

export function LiveIndicatorSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        진행 중임을 알리는 점 + 글자. 점은 지름 7 · --danger이고 --m-blink 한 번씩 반복해 --opacity-blink까지 옅어진다(이음 그대로 유지하는 반복
        모션). 모션 줄이기를 켜면 멈춘 점이다. 점은 장식이라 뜻은 글자가 전하고, 보이고 숨기는 것은 쓰는 곳이 그릴지로 정한다.
      </p>
      <h3 className={catalog.heading}>단독</h3>
      <div className={catalog.row}>
        <LiveIndicator>탐색 중</LiveIndicator>
      </div>
      <h3 className={catalog.heading}>Box actions 자리</h3>
      <Box title="운영 화면 탐색" description="헤드리스 브라우저" actions={<LiveIndicator>탐색 중</LiveIndicator>} padded>
        상자 머리 오른쪽에 놓인 모양.
      </Box>
    </div>
  );
}

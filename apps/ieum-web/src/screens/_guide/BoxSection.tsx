// 카탈로그 Box 절 — 제목 · 제목 + 보조 글 + 동작 · 제목 없음 · padded 켬/끔 · 정책 상자(policy) · 머리가 좁아 접히는 모양(폭 전환으로 본다)
import { Box } from '../../ui/Box';
import { Button } from '../../ui';
import catalog from './catalog.module.css';
import styles from './BoxSection.module.css';

export function BoxSection() {
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        1px --line-control 테두리 · --surface · 그림자 없음. 제목(h3)이 있어야 머리 줄을 그린다. padded를 끄면 내용이 자기
        여백을 가진다(구조도 · 차트). 머리는 좁으면 제목 아래로 동작이 접힌다. policy는 정책 상자 — 본문을 늘 감싸고 안쪽이
        padded보다 작다(위 14 · 좌우 16 · 아래 16).
      </p>
      <div className={styles.demo}>
        <h3 className={catalog.heading}>제목만 · padded</h3>
        <Box title="확인이 필요한 항목" padded>
          본문 — padded가 안쪽 여백을 준다.
        </Box>
        <h3 className={catalog.heading}>제목 + description + actions · padded</h3>
        <Box
          title="시간대별 호출"
          description="최근 24시간"
          actions={
            <Button size="sm" icon="refresh">
              새로 받기
            </Button>
          }
          padded
        >
          본문
        </Box>
        <h3 className={catalog.heading}>padded 끔 — 본문이 자기 여백을 가짐</h3>
        <Box title="구조도" description="2건">
          <div className={styles.fill}>여백 없는 자리 — 내용이 가장자리까지 간다</div>
        </Box>
        <h3 className={catalog.heading}>제목 없음 — 머리 줄 없음</h3>
        <Box padded>배포 정책 요약처럼 머리가 없는 상자.</Box>
        <h3 className={catalog.heading}>policy — 제목 + 정책 안쪽 여백</h3>
        <Box title="실행 정책" variant="policy">
          정책 상자 본문 — 안쪽이 padded보다 작다.
        </Box>
        <h3 className={catalog.heading}>policy — 제목 없음(배포 보안 정책 요약)</h3>
        <Box variant="policy">머리가 없는 정책 상자 본문.</Box>
      </div>
    </div>
  );
}

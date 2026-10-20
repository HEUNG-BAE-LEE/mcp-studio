// 카탈로그 Chip 절 — 성공 칩(check) · 실패 칩(close) · 긴 도구 이름 · 누름. 아이콘은 장식이고 이름은 시각 숨김 글리프(✓ · ✕)까지 이어 읽힌다.
// hover(테두리 · 글자 --primary)는 마우스를 올려 본다
import { useState } from 'react';
import { ChatCallChip } from './ChatCallChip';
import catalog from './catalog.module.css';
import styles from './ChipSection.module.css';

const SHORT_TOOL = 'search_employee';
const LONG_TOOL = 'get_purchase_order_approval_history_by_vendor_and_period';
const NOT_PRESSED = '아직 누르지 않았습니다';

export function ChipSection() {
  const [pressed, setPressed] = useState(NOT_PRESSED);
  return (
    <div className={catalog.section}>
      <p className={catalog.note}>
        누르면 한 가지 동작을 하는 알약 버튼. 높이는 최소 --h-sm이고 안은 글 흐름 그대로라(flex 아님) 글 · 아이콘 · 숨김 글자 사이의 공백이
        남는다. 글리프 ✓ · ✕ 자리는 장식 아이콘(check · close, sm)이고 곁에 같은 글리프를 시각 숨김으로 두어 버튼 이름이 "도구 ✓ 변환 과정 보기"로
        읽힌다. hover는 테두리 · 글자가 --primary다. 고른 상태 · 비활성 모양은 없다.
      </p>
      <h3 className={catalog.heading}>성공 · 실패</h3>
      <div className={catalog.row}>
        <ChatCallChip tool={SHORT_TOOL} isOk onPress={() => setPressed(`${SHORT_TOOL} ✓`)} />
        <ChatCallChip tool={SHORT_TOOL} isOk={false} onPress={() => setPressed(`${SHORT_TOOL} ✕`)} />
      </div>
      <h3 className={catalog.heading}>긴 도구 이름 — 줄이 접히면 알약이 함께 자란다</h3>
      <div className={styles.narrow}>
        <ChatCallChip tool={LONG_TOOL} isOk onPress={() => setPressed(`${LONG_TOOL} ✓`)} />
      </div>
      <h3 className={catalog.heading}>누름</h3>
      <p className={catalog.note}>마지막으로 누른 칩: {pressed}</p>
    </div>
  );
}

// DiscoveryZone — 탐색 마법사 "탐색 대상"의 입력 묶음 한 칸. 이음 .dz · .dz-h(css/console.css:915-922) — 고정 묶음(운영 접속 정보 js/menu/discovery.js:44-49) · 켜고 끄는 묶음(Git 소스 분석 · 운영 화면 탐색 :50-66)
// 머리 줄 전체가 스위치 라벨이다 — 스위치 · 제목 · 설명 배치와 760 이하 설명 들여쓰기는 Switch heading이 맡고, 이 부품은 상자 · 꺼진 바탕 · 머리 아래 여백만 맡는다.
// 꺼져도 잠겨도 흐리게 하지 않는다(옛 .dz.off는 바탕만 바뀐다) — 꺼졌을 때 어떤 칸을 남길지는 쓰는 곳이 children으로 정한다(옛은 칸을 빼고 브라우저 없음 안내만 남겼다 :60)
import type { ReactNode } from 'react';
import { Switch } from '../Switch';
import { cx } from '../lib/cx';
import styles from './DiscoveryZone.module.css';

/** 잠긴 사유 — 시각 숨김 글자(disabledReason)이거나 화면에 보이는 안내의 id(describedBy). Switch와 같이 둘을 함께 쓰지 않는다 */
type ZoneToggleReason =
  | { disabledReason?: string; describedBy?: never }
  | { describedBy?: string; disabledReason?: never };

export type DiscoveryZoneToggle = ZoneToggleReason & {
  /** 켜짐 — 꺼지면 상자 바탕이 보조 면으로 바뀌고 머리 아래 여백이 없어진다 */
  checked: boolean;
  /** 바꾸면 새 값 */
  onCheckedChange: (checked: boolean) => void;
  /** 못 바꾸는 스위치(쓸 수 있는 브라우저 없음) — 모양은 그대로다 */
  disabled?: boolean;
};

export type DiscoveryZoneProps = {
  /** 굵은 제목 — 스위치가 있으면 스위치 이름(aria-label)도 이 글자다 */
  title: string;
  /** 제목 아래 흐린 설명 */
  description?: ReactNode;
  /** 있으면 머리 줄 전체가 스위치 라벨이다. 없으면 늘 켜진 고정 묶음 */
  toggle?: DiscoveryZoneToggle;
  /** 묶음 칸(Field · FieldPair) · 안내 — 꺼졌을 때 남길 것은 쓰는 곳이 고른다 */
  children?: ReactNode;
  /** 배치(바깥 여백)만 */
  className?: string;
};

export function DiscoveryZone({ title, description, toggle, children, className }: DiscoveryZoneProps) {
  const isOn = toggle === undefined || toggle.checked;
  // 사유 prop은 둘 중 하나만 Switch로 넘긴다(Switch가 둘을 함께 받지 않는다)
  const reason =
    toggle?.describedBy !== undefined
      ? { 'aria-describedby': toggle.describedBy }
      : { disabledReason: toggle?.disabledReason };

  return (
    <div className={cx(styles.root, className)} data-state={isOn ? 'on' : 'off'}>
      {toggle === undefined ? (
        <div className={styles.head}>
          <b className={styles.title}>{title}</b>
          {description !== undefined ? <small className={styles.description}>{description}</small> : null}
        </div>
      ) : (
        <Switch
          variant="heading"
          label={title}
          description={description}
          checked={toggle.checked}
          onCheckedChange={toggle.onCheckedChange}
          disabled={toggle.disabled}
          className={styles.toggleHead}
          {...reason}
        />
      )}
      {children}
    </div>
  );
}

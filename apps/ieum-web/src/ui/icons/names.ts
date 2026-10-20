import type { ComponentType } from 'react';
import Apps from './svg/Apps';
import Chart from './svg/Chart';
import Users from './svg/Users';
import Plug from './svg/Plug';
import Doc from './svg/Doc';
import Sliders from './svg/Sliders';
import Search from './svg/Search';
import Close from './svg/Close';
import Check from './svg/Check';
import Info from './svg/Info';
import Alert from './svg/Alert';
import Bell from './svg/Bell';
import Help from './svg/Help';
import Plus from './svg/Plus';
import Copy from './svg/Copy';
import Play from './svg/Play';
import Stop from './svg/Stop';
import Refresh from './svg/Refresh';
import Key from './svg/Key';
import Server from './svg/Server';
import Db from './svg/Db';
import Globe from './svg/Globe';
import Upload from './svg/Upload';
import Send from './svg/Send';
import User from './svg/User';
import Bot from './svg/Bot';
import Sparkle from './svg/Sparkle';
import Code from './svg/Code';
import Graph from './svg/Graph';
import History from './svg/History';
import Shield from './svg/Shield';
import Rocket from './svg/Rocket';
import Layers from './svg/Layers';
import Back from './svg/Back';
import Arrow from './svg/Arrow';
import Lock from './svg/Lock';
import ArrowUp from './svg/ArrowUp';
import ArrowDown from './svg/ArrowDown';

/** 모양만 그리는 부품 — 바깥 <svg>(viewBox · 선 · 색 · 크기)는 Icon이 만든다 */
type ShapeComponent = ComponentType;

/**
 * 아이콘 이름 = 모양의 뜻. svg/*.tsx를 여기에 등록한다 — IconName은 이 표의 키에서 나오므로 이름과 부품이 어긋날 수 없다.
 * 앞 36개는 이음 원본(js/common/util.js의 I 객체) 그대로. db · graph · sparkle은 백엔드 ic 값과 짝이다
 */
export const ICONS = {
  apps: Apps,
  chart: Chart,
  users: Users,
  plug: Plug,
  doc: Doc,
  sliders: Sliders,
  search: Search,
  close: Close,
  check: Check,
  info: Info,
  alert: Alert,
  bell: Bell,
  help: Help,
  plus: Plus,
  copy: Copy,
  play: Play,
  stop: Stop,
  refresh: Refresh,
  key: Key,
  server: Server,
  db: Db,
  globe: Globe,
  upload: Upload,
  send: Send,
  user: User,
  bot: Bot,
  sparkle: Sparkle,
  code: Code,
  graph: Graph,
  history: History,
  shield: Shield,
  rocket: Rocket,
  layers: Layers,
  back: Back,
  arrow: Arrow,
  lock: Lock,
  // 원본에 없던 아이콘 — ▲ ▼ 글리프 자리
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
} satisfies Record<string, ShapeComponent>;

export type IconName = keyof typeof ICONS;

/** 모든 이름(등록 순서) — 카탈로그가 도는 목록 */
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** 모르는 서버 값이 떨어지는 아이콘 — 어느 뜻도 담지 않는 격자 */
export const DEFAULT_ICON_NAME: IconName = 'apps';

export function isIconName(value: string): value is IconName {
  return Object.hasOwn(ICONS, value);
}

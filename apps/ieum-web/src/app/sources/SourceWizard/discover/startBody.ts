// 탐색 시작 요청 본문(POST /discovery/jobs/) — 옛 { ...d, ban, approved: d.ok, maxPages: +d.maxPages || 50 }(js/menu/discovery.js:109)과
// 키 · 순서 · 값이 같다. 마법사 값은 공백을 빼지 않고 그대로 보낸다(서버가 다듬는다). 비밀번호 · 토큰은 서버 금고로 가고 작업에는 남지 않는다
import type { StartJobBody } from '../../../../api/types';
import { FALLBACK_MAX_PAGES } from '../../../discovery/jobScreen';
import type { DiscoverState } from './discoverState';

export const toStartBody = (d: DiscoverState): StartJobBody => ({
  name: d.name,
  base: d.base,
  start: d.start,
  account: d.account,
  password: d.password,
  git: d.git,
  repo: d.repo,
  branch: d.branch,
  token: d.token,
  framework: d.framework,
  crawl: d.crawl,
  scope: d.scope,
  exclude: d.exclude,
  readPost: d.readPost,
  // 숫자가 아니거나 0이면 50(옛 `+d.maxPages || 50`)
  maxPages: Number(d.maxPages) || FALLBACK_MAX_PAGES,
  stg: d.stg,
  stgUrl: d.stgUrl,
  mask: d.mask,
  when: d.when,
  startTime: d.startTime,
  owner: d.owner,
  ok: d.ok,
  ban: [...d.ban],
  approved: d.ok,
});

/* 한 번에 연결 — 엠버링크 온보딩 위자드(apps/onboarding, React)를 콘솔 위 iframe 으로 띄운다.
   위자드는 자기 덮개와 모달 틀(Shell)을 그리므로, 여기서는 화면 전체를 덮는 투명한 iframe 하나만 둔다.
   빌드 결과가 없으면(npm run build 전) 안내만 하고 열지 않는다. */
const OB_SRC = 'onboarding/';

function obOpen() {
  if ($('#obFrame')) return;
  fetch(OB_SRC, { method: 'HEAD' }).then(r => {
    if (!r.ok) throw new Error();
    const f = document.createElement('iframe');
    f.id = 'obFrame';
    f.title = '한 번에 연결';
    f.src = OB_SRC;
    f.setAttribute('allowtransparency', 'true');
    f.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:4000;background:transparent;color-scheme:normal';
    document.body.appendChild(f);
    document.body.style.overflow = 'hidden';
    f.addEventListener('load', () => f.focus());
  }).catch(() => toast('위자드 화면이 빌드되지 않았습니다. apps/onboarding 에서 npm run build 를 실행하거나 ./start.sh 로 띄워 주세요.', 'warn'));
}

function obClose() {
  const f = $('#obFrame');
  if (f) f.remove();
  document.body.style.overflow = '';
}

window.addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data || e.data.type !== 'ieum-onboarding') return;
  const a = e.data.action;
  if (a === 'refresh') { loadAll().then(render).catch(() => {}); return; }
  if (a === 'close') { obClose(); loadAll().then(render).catch(() => {}); return; }
  if (a === 'enter') {
    // 플랫폼 들어가기 — 위자드가 만든 도구 묶음 초안을 배포 화면에서 연다. 검토 · 배포는 거기서 한다
    obClose();
    loadAll().then(() => { const ts = TOOLSETS[TOOLSETS.length - 1]; if (ts) S.ts = ts.id; go('deploy'); refreshDash(); })
      .catch(() => render());
  }
});

Object.assign(ACT, { obOpen: () => obOpen() });

// 온보딩 위자드 v2 — 상단 스텝 · 전폭 · 복수 선택 · 작은 스텝.
//
// 기존 Onboarding.jsx 는 그대로 둔다(롤백 대비). App 이 어느 쪽을 띄울지만 고른다.
//
// 이전 위자드와 달라진 점 넷:
//   ① 좌측 180px 스텝 레일 제거 → 상단 가로. 본문 폭이 그만큼 넓어진다.
//   ② 큰 스텝 안을 작은 스텝으로 쪼갠다. 한 화면 한 질문이 원칙이다.
//   ③ 소스 종류가 복수 선택이다. 고른 개수만큼 입력 화면이 늘어난다(서브스텝 동적).
//   ④ 화면 문구에서 개발 용어를 뺀다(스키마→표 구조, 자격→접속 키 …).
//
// 소스 코드(사내 Git) 는 백엔드 수집기가 아직 없어 카드만 노출하고 고를 수 없다.
// 지금 실제로 도는 경로는 API 스펙 주소와 데이터베이스 둘이다.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { api, JOB_EVENT } from "../api";
import { useProjects } from "../ProjectContext";
import { blank, toResource } from "../lib/manifestRows";
import { JOB_SOURCE, setJob } from "../jobStore";
import { dropDraft, newDraftId, readDraft, saveDraft, setActiveDraft } from "../onboardingDrafts";
import { Agent, Ask, Btn, Eq, Field, ICO, OkLine, ReqTag, Shell, SubDots } from "./onboarding/steps";
import { buildSubSteps as buildSubStepsPure } from "./onboarding/subSteps";
import { Basket, DocCollect, FolderPicker } from "./onboarding/basket";
import CloudConnect from "../components/CloudConnect";
import ProjectContextForm from "../components/ProjectContextForm";
import { getArmToken } from "../lib/azureAuth";
import { startPipelineJobs } from "../pipelineJobStore";
import {
  createOnboardingRagExecution,
  RAG_DOCUMENT_PIPELINE_OPTIONS,
  ragDocumentsHavePipelineSelections,
} from "../lib/onboardingRag";
import { dashboardNavForRagExecution, projectIdForRagExecution } from "../lib/ragIngestionNavigation";
import { useCountUp } from "./dashboard/bits";
import { CHANNEL_TITLE, SelectionSummary, SourcePicker, SourceSheet } from "./onboarding/sources";
import { ToolPanel } from "./onboarding/toolgroups";

const BIG = ["프로젝트", "연결", "확인", "도구 만들기", "프로젝트 소개", "완료"];

// 프로젝트 목록의 "진행중" 카드와 대시보드가 같은 라벨을 쓴다 — 두 벌로 관리하지 않는다.
// (구 Onboarding.jsx 가 같은 이름으로 내보내던 것을 여기로 옮겼다.)
export const STEPS = BIG.map((label) => ({ label }));

// 빈 저장소 입력 한 벌. 담으면 이 값으로 되돌려 다음 것을 바로 넣게 한다.
// 시연용 기본 저장소. 원래는 사용자가 붙여넣는 값이지만, 시연에서 매번 URL 을 타이핑하면
// 흐름이 끊긴다. 지우고 다른 저장소를 넣어도 그대로 동작한다.
// 이음: 시연 저장소는 서버에 번들된 FINL 재정 연계 소스(전자정부 프레임워크)다. 경로가 배포마다 달라 /runtime 이 알려 준다.
export let DEMO_REPO = "";
// 시연용 DB 접속 참조. 이 값이 그대로 바인딩의 자격 참조로 승계되어 만들어진 조회 도구가
// 켜진 채로 나온다. 참조 문자열이라 실값은 배포 환경(env)에만 있다 — 화면에 비밀은 없다.
export const DEMO_DSN_REF = "${env:PPS_DB_PASSWORD}";
// 시연용 호출 주소. 코드에는 경로만 있고 "이 서비스가 어디 떠 있는지" 는 코드 어디에도 없다 —
// 다른 서비스를 부르는 주소는 환경변수로 읽을 수 있어도, 자기 자신의 주소는 배포가 정하지
// 코드가 정하지 않기 때문이다. 그래서 사람이 알려줘야 하고, 비면 만들어진 도구가 전부
// "주소 미지정" 으로 남아 부를 수 없다. 시연에서 매번 타이핑하지 않도록 기본값을 깐다.
export let DEMO_BASE_URL = "";   // FINL(:18003) — /runtime 이 채운다
// 최초 1회만 데모 주소를 깔아 둔다. 담은 **뒤에도** 이 값으로 되돌리면 폼이 채워진 채
// 남아 "아직 담기지 않았습니다" 경고가 곧바로 다시 뜬다 — 방금 담은 그 저장소를 두고.
const BLANK_CODE = { mode: "git", repoUrl: "", path: "", branch: "", subpath: "", tokenRef: "",
  name: "", baseUrl: "", dbId: "" };
const EMPTY_CODE = { ...BLANK_CODE, repoUrl: DEMO_REPO, baseUrl: DEMO_BASE_URL };

/** 담은 뒤 폼을 비울 때 — 읽어올 위치만 지우고 **접속 정보는 남긴다.**
 *
 *  호출 주소와 DB 접속 참조는 저장소마다 새로 묻는 값이 아니다. 같은 시스템의 저장소를 여러 개 담는
 *  것이 흔한데, 매번 다시 적게 하면 두 번째부터는 대개 빈 채로 넘어간다. 그러면 그 저장소의
 *  조회 도구가 dsn 없이 만들어지고, 한참 뒤 대시보드에서 "응답 없음"(dsn 해석 불가)으로만
 *  드러난다 — 원인에서 가장 먼 곳에서. 틀렸으면 그 자리에서 고쳐 쓰면 된다. */
const nextDraft = (cur) => ({ ...BLANK_CODE, dbId: cur?.dbId || "", baseUrl: cur?.baseUrl || "" });

/** 같은 저장소를 가리키는가 — 목록에 이미 있는지 판정하는 기준.
 *  이름·호출 주소는 나중에 고칠 수 있는 부가 정보라 뺀다. 읽어올 위치가 같으면 같은 건이다. */
function sameCode(a, b) {
  if (!a || !b || a.mode !== b.mode) return false;
  const t = (v) => (v || "").trim();
  const where = a.mode === "git" ? t(a.repoUrl) === t(b.repoUrl) : t(a.path) === t(b.path);
  return where && t(a.branch) === t(b.branch) && t(a.subpath) === t(b.subpath);
}

// 기본으로 두드려 보는 포트. 백엔드 _SPEC_PORTS 와 같은 값이며 화면에 그대로 보여준다 —
// "무엇을 이미 확인했는지" 를 알아야 사용자가 무엇을 더 적어야 할지 판단할 수 있다.
const COMMON_PORTS = [8080, 8000, 443, 3000, 80];

// 진행 표시의 최소 노출 시간.
//
// 320ms 로 뒀다가 올렸다. 목록 조회가 200ms 안에 끝나는 환경에서는 표시가 뜨자마자 사라져
// **본 적이 없다는 말이 나왔다** — 실제로 재보니 클릭에서 대시보드까지 373ms 였고 그 사이
// 오버레이가 다 지나갔다. 0.3초짜리 깜빡임은 피드백이 아니라 화면 튐으로 읽힌다.
//
// 온보딩 끝에 한 번 지나는 길이라 0.6초는 비용이 아니라 마무리다. 느린 환경(컨테이너
// 콜드 스타트 등)에서는 실제 소요만큼 더 오래 떠 있는다 — 이 값은 하한이지 고정이 아니다.
const MIN_ENTER_MS = 600;

/** "8082, 9000" → [8082, 9000]. 범위를 벗어난 값과 중복은 조용히 버린다. */
// "18001, 18002/dhgw/openapi.yaml" → ["18001", "18002/dhgw/openapi.yaml"]
//
// 포트만 적으면 그 포트에서 표준 스펙 경로를 두드리고, 경로까지 적으면 그것만 확인한다.
// 경로를 받는 이유 — 레거시가 표준 스펙 경로를 꺼 두고 /ctlg/v2/api-docs 같은 자기 경로로
// 명세를 내는 일이 흔하다. 그러면 포트를 아무리 정확히 맞춰도 영원히 못 찾는다.
function parsePorts(text) {
  const seen = new Set();
  for (const raw of String(text || "").split(/[,\s]+/)) {
    const m = /^(\d{1,5})(\/\S*)?$/.exec(raw);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= 65535) seen.add(m[1] + (m[2] || ""));
  }
  return [...seen];
}

// 시연용 기본값 — 레거시 API 가 도는 서버는 매번 같은 포트·경로를 쓴다. 매 시연마다 손으로
// 적으면 흐름이 끊기므로 미리 채운다. 값이 틀려도 사용자가 고쳐 쓰면 된다.
//
// 경로까지 적는 이유 — 이 레거시들은 FastAPI 의 표준 스펙 경로를 꺼 두고(openapi_url=None)
// 자기 경로로 명세를 낸다. 포트만 맞춰서는 못 찾는다.
//
// ※ 실제 시연 환경이 달라지면 이 두 곳만 고치면 된다.
const DEMO_PROBES = "18001/ctlg/v2/api-docs, 18002/dhgw/openapi.yaml, 18003, 18004/stck/StockService?wsdl";
const DEMO_PORTS = [
  [/vm-pps-ctlg/i, "18001/ctlg/v2/api-docs"],
  [/vm-pps-dhgw/i, "18002/dhgw/openapi.yaml"],
  [/vm-pps-finl/i, 18003],
  [/vm-pps-stck/i, "18004/stck/StockService?wsdl"],
];
function suggestPort(name) {
  const hit = DEMO_PORTS.find(([re]) => re.test(name || ""));
  return String(hit ? hit[1] : 8080);
}

/** 선택한 종류 → 연결 단계의 작은 스텝 목록. 계산은 subSteps.js 가 한다.
 *
 *  이 화면 파일 안에 두면 node --test 로 부를 수 없어(JSX) 검증이 안 된다. 스텝 계산이
 *  틀리면 "다음" 을 눌러도 안 넘어가는 것처럼 보이는데, 눈으로 잡기 어렵고 잡아도 원인이
 *  여기라는 걸 알기 어렵다. */
const buildSubSteps = (selected) => buildSubStepsPure(selected, CHANNEL_TITLE);

export default function OnboardingV2({ go, draftId, onClose, resume }) {
  // resume 이 오면 입력 단계를 건너뛰고 진행 중인 변환 화면으로 바로 연다.
  // 잡이 시작되는 순간 draft 는 지워지므로, 알림에서 되돌아올 때 복원할 draft 자체가 없다.
  const { switchTo, refresh } = useProjects();
  const [did] = useState(() => draftId || newDraftId());
  const [snap] = useState(() => (resume ? null : readDraft(did)));

  const [big, setBig] = useState(resume ? 3 : snap?.big ?? 0);   // 큰 스텝 0~4
  const [subIdx, setSubIdx] = useState(snap?.subIdx ?? 0); // 연결 단계의 작은 스텝
  const [name, setName] = useState(resume?.name ?? snap?.name ?? "");
  const [desc, setDesc] = useState(snap?.desc ?? "");
  const [selected, setSelected] = useState(snap?.selected ?? []);
  const [codes, setCodes] = useState(snap?.codes ?? []);      // 담은 저장소 목록
  const [draftCode, setDraftCode] = useState(EMPTY_CODE);     // 지금 입력 중인 한 건
  const [editIdx, setEditIdx] = useState(-1);                 // 수정 중이면 그 인덱스
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openapi, setOpenapi] = useState(snap?.openapi ?? { name: "", url: "" });
  // 클라우드 — Entra SSO 로그인 결과. 구 위자드와 같은 방식(CloudConnect)으로 받는다.
  const [azureAcct, setAzureAcct] = useState(snap?.azureAcct ?? null);
  const [azureSubs, setAzureSubs] = useState(snap?.azureSubs ?? []);
  // 문서 — 파일은 직렬화가 안 되므로 draft 에 싣지 않는다(구 위자드도 같은 이유로 제외했다).
  const [pickedSubs, setPickedSubs] = useState(() => new Set(snap?.pickedSubs ?? []));
  // 찾은 것을 두 바구니로 나눠 담는다. 훑기는 한 번이지만(구독을 두 번 돌면 대기가 두 배다)
  // 앞 화면이 API 와 데이터베이스를 두 카드로 갈랐으므로 결과도 각자에게 가야 한다.
  const [cloudApi, setCloudApi] = useState([]);      // VM · App Service · Container Apps · APIM
  const [cloudDb, setCloudDb] = useState([]);        // 관리형 데이터베이스
  const cloudRes = [...cloudApi, ...cloudDb];        // 합쳐 보는 곳(요약·완료 판정)이 아직 있다
  const [cloudLog, setCloudLog] = useState([]);      // 수집 진행 로그 — 몇 초간 화면이 죽지 않게
  const [cloudProg, setCloudProg] = useState({ done: 0, total: 0 });
  // 스펙을 못 찾은 서버 — 버리지 않고 모은다. 관례 포트만 두드려 본 결과라 "없다" 가 아니라
  // "여기까지 봤다" 이고, 포트를 아는 사람이 한 칸 채우면 살아나는 대상이다.
  const [cloudMissed, setCloudMissed] = useState([]);
  // 수집 전에 미리 받는 추가 포트. 아는 사람만 적는 선택 항목이라 기본은 비어 있다.
  // 비워 두고 시작하면 매번 손으로 적어야 한다. 미리 채우고 고칠 수 있게 둔다.
  const [extraPorts, setExtraPorts] = useState(DEMO_PROBES);
  // 수집을 한 번이라도 돌렸는가 — 아직이면 화면이 "고르고 시작하는 곳" 으로 보여야 한다.
  const scannedRef = useRef(false);
  // 수집이 끝났는가 — 다음 화면의 성격이 여기서 갈린다.
  const cloudDone = !!azureAcct && cloudRes.length > 0;
  const [docs, setDocs] = useState([]);
  const [appMode, setAppMode] = useState(null);
  const docInputRef = useRef(null);
  const [docOpen, setDocOpen] = useState(false);   // preview 배포에서 쓰는 폴더 모달
  // 변환이 끝났는가 — 끝나기 전에 결과 화면으로 넘어가면 아직 늘고 있는 숫자를
  // "최종 결과"로 보게 된다. 그래서 그 버튼은 잡이 끝나야 열린다.
  const [runDone, setRunDone] = useState(false);
  // 플랫폼으로 넘어가는 중. 화면을 덮는 진행 표시와 중복 클릭 방어를 함께 맡는다.
  const [entering, setEntering] = useState(false);
  // 펼쳐 둔 그룹 카드("서버에서 직접 수집"). 하위를 아직 안 골랐어도 선택지 박스는 떠 있어야
  // 하므로 selected 와 별도로 둔다.
  const [openGroup, setOpenGroup] = useState(null);
  const [db, setDb] = useState(snap?.db ?? { name: "", driver: "postgres", hostDb: "", user: "", secret: DEMO_DSN_REF });
  const [checked, setChecked] = useState(snap?.checked ?? {});   // {소스id: 확인 결과 문구}
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [pid, setPid] = useState(snap?.pid ?? null);
  const [ragExecution, setRagExecution] = useState(resume?.ragExecution ?? snap?.ragExecution ?? null);
  const pidRef = useRef(resume?.pid ?? snap?.pid ?? null);
  const jobIdRef = useRef(resume?.jobId ?? snap?.jobId ?? null);

  // preview 배포는 서버 공유 폴더에서 고르고, local 은 내 컴퓨터에서 올린다(구 위자드와 동일).
  useEffect(() => {
    api.runtime().then((v) => {
      setAppMode(v.app_mode);
      const d = v.demo;
      if (!d) return;
      DEMO_REPO = d.repo; DEMO_BASE_URL = d.baseUrl;
      // 시연 소스는 이 서버에 번들된 폴더다 — "이 서버의 폴더" 로 깐다
      setDraftCode((c) => (c.repoUrl || c.path ? c : { ...c, mode: "folder", path: d.repo, baseUrl: c.baseUrl || d.baseUrl }));
    }).catch(() => setAppMode("local"));
  }, []);

  const subs = useMemo(() => buildSubSteps(selected), [selected]);
  

  // 진행분 저장 — 닫아도 프로젝트 목록의 "진행중" 카드로 이어진다.
  //
  // 변환이 시작된 뒤에도 계속 저장한다. 예전에는 잡을 띄우는 순간 draft 를 지우고 저장을
  // 멈췄는데, 그 뒤 위자드가 한 번이라도 다시 마운트되면 읽을 draft 가 없어 big=0
  // (프로젝트 입력)으로 되돌아갔다 — 변환 중에 첫 화면으로 튀는 증상의 원인이다.
  // draft 는 플랫폼에 들어가는 시점(enter)에 지운다.
  useEffect(() => {
    if (resume) return;
    if (big === 0 && !name.trim() && !selected.length) return;   // 열자마자 닫은 빈 위자드는 남기지 않는다
    // step 은 목록·대시보드의 "진행중" 카드가 읽는 키다. big 과 같은 값을 함께 저장해
    // 그 화면들을 건드리지 않고도 진행도가 맞게 보이도록 한다.
    saveDraft(did, { v2: true, big, step: big, subIdx, name, desc, selected, codes, openapi, db, checked,
      pid: pidRef.current, jobId: jobIdRef.current, ragExecution, azureAcct, azureSubs, pickedSubs: [...pickedSubs] });
  }, [did, big, subIdx, name, desc, selected, codes, openapi, db, checked, pid, ragExecution, azureAcct, azureSubs, pickedSubs]);

  const toggle = (id) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setSubIdx(0);   // 선택이 바뀌면 뒤 스텝 구성이 달라진다 — 첫 칸으로 되돌린다
  };
  // 하위 선택은 한 번에 여러 채널을 켠다("주소 직접 입력" = 서버 주소 + 데이터베이스).
  const pickChannels = (ids, on) => {
    setSelected((cur) => (on ? [...cur, ...ids.filter((x) => !cur.includes(x))]
      : cur.filter((x) => !ids.includes(x))));
    setSubIdx(0);
  };

  // ── 연결 확인 ───────────────────────────────────────────
  // "저장됨" 이 아니라 실제로 한 번 다녀온다. 설정만 받아두면 변환 단계에서 터진다.
  const checkOpenapi = async () => {
    setErr(""); setBusy("openapi");
    try {
      const r = await api.scanOpenapi({ url: openapi.url, dry_run: true });
      const n = r?.discovered ?? r?.added?.length ?? 0;
      setChecked((c) => ({ ...c, openapi: `기능 ${n}개를 찾았습니다` }));
    } catch (e) {
      setErr(e.message || "주소를 확인하지 못했습니다");
    } finally { setBusy(""); }
  };

  // ── 클라우드 리소스 조회 ────────────────────────────────
  // 구독 목록은 겉면만 준다. 실제로 변환할 대상(관리형 DB)은 구독을 한 번 더 훑어야 나온다.
  //
  // 예전에는 로그인이 끝나는 순간 여기서 수집까지 달렸다. 그러면 고르는 화면이 수집 진행까지
  // 떠안고, 좁은 시트 안에서 로그가 흐르며, "포트를 못 찾았습니다" 처럼 **할 일이 생기는**
  // 메시지가 그 안에 묻힌다. 정작 클라우드 단계에 도착하면 이미 다 끝나 있어 지나가는 화면이 된다.
  //
  // 그래서 로그인까지만 한다. 수집은 다음 화면이 **도착과 동시에 자동으로** 시작한다 —
  // 버튼을 누르게 하지 않으므로 "고르기만 하고 아무 일도 안 일어나는 화면" 은 생기지 않는다.
  const onCloudConnected = ({ acct, subs }) => {
    setAzureAcct(acct); setAzureSubs(subs || []);
    // 전부 켜지 않는다. 계정에 딸린 구독은 대개 대상이 아닌 것까지 섞여 있어, 전부 훑으면
    // 느린 데다 매번 손으로 꺼야 한다. 첫 구독 하나만 켜 두고 나머지는 사용자가 켠다.
    setPickedSubs(new Set((subs || []).slice(0, 1).map((x) => x.id)));
    setCloudApi([]); setCloudDb([]); setCloudLog([]); setCloudMissed([]);
    setChecked((c) => ({ ...c, cloud: "" }));
    scannedRef.current = false;      // 계정을 바꿔 다시 로그인했으면 다음 화면에서 새로 훑는다
  };

  const scanCloud = async (subs) => {
    setErr(""); setBusy("cloud");
    scannedRef.current = true;
    setCloudApi([]); setCloudDb([]); setCloudLog([]); setCloudMissed([]);
    setCloudProg({ done: 0, total: (subs || [...pickedSubs]).length });
    // 한 줄씩 흘려보낸다. 버튼만 "훑는 중…" 으로 바뀌면 몇 초 동안 화면이 죽은 것처럼 보이고,
    // 결과가 0개일 때는 무엇을 보고 0개인지조차 알 수 없다.
    const say = (msg, level = "info") =>
      setCloudLog((l) => [...l, { msg, level, key: l.length }]);
    const extra = parsePorts(extraPorts);
    try {
      const token = await getArmToken();
      // 로그인 직후에는 azureSubs·pickedSubs 가 아직 반영되기 전이라 state 를 읽으면
      // 비어 있다. 그래서 그 경로는 응답으로 받은 구독 목록을 직접 넘긴다.
      const targets = subs ? [...subs] : azureSubs.filter((s) => pickedSubs.has(s.id));
      say(`구독 ${targets.length}개를 훑습니다`
        + (extra.length ? ` · ${extra.join(", ")} 을 먼저 확인합니다` : ""));
      // 어느 카드에서 클라우드를 골랐나. 목록 조회(ARM GET 한 번)는 양쪽 다 해 둔다 —
      // 가볍고, 나중에 다른 카드를 켜도 구독을 다시 훑지 않아도 된다.
      // 비싼 것은 **VM 포트 프로브**뿐이라 그것만 API 선택 시로 막는다.
      const wantApi = selected.includes("cloud");
      const wantDb = selected.includes("clouddb");
      const found = [];
      for (const sub of targets) {
        say(`${sub.name} · 서버와 데이터베이스를 조회하는 중…`);
        // 한 구독에서 네 가지를 함께 본다. VM 만 보던 것을 넓힌 이유는 확률이다 — VM 은
        // 리프트앤시프트라 오히려 명세가 없을 확률이 높고, PaaS·APIM 은 있을 확률이 높다.
        const [vm, db, host, apim] = await Promise.all([
          api.azureVms(token, sub.id).catch(() => ({ vms: [] })),
          api.azurePostgres(token, sub.id).catch(() => ({ databases: [] })),
          wantApi ? api.azureHosts(token, sub.id).catch(() => ({ hosts: [] })) : { hosts: [] },
          wantApi ? api.azureApim(token, sub.id).catch(() => ({ apis: [] })) : { apis: [] },
        ]);
        const vms = vm.vms || [], dbs = db.databases || [];
        const hosts = host.hosts || [], apims = apim.apis || [];
        say(`${sub.name} · 서버 ${vms.length}대 · PaaS ${hosts.length}개`
            + ` · APIM ${apims.length}개 · 데이터베이스 ${dbs.length}개 확인`);

        // APIM 은 두드릴 필요가 없다. 관리 평면이 API 목록과 연산을 직접 주고, 그 명세를
        // 그대로 실어 보낸다 — 변환 시점엔 ARM 토큰이 없어서 다시 부를 수 없다.
        for (const a of apims) {
          const item = { ...a, sub: sub.name };
          found.push(item);
          setCloudApi((c) => [...c, item]);
          say(`${a.name} · APIM 에서 API ${a.api_count}개 (두드리지 않음)`, "ok");
        }

        // PaaS 는 FQDN 이 곧 주소이고 포트가 443 고정이라 한 번만 두드린다(VM 의 1/5).
        for (const h of hosts) {
          const hit = await api.azureHostProbe(h.host, h.port || 443)
            .catch((e) => ({ found: false, reason: e.message }));
          if (!hit.found) {
            say(`${h.name} · ${h.host} 에서 API 설명서를 찾지 못했습니다`, "warn");
            continue;
          }
          const item = {
            ...h, res: "host", sub: sub.name,
            spec_url: `${hit.scheme}://${hit.address}:${hit.port}${hit.spec_path}`,
            api_count: hit.api_count || 0,
          };
          found.push(item);
          setCloudApi((c) => [...c, item]);
          say(`${h.name} · ${hit.spec_type} 에서 API ${item.api_count}개 발견`, "ok");
        }

        // VM 목록은 겉면(이름·OS)만 준다. 그 안에서 도는 API 를 가져오려면 표준 스펙 경로를
        // 한 번 두드려야 한다. 스펙이 없는 VM 은 변환할 게 없으므로 담지 않는다.
        //
        // 여기가 유일하게 비싼 구간이다(대수 × 포트 × 경로). 데이터베이스만 필요한
        // 사용자에게까지 이 비용을 물리지 않는다.
        for (const x of (wantApi ? vms : [])) {
          say(`${x.name} · API 설명서를 찾는 중…`);
          const hit = await api.azureVmProbe(token, x.id, null, extra)
            .catch((e) => ({ found: false, reason: e.message }));
          if (!hit.found) {
            // 못 찾았다고 버리면 사라진다. 관례 포트만 두드려 본 결과라 "없다" 가 아니라
            // "여기까지 봤다" 이고, 포트를 아는 사람이 한 칸 채우면 살아난다. 그래서 모아 둔다.
            setCloudMissed((m) => (m.some((v) => v.id === x.id) ? m
              : [...m, { ...x, sub: sub.name, reason: hit.reason || "", suggest: suggestPort(x.name) }]));
            say(`${x.name} · 기본 대역에서 API 설명서를 찾지 못했습니다 — 아래에서 포트를 지정할 수 있습니다`, "warn");
            continue;
          }
          const item = {
            ...x, res: "vm", sub: sub.name,
            spec_url: `${hit.scheme}://${hit.address}:${hit.port}${hit.spec_path}`,
            api_count: hit.api_count || 0,
          };
          found.push(item);
          setCloudApi((c) => [...c, item]);          // 찾는 즉시 오른쪽에 쌓인다
          say(`${x.name} · API ${item.api_count}개 발견`, "ok");
        }
        for (const x of (wantDb ? dbs : [])) {
          // 자격이 없는 DB 는 담지 않는다. 담아 봐야 변환 단계에서 접속에 실패하고
          // (사설 DB 는 이름조차 안 풀린다) 붉은 로그만 남긴 채 수십 초를 쓴다.
          // dsn_ref 는 "이 플랫폼이 이미 접속 정보를 쥐고 있다" 는 뜻이라 그대로 판정에 쓴다.
          //
          // 다만 숨기지는 않는다 — 찾긴 찾았다는 사실과 왜 건너뛰는지를 남긴다.
          // 조용히 빠지면 "왜 우리 DB 가 안 보이지" 가 되고, 그게 더 나쁜 침묵이다.
          if (!x.dsn_ref) {
            say(`${x.name} · 접속 정보가 없어 건너뜁니다 — 필요하면 Database 화면에서 직접 추가할 수 있습니다`, "warn");
            continue;
          }
          const item = { ...x, res: "db", sub: sub.name };
          found.push(item);
          setCloudDb((c) => [...c, item]);
          say(`${x.name} · 데이터베이스 발견 (자격 있음)`, "ok");
        }
        setCloudProg((g) => ({ ...g, done: g.done + 1 }));
      }

      const dbN = found.filter((r) => r.res === "db").length;
      const srvN = found.length - dbN;               // VM · PaaS · APIM 을 합친 "API 쪽"
      const apis = found.reduce((n, r) => n + (r.api_count || 0), 0);
      const summary = [
        srvN ? `API 원천 ${srvN}개(API ${apis}개)` : "",
        dbN ? `데이터베이스 ${dbN}개` : "",
      ].filter(Boolean).join(" · ");
      say(summary ? `수집 완료 · ${summary}` : "가져올 리소스를 찾지 못했습니다",
        summary ? "ok" : "warn");
      setChecked((c) => ({ ...c, cloud: summary ? `${summary}를 찾았습니다` : "" }));
    } catch (e) {
      say(e.message || "조회 실패", "error");
      setErr(e.message || "구독을 조회하지 못했습니다 — 다시 로그인해 주세요");
    } finally { setBusy(""); }
  };

  /** 못 찾은 서버를 포트 하나로 다시 두드린다.
   *
   *  백엔드는 처음부터 이걸 지원했다(`vm-probe` 의 port 파라미터 — "관례 포트 미스 시 사용자가
   *  보완"). 화면이 안 쓰고 있어서, 로그만 "포트를 아시면 입력해주세요" 라고 말하고 정작
   *  입력할 곳이 없었다. */
  const probePort = async (vm, port) => {
    // 포트만("18003") 또는 경로까지("18001/ctlg/v2/api-docs"). 둘 다 같은 칸에서 받는다.
    const [p] = parsePorts(port);
    if (!p) return setErr("포트는 1 ~ 65535 사이 숫자로, 경로는 18001/ctlg/v2/api-docs 처럼 적어주세요");
    setErr(""); setBusy(`probe:${vm.id}`);
    try {
      const token = await getArmToken();
      const hit = await api.azureVmProbe(token, vm.id, p);
      if (!hit.found) {
        setErr(p.includes("/")
          ? `${vm.name} · ${p} 에서도 API 설명서를 찾지 못했습니다`
          : `${vm.name} · ${p} 번 포트에서도 API 설명서를 찾지 못했습니다`);
        return;
      }
      const item = {
        ...vm, res: "vm",
        spec_url: `${hit.scheme}://${hit.address}:${hit.port}${hit.spec_path}`,
        api_count: hit.api_count || 0,
      };
      setCloudApi((c) => [...c, item]);
      setCloudMissed((m) => m.filter((v) => v.id !== vm.id));
      setCloudLog((l) => [...l,
        { msg: `${vm.name} · ${p} 번 포트에서 API ${item.api_count}개 발견`, level: "ok", key: l.length }]);
    } catch (e) {
      setErr(e.message || "포트를 확인하지 못했습니다");
    } finally { setBusy(""); }
  };

  // ── 저장소 담기 ─────────────────────────────────────────
  // 카드 안에 쌓인 것 — 카드가 "고르는 것" 에서 "쌓는 것" 이 되면서 필요해진 목록이다.
  // 아래 요약바는 **채널 이름**(소스 코드·클라우드)을 말하고, 여기는 **무엇을 담았나**
  // (저장소 이름·계정·주소)를 말한다. 층위가 달라 둘 다 있어야 한다.
  // 고를 수 있는 데이터베이스 — 등록처는 데이터베이스 탐색 카드 하나다.
  // 직접 넣은 것과 클라우드에서 찾은 것을 같은 목록으로 합친다. 소스코드 화면은 여기서
  // 고르기만 하고 접속 문자열을 다시 적지 않는다.
  const dbList = [
    ...(db.hostDb ? [{ id: "direct", label: db.name || db.hostDb, dsn: db.hostDb, user: db.user,
                       secret: db.secret, driver: db.driver }] : []),
    ...cloudDb.map((r, i) => ({
      id: `cloud:${r.id || i}`, label: `${r.name} · 클라우드`,
      dsn: r.dsn_ref || `${r.fqdn || ""}/postgres`,
      user: r.dsn_ref ? "" : (r.admin || ""), secret: "", driver: r.engine || "postgres",
    })),
  ];
  const dbOf = (id) => dbList.find((d) => d.id === id);

  // 클라우드 계정 행은 두 카드에 각각 선다. 계정은 하나지만 그 계정이 가져오는 것이
  // 카드마다 다르다 — 중복이 아니라 같은 계정의 두 가지 수확이다.
  const cloudRow = (key, items, unit) => (azureAcct ? [{
    key, label: "클라우드",
    detail: items.length ? `${azureAcct.username} · ${unit} ${items.length}` : azureAcct.username,
  }] : []);

  const cardRows = {
    api: [
      ...codes.map((c, i) => ({
        key: `code${i}`, label: codeLabel(c),
        // 주소가 없으면 대조할 상대가 없다 — 담기긴 하되 "코드만 확인" 으로 끝난다.
        detail: c.baseUrl || "서버 주소 없음",
        warn: !c.baseUrl,
      })),
      ...(selected.includes("cloud") ? cloudRow("cloud", cloudApi, "원천") : []),
      ...(openapi.url ? [{ key: "openapi", label: openapi.name || "서버 주소", detail: openapi.url }] : []),
    ],
    database: [
      ...(db.hostDb ? [{ key: "db", label: db.name || "데이터베이스", detail: db.hostDb }] : []),
      ...(selected.includes("clouddb") ? cloudRow("clouddb", cloudDb, "DB") : []),
    ],
    document: docs.map((d, i) => ({
      key: `doc${i}`, label: (d.name || "").split("/").pop() || "문서",
      detail: d.size ? `${Math.round(d.size / 1024)} KB` : "",
    })),
  };

  const codeReady = draftCode.mode === "git" ? !!draftCode.repoUrl.trim() : !!draftCode.path.trim();
  // 채워는 놨는데 아직 담지 않은 상태. 이대로 다음으로 가면 그 값은 조용히 버려진다.
  //
  // "비어 있지 않으면 안 담긴 것" 으로 보면 안 된다. 폼을 비우는 자리가 한 곳이라도 값을
  // 남기면(예전엔 담은 뒤 데모 주소로 되돌렸다) 방금 담은 저장소를 두고 "안 담겼다" 고 우긴다.
  // 그래서 내용이 목록에 이미 있는지로 판정한다 — 폼이 어떻게 채워졌든 결과가 같다.
  const codePending = codeReady && !codes.some((c) => sameCode(c, draftCode));
  const addCode = () => {
    if (!codeReady) return;
    setCodes((cur) => {
      const next = [...cur];
      if (editIdx >= 0) next[editIdx] = draftCode; else next.push(draftCode);
      return next;
    });
    // 담으면 폼을 비운다 — 값이 남아 있으면 "수정 중인가 새로 넣는 중인가" 가 흐려진다.
    setDraftCode(nextDraft(draftCode)); setEditIdx(-1); setPickerOpen(false);
  };
  const editCode = (i) => { setDraftCode(codes[i]); setEditIdx(i); setPickerOpen(false); };
  const removeCode = (i) => {
    setCodes((cur) => cur.filter((_, x) => x !== i));
    if (editIdx === i) { setDraftCode(nextDraft(draftCode)); setEditIdx(-1); }
  };

  // ── 문서 담기 ───────────────────────────────────────────
  // 구 위자드(addLocalDocs)와 같은 규칙: 확장자 필터 → 경로·크기 표기 → 중복 제외.
  // 목록 병합 — 폴더 모달과 파일 선택이 같은 자리로 들어온다. 경로가 같으면 다시 담지 않는다.
  const mergeDocs = (picked) => setDocs((cur) => {
    const key = (d) => `${d.dir}/${d.name}`;
    const known = new Set(cur.map(key));
    return [...cur, ...picked.filter((d) => d.ok !== false && !known.has(key(d)))];
  });

  // 구 위자드(addLocalDocs)와 같은 규칙: 확장자 필터 → 경로·크기 표기.
  const addLocalDocs = (fileList) => mergeDocs([...fileList]
    .filter((f) => ["pdf", "docx", "xlsx"].includes(f.name.split(".").pop()?.toLowerCase()))
    .map((f) => {
      const rel = f.webkitRelativePath || f.name;
      const slash = rel.lastIndexOf("/");
      return {
        name: f.name,
        dir: slash >= 0 ? `local/${rel.slice(0, slash)}` : "local",
        type: f.name.split(".").pop()?.toUpperCase() || "DOC",
        meta: f.size >= 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)}MB`
          : `${Math.max(1, Math.round(f.size / 1024))}KB`,
        ok: true,
        file: f,
      };
    }));
  const updateDocPipeline = (index, pipelineId) => setDocs((cur) => cur.map((doc, i) => (
    i === index ? { ...doc, pipelineId } : doc
  )));

  const rows = () => {
    const out = [];
    if (selected.includes("code")) {
      // 담은 저장소 하나가 manifest 리소스 하나다. resources 가 이미 리스트라 백엔드는 그대로다.
      // base_url 은 넣지 않는다 — 코드에는 경로만 있고 그 서비스가 어디 떠 있는지는 배포 설정에 있다.
      codes.forEach((c) => out.push({
        ...blank("code"), name: c.name || codeLabel(c),
        // 접속 문자열은 데이터베이스 탐색에서 등록한 것을 참조로 고른다. 여기서 다시 적으면
        // 같은 값이 두 곳에 생기고, 한쪽만 고치면 조용히 어긋난다.
        url: c.baseUrl || "",
        ...(dbOf(c.dbId) ? { dsn: dbOf(c.dbId).dsn, dbUser: dbOf(c.dbId).user || "" }
                         : { dsn: "", dbUser: "" }),
        repo_url: c.mode === "git" ? c.repoUrl : "", path: c.mode === "folder" ? c.path : "",
        branch: c.branch, subpath: c.subpath, token_ref: c.tokenRef,
      }));
    }
    if (selected.includes("openapi") && openapi.url) {
      out.push({ ...blank("openapi"), name: openapi.name || openapi.url, url: openapi.url });
    }
    if (selected.includes("cloud")) {
      cloudApi.forEach((r) => out.push({
        // VM·PaaS 자체는 도구가 아니다 — 그 위에 떠 있는 API 설명서를 읽어야 도구가 된다.
        // APIM 은 다르다. 관리 평면이 명세를 이미 줬고 변환 시점엔 ARM 토큰이 없으므로,
        // 받아 둔 그 명세를 그대로 실어 보낸다(url 은 호출 주소로만 쓰인다).
        ...blank("openapi"), name: r.name, url: r.spec_url || r.url || "",
        ...(r.spec ? { spec: r.spec } : {}),
      }));
    }
    if (selected.includes("clouddb")) {
      cloudDb.forEach((r) => out.push({
        ...blank("db"), name: r.name, driver: r.engine || "postgres",
        // 플랫폼이 이미 자격을 쥔 서버면 완성된 참조가 온다 — 그대로 통과시켜야 하므로
        // 계정을 비운다(계정이 있으면 composeDsn 이 참조 위에 DSN 을 다시 조립한다).
        ...(r.dsn_ref
          ? { dsn: r.dsn_ref, dbUser: "" }
          : { dsn: `${r.fqdn || ""}/postgres`, dbUser: r.admin || "" }),
      }));
    }
    if (selected.includes("document")) {
      docs.forEach((d) => out.push({
        ...blank("document"), name: d.name, path: `${d.dir}/${d.name}`, file: d.file,
        pipelineId: d.pipelineId,
        ...(d.blob_url ? { blob_url: d.blob_url } : {}),
      }));
    }
    if (selected.includes("db") && db.hostDb) {
      out.push({
        ...blank("db"), name: db.name || db.hostDb, driver: db.driver,
        dsn: db.hostDb, dbUser: db.user, dbSecret: db.secret,
      });
    }
    return out;
  };

  // ── 변환 시작 ───────────────────────────────────────────
  const start = async () => {
    setErr(""); setBusy("run");
    try {
      let projectId = pidRef.current;
      if (!projectId) {
        const p = await api.createProject({ name: name.trim(), description: desc });
        projectId = p.id; pidRef.current = projectId; setPid(projectId);
      }
      const sourceRows = rows();
      const manifest = { project: name.trim(), resources: sourceRows.map(toResource) };
      const { jobId } = await api.manifestApply(manifest, projectId, true);

      // 잡이 접수된 그 순간 화면을 넘긴다.
      //
      // 예전에는 아래 RAG 실행 생성까지 기다린 뒤에 넘어갔다. 그 왕복이 수 초인데 백엔드
      // 변환은 이미 돌고 있어서, 진행 화면이 켜지는 첫 프레임에 카운트가 이미 다 차 있었다 —
      // "시작하자마자 백 개가 뜬다" 가 이것이다. 숫자는 진짜였지만 쌓이는 과정을 아무도
      // 못 봤으니 미리 박아 둔 값으로 읽힌다. 문서 적재는 화면이 뜬 뒤에 이어서 걸면 된다.
      jobIdRef.current = jobId;
      setJob(projectId, jobId, JOB_SOURCE.ONBOARDING);
      setBig(3);

      // 문서는 MCP 가 아니라 RAG 트랙이다 — 구 위자드와 같은 순서로 실행을 건다.
      const documentRows = sourceRows.filter((r) => r.type === "document");
      if (documentRows.length) {
        try {
          const execution = await createOnboardingRagExecution({
            apiClient: api, projectId, projectName: name.trim(), documents: documentRows,
          });
          setRagExecution(execution);
          startPipelineJobs(projectId, name.trim(),
            documentRows.map((r) => ({ documentName: r.name, documentPath: r.path, pipelineId: r.pipelineId || "" })));
          window.dispatchEvent(new Event(JOB_EVENT));
          if (execution.ingestion_warning) setErr(execution.ingestion_warning);
        } catch (e) {
          if (e.execution?.id) setRagExecution(e.execution);
          // RAG 적재 실패가 MCP 변환까지 막지는 않게 — 잡은 이미 접수됐다.
          setErr(`문서 적재를 시작하지 못했습니다: ${e.message || e}`);
        }
      }
    } catch (e) {
      setErr(e.message || "시작하지 못했습니다");
    } finally { setBusy(""); }
  };

  const enter = async () => {
    // 목록을 다시 불러오는 동안 화면이 그대로 멈춰 있었다. 눌린 흔적이 없으니 사용자는
    // 한 번 더 누르고, 그러면 이 함수가 두 번 돈다. 가드와 진행 표시를 함께 둔다.
    if (entering) return;
    setEntering(true);
    const started = performance.now();
    // 여기까지 왔으면 위자드는 할 일을 다 했다 — 이제야 draft 를 버린다.
    // (변환이 끝나지 않았어도 "백그라운드로 두고 들어가기" 로 오면 알림이 이어받는다.)
    dropDraft(did); setActiveDraft(null);
    try { await refresh(); } catch { /* 목록 갱신 실패해도 진입은 진행 */ }
    // 성공이든 실패든 반드시 여기를 지난다 — 로딩 화면에 갇히는 것이 가장 나쁜 결말이다.
    const left = MIN_ENTER_MS - (performance.now() - started);
    if (left > 0) await new Promise((r) => setTimeout(r, left));
    const projectId = projectIdForRagExecution(ragExecution, pidRef.current);
    if (projectId) switchTo(projectId);
    go("dashboard", ragExecution ? dashboardNavForRagExecution(ragExecution) : null);
    onClose?.();
  };

  // ── 현재 화면 결정 ─────────────────────────────────────
  const cur = subs[Math.min(subIdx, subs.length - 1)];


  // 도착하자마자 수집하지 않는다. 어떤 구독을 훑을지 고르는 것이 이 화면의 첫 일이고,
  // 그걸 정하기 전에 시작하면 필요 없는 구독까지 훑은 뒤 고쳐서 다시 돌려야 한다.
  //
  // (예전에 자동 실행을 넣은 이유는 "버튼을 누르게 하면 아무 일도 안 일어나는 화면을 한 번
  //  지나야 한다" 였다. 구독 선택이 그 화면의 할 일이 되면서 그 걱정은 사라졌다 —
  //  화면이 비어 있지 않고 고를 것이 있다.)
  const documentsReady = !selected.includes("document")
    || ragDocumentsHavePipelineSelections(docs);
  // 활용 경로가 비어 있는 문서 수. 0 이 아니면 시작 버튼이 잠기는데, 그 이유가
  // 화면 어디에도 없으면 "왜 버튼이 안 눌리지" 로 끝난다. 아래 발문에 그대로 적는다.
  const docsPending = cur?.id === "in:document"
    ? docs.filter((d) => !d.pipelineId).length : 0;
  // 수집을 한 번도 안 돌린 채로 넘어가면 이 채널은 도구 0개로 끝난다. 넘어간 뒤에 알게 되면
  // 되돌아와야 하므로, 아직 아무것도 못 찾은 상태에서는 다음으로 보내지 않는다.
  // 클라우드 스텝은 둘이다(API 카드 · DB 카드). 같은 화면을 공유하고 훑기도 한 번이지만,
  // 보여주는 바구니와 통과 조건은 각자 자기 것이다 — 앞에서 갈라 놓고 여기서 섞으면
  // 두 카드를 왜 갈랐는지 알 수 없게 된다.
  // 클라우드 스텝은 하나이고 그 안에서 고른 것만 확인한다. 고른 쪽이 다 찼을 때 넘어간다 —
  // API 만 골랐는데 DB 가 없다고 막으면 영영 못 넘어간다.
  const cloudReady = cur?.id !== "in:cloud" ? true
    : (!selected.includes("cloud") || cloudApi.length > 0)
      && (!selected.includes("clouddb") || cloudDb.length > 0);
  // 수집이 시작된 뒤에는 관심이 "무엇을 고를까" 에서 "무엇을 찾았나" 로 옮겨간다.
  // 그때부터 고르기·포트 상자를 접어 로그가 화면 안에 들어오게 한다.
  const collapsed = busy === "cloud" || cloudLog.length > 0;
  // 문서를 담았고 적재 실행이 걸렸다면, MCP 변환이 끝나도 이 트랙은 계속 돈다.
  // 변환·완료 화면이 "다 끝났다" 로 보이지 않게 하는 유일한 신호다.
  // 이음: 문서는 접수만 한다(ingestion_warning). 그때는 '백그라운드에서 계속' 이라고 말하지 않는다
  const docsRunning = big >= 3 && !!ragExecution && !ragExecution.ingestion_warning;
  const canNext = big === 0 ? !!name.trim()
    : big === 1 && cur.id === "pick" ? selected.length > 0
      : big === 1 ? documentsReady && cloudReady
        : true;

  const goNext = () => {
    setErr("");
    if (big === 0) return setBig(1);
    if (big === 1) {
      // 담지 않은 입력을 들고 넘어가면 값이 사라진다. 막지 않으면 "다 적었는데 아무것도
      // 안 만들어졌다" 로만 드러나고, 그때는 이미 화면이 넘어간 뒤다.
      if (cur.id === "in:code" && codePending) {
        return setErr(editIdx >= 0
          ? "고친 내용을 아직 반영하지 않았습니다 — 수정 반영을 누르거나 비우고 넘어가세요"
          : "입력한 저장소를 아직 담지 않았습니다 — 담기를 누르거나 비우고 넘어가세요");
      }
      if (subIdx < subs.length - 2) return setSubIdx(subIdx + 1);
      return start();                       // 마지막 입력 뒤 = 함께 읽기
    }
    if (big === 3) return setBig(4);
    if (big === 4) return setBig(5);
  };
  const goPrev = () => {
    setErr("");
    if (big === 1 && subIdx > 0) return setSubIdx(subIdx - 1);
    if (big > 0) return setBig(big - 1);
  };

  // ── 렌더 조각 ──────────────────────────────────────────
  const subBar = (
    <>
      <SubDots
        index={big === 0 ? 0 : big >= 3 ? subs.length - 1 : subIdx}
        total={big === 0 ? 1 : Math.max(subs.length, 1)}
        pending={big === 1 && !selected.length ? 2 : 0}
        label={big === 0 ? "프로젝트 · 1 / 1"
          : big === 3 ? "도구 만들기 — 변환 중"
            : big === 4 ? "프로젝트 소개 — 마지막 한 가지"
            : big === 5 ? "완료 — 결과"
              : `연결 · ${subIdx + 1} / ${subs.length}${cur ? ` — ${stepAction(cur, { cloudDone, cloudReady: !!azureAcct })}` : ""}`}
      />
      <span style={{ flex: 1 }} />
      <span className="mono" style={{
        fontSize: 9.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999,
        background: "var(--blue-bg)", color: "var(--blue)",
        border: "1px solid color-mix(in srgb,var(--blue) 30%,transparent)",
      }}>외부와 완전히 차단됨</span>
    </>
  );

  const footer = (
    <>
      <Btn kind="ghost" onClick={goPrev} style={{ visibility: big === 0 && subIdx === 0 ? "hidden" : "visible" }}>← 이전</Btn>
      {err
        ? <span style={{ fontSize: 12, color: "var(--red)" }}>⚠ {err}</span>
        : docsPending
          // 잠긴 이유는 잠긴 버튼 옆에 적는다. 회색 안내로 두면 앞의 "넘어가도 됩니다"
          // 와 같은 무게로 읽혀서, 정작 막고 있는 조건이 눈에 들어오지 않는다.
          ? <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.3,
                           fontWeight: 700, color: "var(--amber)" }}>
              <span className="onb-need-dot" />
              문서 {docsPending}개의 <b style={{ color: "var(--amber)" }}>활용 경로</b>를 골라야 시작할 수 있습니다
            </span>
          : !cloudReady
            ? <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.3,
                             fontWeight: 700, color: "var(--amber)" }}>
                <span className="onb-need-dot" />
                {busy === "cloud" ? <>수집이 끝나면 다음으로 넘어갈 수 있습니다</>
                  : <><b style={{ color: "var(--amber)" }}>수집 시작</b>을 눌러 리소스를 찾아야 넘어갈 수 있습니다</>}
              </span>
            : docsRunning
              // 문서→벡터 적재는 변환이 끝난 뒤에도 계속 돈다. 이 줄이 없으면 도구 0개인
              // 채로 끝난 화면이 되어, 사용자는 문서가 누락됐다고 읽고 되돌아온다.
              ? <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12,
                               fontWeight: 650, color: "var(--green)", maxWidth: 720, lineHeight: 1.5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                                 background: "var(--green)",
                                 animation: "dotPulse 1.1s ease-in-out infinite" }} />
                  문서는 접수했습니다. 적재(RAG)는 이음 시연 범위 밖이라 접수까지만 합니다.
                </span>
              : <span style={{ fontSize: 12, color: "var(--muted)" }}>{footHint(big, cur, selected)}</span>}
      <span style={{ flex: 1 }} />
      {big === 5
        // 오버레이가 덮지만 버튼도 함께 잠근다 — 덮개는 보이는 방어고, disabled 는 실제 방어다.
        ? <Btn onClick={enter} disabled={entering}>
            {entering ? "여는 중…" : "플랫폼 들어가기 →"}
          </Btn>
        : big === 4
          // 저장·건너뛰기는 폼 안의 버튼이 맡는다 — 푸터는 비워 둔다
          ? <span />
        : big === 3
          ? <Btn onClick={() => setBig(4)} disabled={!runDone}>
              {runDone ? "다음 →" : "변환이 끝나면 열립니다"}
            </Btn>
          : <Btn onClick={goNext} disabled={!canNext || !!busy}>{nextLabel(big, cur, subs, selected, busy, { cloudDone, cloudReady: !!azureAcct })}</Btn>}
    </>
  );

  return (
    <Shell steps={BIG} step={big} sub={subBar} footer={footer} onClose={onClose}
      agent={<AgentFor big={big} cur={cur} selected={selected} checked={checked} name={name} />}
      overlay={entering && <EnteringVeil />}>
      {big === 0 && (
        /* 좌: 소개 판 · 우: 입력 폼.
           둘 다 배경 없이 두면 어디까지가 소개고 어디부터 입력인지 눈이 못 가른다.
           왼쪽만 한 장의 판으로 묶고 오른쪽은 맨바닥에 둬서 경계를 만든다. */
        <div style={{ flex: 1, minHeight: 0, display: "grid",
                      gridTemplateColumns: "minmax(0,1fr) 424px", gap: 44, alignItems: "center" }}>
          <div style={{
            position: "relative", overflow: "hidden", justifySelf: "end", width: "100%", maxWidth: 560,
            padding: "30px 32px 32px", borderRadius: 22,
            background: "linear-gradient(160deg,color-mix(in srgb,var(--blue) 7%,var(--card)) 0%,var(--card) 46%,var(--main) 100%)",
            border: "1px solid var(--line2)",
            boxShadow: "0 24px 60px -34px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.05)",
          }}>
            {/* 판 안쪽에서 은은하게 도는 빛 — 판이 단색 사각형으로 죽지 않게 하는 최소 장치. */}
            <div aria-hidden style={{
              position: "absolute", top: -110, right: -90, width: 300, height: 300, borderRadius: "50%",
              background: "radial-gradient(circle,color-mix(in srgb,var(--blue) 22%,transparent) 0%,transparent 68%)",
              pointerEvents: "none",
            }} />
            <div aria-hidden style={{
              position: "absolute", bottom: -130, left: -70, width: 280, height: 280, borderRadius: "50%",
              background: "radial-gradient(circle,color-mix(in srgb,var(--purple) 16%,transparent) 0%,transparent 70%)",
              pointerEvents: "none",
            }} />

            <div style={{ position: "relative" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 999,
                background: "color-mix(in srgb,var(--blue) 13%,transparent)",
                border: "1px solid color-mix(in srgb,var(--blue) 30%,transparent)",
                fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, letterSpacing: ".06em",
                color: "var(--blue)", textTransform: "uppercase",
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2 4.5 13H11l-1 9 8.5-11H12z" />
                </svg>
                이음 온보딩
              </span>

              <div style={{ marginTop: 20 }}><IntroIllust /></div>

              <div style={{ fontSize: 21, fontWeight: 800, color: "var(--navy)",
                            letterSpacing: "-.025em", marginTop: 24, lineHeight: 1.35 }}>
                기존 시스템을 <span style={{ color: "var(--blue)" }}>AI 가 쓸 수 있는 도구</span>로
              </div>
              <div style={{ fontSize: 12.8, color: "var(--muted)", marginTop: 8, lineHeight: 1.65 }}>
                소스 코드·API·데이터베이스를 읽어 도구로 바꿉니다.
                모든 처리는 이 서버 안에서 끝납니다.
              </div>

              {/* 판 위에 또 카드를 얹으면 층이 겹쳐 지저분해진다 — 세로선 하나로 순서만 보여준다. */}
              <div style={{ position: "relative", marginTop: 24, paddingLeft: 4 }}>
                <span aria-hidden style={{
                  position: "absolute", left: 14, top: 12, bottom: 12, width: 1,
                  background: "linear-gradient(180deg,color-mix(in srgb,var(--blue) 42%,transparent),transparent)",
                }} />
                {[["연결", "읽어올 곳을 고릅니다"],
                  ["확인", "찾은 것을 확인합니다"],
                  ["도구 만들기", "MCP 도구로 등록합니다"]].map(([t, d], i) => (
                  <div key={t} style={{
                    position: "relative", display: "flex", alignItems: "center", gap: 14, padding: "8px 0",
                    animation: "fadeUp .38s ease-out both", animationDelay: `${0.08 + i * 0.07}s`,
                  }}>
                    <span className="mono" style={{
                      position: "relative", zIndex: 1, width: 21, height: 21, flexShrink: 0, borderRadius: "50%",
                      display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700,
                      background: "var(--app)", color: "var(--blue)",
                      border: "1px solid color-mix(in srgb,var(--blue) 45%,transparent)",
                    }}>{i + 2}</span>
                    <span style={{ fontSize: 12.6, fontWeight: 700, color: "var(--navy)", width: 88 }}>{t}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 23, fontWeight: 800, color: "var(--navy)", letterSpacing: "-.03em" }}>
              프로젝트 정보
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 7, marginBottom: 22 }}>
              생성하려는 프로젝트 정보를 입력하세요.
            </div>
            <Field label="프로젝트명" value={name} onChange={setName} mono={false}
              placeholder="예) 계약 시스템" />
            <Field label="설명" hint="건너뛰어도 됩니다" value={desc} onChange={setDesc} mono={false}
              placeholder="예) 계약·고객 조회를 담당하는 사내 시스템" />
            <div style={{
              marginTop: 4, padding: "11px 13px", borderRadius: 11, background: "var(--main)",
              border: "1px solid var(--line2)", fontSize: 11.8, color: "var(--muted)", lineHeight: 1.6,
            }}>
              연결한 시스템과 만들어진 도구가 <b style={{ color: "var(--text)" }}>이 이름 아래</b> 모입니다.
              시스템별로 프로젝트를 나눠 담아도 됩니다.
            </div>
          </div>
        </div>
      )}

      {big === 1 && cur.id === "pick" && (
        <>
          <Ask q="무엇을 연결할까요?"
            why={<>기존 시스템을 읽어서 <b style={{ color: "var(--navy)" }}>AI 가 쓸 수 있는 도구</b>로 바꿉니다.
              이 서버와 같은 사내망에 있는 것만 연결됩니다.</>}
            badge={
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, padding: "5px 12px",
                borderRadius: 999, background: "var(--purple-bg)",
                border: "1px solid color-mix(in srgb,var(--purple) 32%,transparent)",
                color: "var(--purple)", fontSize: 11.5, fontWeight: 700,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>
                여러 개를 함께 고를 수 있습니다 — 한 번에 진행됩니다
              </span>
            } />
          {/* 시트가 이 영역 안에서만 밀려 나오도록 기준점을 만든다. Shell 의 본문 패딩까지
              덮어야 패널 오른쪽 경계에 붙어 보이므로 시트 쪽에서 음수 inset 을 쓴다. */}
          <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <SourcePicker selected={selected} onToggle={toggle} onPickChannels={pickChannels}
            openGroup={openGroup} onOpenGroup={setOpenGroup} rows={cardRows} />
          <SelectionSummary selected={selected} onRemove={toggle}
            total={Object.keys(CHANNEL_TITLE).length} />
          <SourceSheet groupId={openGroup} selected={selected} onPick={pickChannels}
            onClose={() => setOpenGroup(null)}
            extras={{
              // 같은 블록이 두 카드에 선다. 상태(azureAcct)는 하나뿐이라 한쪽에서 로그인하면
              // 다른 쪽은 이미 완료된 상태로 열린다 — 공유 장치를 새로 만들 필요가 없다.
              cloud: <CloudSso acct={azureAcct} subs={azureSubs} onConnected={onCloudConnected}
                       what="API 서버" from="데이터베이스 탐색" />,
              clouddb: <CloudSso acct={azureAcct} subs={azureSubs} onConnected={onCloudConnected}
                       what="관리형 데이터베이스" from="API 탐색" />,
            }} />
          </div>
        </>
      )}

      {big === 1 && cur.id === "in:code" && (
        <>
          <Ask q="읽을 소스 코드를 담아주세요"
            why={<>주소를 넣거나 폴더를 고른 뒤 <b style={{ color: "var(--navy)" }}>담기</b>를 누르세요.
              <b style={{ color: "var(--navy)" }}> 여러 개를 담을 수 있습니다.</b></>} />

          {/* 좌 폼 / 우 고정 목록. 담을수록 세로가 자라지 않게 목록을 옆으로 눕혔다. */}
          <div style={{ flex: 1, minHeight: 0, display: "grid",
                        gridTemplateColumns: "minmax(0,1fr) 392px", gap: 22 }}>
            <div style={{ minHeight: 0, display: "flex", flexDirection: "column", overflow: "auto" }}
                 className="onb-scroll">
              <Segment value={draftCode.mode}
                onChange={(m) => { setDraftCode({ ...draftCode, mode: m }); setPickerOpen(false); }}
                options={[["git", "Git 주소"], ["folder", "이 서버의 폴더"]]} />

              {/* 저장소 하나에 대한 입력을 한 카드로 묶는다. 호출 주소·DB 연결을 바깥에 두면
                  같은 저장소에 딸린 값인데도 다른 리소스 기재란처럼 읽힌다. 실제로 그렇게
                  보였다 — 묶이는 것은 테두리가 정하지, 순서가 정하지 않는다. */}
              <div style={{
                padding: "15px 16px 3px", borderRadius: 14, marginBottom: 13, flexShrink: 0,
                background: "var(--main)", border: "1px solid var(--line2)",
              }}>

              {draftCode.mode === "git" ? (
                <Field label="저장소 주소" value={draftCode.repoUrl} req
                  onChange={(v) => setDraftCode({ ...draftCode, repoUrl: v })}
                  placeholder="https://git.pps.local/finl/finl-web.git" compact />
              ) : (
                <div style={{ marginBottom: 13 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text)", marginBottom: 5, fontWeight: 650 }}>
                    폴더 경로<ReqTag req />
                  </label>
                  <div style={{ display: "flex", gap: 9 }}>
                    <input value={draftCode.path} placeholder="/srv/legacy/contract-api"
                      onChange={(e) => setDraftCode({ ...draftCode, path: e.target.value })}
                      style={{ ...inpStyle, flex: 1,
                        border: "1px solid color-mix(in srgb,var(--blue) 34%,var(--line2))",
                        borderLeft: "2.5px solid var(--blue)" }} />
                    <Btn kind="ghost" onClick={() => setPickerOpen((v) => !v)}
                      style={{ padding: "10px 14px", fontSize: 12 }}>
                      {pickerOpen ? "닫기" : "폴더 찾기"}
                    </Btn>
                  </div>
                  {pickerOpen && (
                    <div style={{ marginTop: 10 }}>
                      <FolderPicker value={draftCode.path}
                        onPick={(pth) => { setDraftCode({ ...draftCode, path: pth }); setPickerOpen(false); }} />
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
                <Field label="브랜치" hint="비우면 기본" value={draftCode.branch} compact
                  onChange={(v) => setDraftCode({ ...draftCode, branch: v })} placeholder="release" />
                <Field label="하위 경로" value={draftCode.subpath} compact
                  onChange={(v) => setDraftCode({ ...draftCode, subpath: v })} placeholder="services/contract" />
              </div>
              {draftCode.mode === "git" && (
                <Field label="접속 키" hint="비공개 저장소면" value={draftCode.tokenRef} compact
                  onChange={(v) => setDraftCode({ ...draftCode, tokenRef: v })}
                  placeholder="${vault:gitlab#read_token}" />
              )}
              <Field label="이 시스템 이름" hint="비우면 저장소 이름" mono={false} compact
                value={draftCode.name} onChange={(v) => setDraftCode({ ...draftCode, name: v })}
                placeholder="예) 계약 서비스" />

              {/* 코드에는 경로만 있고 그 서비스가 어디 떠 있는지·어느 DB 를 보는지는 배포
                  설정에 있다. 비워도 도구는 만들어지지만, 부를 수 없는 도구는 목록에
                  오르지 않으므로(게시 검증이 막는다) 여기서 받아 둔다.

                  테두리를 두르지 않고 구분선만 긋는다. 상자를 또 만들면 같은 저장소 안의
                  구획이 아니라 별개의 대상으로 읽힌다 — 위 카드에 딸린 아랫단이어야 한다. */}
              <div style={{ marginTop: 4, paddingTop: 12, borderTop: "1px dashed var(--line2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <b style={{ fontSize: 12, color: "var(--navy)" }}>이 저장소를 부를 때 필요한 정보</b>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    비워도 됩니다 — 채워야 도구를 실제로 부를 수 있습니다
                  </span>
                </div>
                {/* 코드에는 경로만 있고 자기 주소는 없다 — 그건 배포가 정하는 값이라
                    사람이 알려줘야 한다. 비면 만들어진 도구가 "주소 미지정" 으로 남는다. */}
                <Field label="이 서비스 주소" hint="코드에는 없는 값입니다" value={draftCode.baseUrl} compact
                  onChange={(v) => setDraftCode({ ...draftCode, baseUrl: v })}
                  placeholder="http://10.0.2.11:8080" />
                {/* 사용자가 모르는 값을 빈칸으로 요구하지 않는다. 클라우드에서 이미 찾은
                    서버가 있으면 그 주소를 눌러 채운다.

                    이게 "양방향 검증 완료" 가 0 으로 나오던 원인의 실질적 해법이다. 대조는
                    리소스마다 자기 base_url 로만 도는데, 이 칸이 비면 코드 쪽은 아무것도
                    만나지 못하고 클라우드 쪽은 별개 리소스로 남아 두 집합이 영영 교차하지
                    않는다. 경로 이름만 보고 합치는 방법도 있지만, /health 같은 흔한 경로에서
                    다른 서비스를 같은 것으로 단정하게 되어 쓰지 않는다. */}
                <AddressPicks found={cloudApi} onPick={(u) => setDraftCode({ ...draftCode, baseUrl: u })} />
                {/* 접속 문자열을 여기서 받지 않는다. API 를 넣는 화면에서 DB 접속을 묻는 것으로
                    보였고, 같은 값을 데이터베이스 탐색에서 또 적게 됐다. 등록처는 DB 카드
                    하나이고 여기는 **고르기만** 한다 — 코드에서 찾은 조회 함수가 부를 곳이다. */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, color: "var(--text)",
                                  marginBottom: 6, fontWeight: 650 }}>
                    코드가 조회할 데이터베이스
                    <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: 6 }}>선택</span>
                  </label>
                  <select value={draftCode.dbId || ""}
                    onChange={(e) => setDraftCode({ ...draftCode, dbId: e.target.value })}
                    style={{
                      background: "var(--main)", border: "1px solid var(--line2)", borderRadius: 10,
                      padding: "10px 13px", fontSize: 12.5, color: "var(--navy)", width: "100%",
                      fontFamily: "var(--sans)", outline: "none",
                    }}>
                    <option value="">연결 안 함</option>
                    {dbList.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.55 }}>
                    {dbList.length
                      ? "코드 안의 조회 함수가 이 접속으로 호출됩니다."
                      : <>등록된 데이터베이스가 없습니다 — <b style={{ color: "var(--navy)" }}>데이터베이스 탐색</b> 카드에서 먼저 추가하세요.</>}
                  </div>
                </div>
              </div>
              </div>{/* 저장소 카드 끝 */}

              {/* 담기는 스크롤과 무관하게 늘 보여야 한다. 폼 흐름 안에 두면 폼이 길어질수록
                  아래로 밀려나고, 그 순간 화면에서 가장 눈에 띄는 버튼은 우하단 "다음" 이 된다.
                  그래서 주소만 적고 담지 않은 채 넘어가는 길이 열렸다. 바닥에 붙여 둔다. */}
              <div style={{
                position: "sticky", bottom: 0, zIndex: 2, marginTop: "auto",
                display: "flex", alignItems: "center", gap: 12,
                padding: "11px 13px", borderRadius: 12,
                background: codePending ? "var(--amber-bg)" : "var(--main)",
                border: `1px solid ${codePending
                  ? "color-mix(in srgb,var(--amber) 40%,transparent)" : "var(--line2)"}`,
                transition: "background .18s ease, border-color .18s ease",
              }}>
                {/* 값이 유효해지는 순간에만 맥동시킨다. 늘 움직이면 배경이 되어 안 보인다. */}
                <Btn onClick={addCode} disabled={!codeReady}
                  style={codePending ? { animation: "pulseRing 1.9s ease-out infinite" } : undefined}>
                  {editIdx >= 0 ? "수정 반영 →" : "＋ 담기 →"}
                </Btn>
                {/* 담기를 강제하면 "적다가 그만두는" 길이 막힌다. 버리고 가는 문을 같이 연다. */}
                {codePending && (
                  <Btn kind="ghost" style={{ padding: "10px 14px", fontSize: 12 }}
                    onClick={() => { setDraftCode(nextDraft(draftCode)); setEditIdx(-1); setPickerOpen(false); }}>
                    비우기
                  </Btn>
                )}
                <span style={{ fontSize: 11.8, lineHeight: 1.55,
                               color: codePending ? "var(--amber)" : "var(--muted)" }}>
                  {!codePending
                    ? "담으면 오른쪽 목록에 추가되고 이 칸은 비워집니다"
                    : editIdx >= 0
                      ? <>고친 내용이 <b>아직 반영되지 않았습니다</b> — 눌러야 오른쪽 목록에 반영됩니다</>
                      : <>입력한 저장소가 <b>아직 담기지 않았습니다</b> — 눌러야 오른쪽 목록에 들어갑니다</>}
                </span>
              </div>
            </div>

            <Basket title="담은 저장소" items={codes.map((c, i) => ({
              key: i, name: c.name || codeLabel(c), icon: codeIcon(c),
              badge: <span style={c.mode === "git" ? bdGit : bdFolder}>{c.mode === "git" ? "Git" : "서버 폴더"}</span>,
              detail: codeDetail(c),
            }))} onEdit={editCode} onRemove={removeCode}
              hint="저장소마다 별도 시스템으로 잡힙니다"
              emptyHint="최소 1개는 담아야 다음으로 갑니다" />
          </div>
        </>
      )}

      {big === 1 && cur.id === "in:cloud" && (
        <>
          {/* 로그인은 앞 화면에서 끝났고, 여기서는 어디를 훑을지 정하고 수집을 실행한다. */}
          <Ask q={busy === "cloud" ? "구독을 훑는 중입니다"
            : cloudDone ? "찾은 리소스를 확인해 주세요" : "어떤 구독을 훑을까요?"}
            why={busy === "cloud"
              ? <>{azureAcct?.username} 계정으로 <b style={{ color: "var(--navy)" }}>{cloudProg.total}개 구독</b>에서
                  서버와 데이터베이스를 찾고 있습니다. 계정 권한 그대로 조회하며 토큰은 저장하지 않습니다.</>
              : cloudDone
                ? <>{azureAcct?.username} 계정으로 <b style={{ color: "var(--navy)" }}>{pickedSubs.size}개 구독</b>을 훑었습니다.
                    뺄 것이 있으면 지우고, 구독을 바꾸려면 왼쪽에서 고쳐 다시 수집하세요.</>
                : <>훑을 구독을 고른 뒤 <b style={{ color: "var(--navy)" }}>수집 시작</b>을 누르세요.
                    고른 구독 안의 서버와 데이터베이스만 찾아 옵니다 — 계정 권한 그대로 조회하며 토큰은 저장하지 않습니다.</>} />

          <div style={{ flex: 1, minHeight: 0, display: "grid",
                        gridTemplateColumns: cloudDone ? "360px minmax(0,1fr)" : "minmax(0,1fr) 392px",
                        gap: 22 }}>
            {/* 수집 전에는 상자들이 길어질 수 있어 이 열이 스크롤된다. 수집이 시작되면
                접힌 상자 + 남는 높이를 먹는 로그로 바뀌므로 열 스크롤을 끈다 — 켜 두면
                로그 상자가 자기 높이를 못 정해 바깥으로 넘치고 스크롤이 두 겹이 된다. */}
            <div className="onb-scroll" style={{ overflowY: collapsed ? "hidden" : "auto", paddingRight: 4,
                                                 display: "flex", flexDirection: "column", gap: 14,
                                                 minHeight: 0,
                                                 order: cloudDone ? 1 : 0 }}>
              {/* 로그인은 앞 화면(연결 방법 시트)에서 끝난다. 여기서 한 번 더 물으면 같은 일을
                  두 번 시키는 화면이 되고, 사용자는 "아까 한 로그인이 안 먹었나" 로 읽는다.
                  아직 연결이 없을 때만 앞으로 돌려보낸다 — 막다른 화면을 만들지 않는다. */}
              {!azureAcct && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 13,
                  background: "var(--card)", border: "1px solid color-mix(in srgb,var(--blue) 28%,var(--line2))",
                }}>
                  <span style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.6 }}>
                    아직 클라우드 계정이 연결되지 않았습니다
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                      연결은 앞 화면에서 합니다
                    </span>
                  </span>
                  <span style={{ flex: 1 }} />
                  <Btn kind="ghost" onClick={() => { setSubIdx(0); setOpenGroup("api"); }}
                    style={{ padding: "9px 14px", fontSize: 12, flexShrink: 0 }}>
                    ← 앞 화면에서 연결하기
                  </Btn>
                </div>
              )}

              <CloudStep n={1} title="훑을 구독 고르기"
                done={!!azureAcct && pickedSubs.size > 0} active={!!azureAcct && !scannedRef.current}
                locked={!azureAcct}
                compact={collapsed}
                summary={pickedSubs.size === 1
                  ? azureSubs.find((s) => pickedSubs.has(s.id))?.name
                  : `${pickedSubs.size}개 선택`}
                desc={azureAcct ? `${azureSubs.length}개 구독에 접근할 수 있습니다. 체크한 구독만 훑습니다.`
                  : "앞 화면에서 계정을 연결하면 접근 가능한 구독이 여기에 나옵니다."}>
                {!!azureSubs.length && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>
                        {pickedSubs.size} / {azureSubs.length} 선택
                      </span>
                      <button onClick={() => setPickedSubs(new Set(
                        pickedSubs.size === azureSubs.length ? [] : azureSubs.map((x) => x.id)))}
                        style={{
                          marginLeft: "auto", padding: "4px 9px", borderRadius: 7, fontSize: 10.5,
                          border: "1px solid var(--line2)", background: "transparent",
                          color: "var(--muted)", cursor: "pointer", fontFamily: "var(--sans)",
                        }}>
                        {pickedSubs.size === azureSubs.length ? "모두 해제" : "모두 선택"}
                      </button>
                    </div>
                    {azureSubs.map((sub) => {
                      const on = pickedSubs.has(sub.id);
                      return (
                        <div key={sub.id} onClick={() => setPickedSubs((c) => {
                          const n = new Set(c); n.has(sub.id) ? n.delete(sub.id) : n.add(sub.id); return n;
                        })} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", marginBottom: 6,
                          borderRadius: 10, cursor: "pointer", background: on ? "var(--sel)" : "var(--main)",
                          border: `1px solid ${on ? "var(--sel-border)" : "var(--line2)"}`,
                        }}>
                          <span style={{
                            width: 17, height: 17, flexShrink: 0, borderRadius: 5, display: "grid", placeItems: "center",
                            border: `2px solid ${on ? "var(--sel-border)" : "var(--line2)"}`,
                            background: on ? "var(--sel-border)" : "transparent",
                          }}>
                            {on && (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#06231f" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            )}
                          </span>
                          <span style={{ fontSize: 12.3, fontWeight: 650, color: "var(--navy)", overflow: "hidden",
                            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.name}</span>
                        </div>
                      );
                    })}
                  </>
                )}
              </CloudStep>

              {/* 포트를 **필수로 먼저** 묻지 않는 이유 — 대부분은 자기 조직의 API 포트를 모른다.
                  모르는 것을 먼저 물으면 진행이 막히고 화면이 전문가용으로 읽힌다. 아는 사람은
                  한 번에 끝낼 수 있어야 하므로 접어서 열어 두고, 못 찾은 뒤에 한 번 더 묻는다. */}
              <CloudStep n={2} title="확인할 포트" active={!!azureAcct && pickedSubs.size > 0}
                locked={!azureAcct}
                compact={collapsed}
                summary={(() => {
                  const ps = parsePorts(extraPorts);
                  if (!ps.length) return "관례 포트만";
                  return ps.length === 1 ? ps[0] : `${ps[0]} 외 ${ps.length - 1}건`;
                })()}
                desc="흔히 쓰는 포트는 이미 확인합니다. 다른 포트를 쓰거나 설명서 주소가 표준이 아니면 여기에 적어 두세요.">
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 9 }}>
                  {COMMON_PORTS.map((p) => (
                    <span key={p} className="mono" style={{
                      fontSize: 10.5, padding: "3px 9px", borderRadius: 999,
                      background: "var(--main)", border: "1px solid var(--line2)", color: "var(--muted)",
                    }}>{p}</span>
                  ))}
                  <span style={{ fontSize: 10.5, color: "var(--faint)", alignSelf: "center" }}>기본 확인</span>
                </div>
                <input value={extraPorts} onChange={(e) => setExtraPorts(e.target.value)}
                  placeholder="예) 8082, 9000 — 비워도 됩니다"
                  style={{ ...inpStyle, width: "100%", fontSize: 12 }} />
                {/* 포트만으로 못 찾는 레거시가 실제로 있다. 그 탈출구가 여기 있다는 걸
                    입력칸 옆에서 한 번 알려준다 — 모르면 영영 못 찾고 끝난다. */}
                <div style={{ fontSize: 10.8, color: "var(--faint)", marginTop: 7, lineHeight: 1.55 }}>
                  설명서 주소가 <span className="mono">/openapi.json</span> 이 아니라면
                  <span className="mono" style={{ color: "var(--muted)" }}> 18001/ctlg/v2/api-docs </span>
                  처럼 경로까지 적을 수 있습니다.
                </div>
              </CloudStep>

              {/* 제목은 이 상자가 무엇인지 말하고, 버튼은 무엇을 할지 말한다. 둘 다 "다시 수집"
                  이면 같은 말이 위아래로 겹쳐 어느 쪽이 버튼인지 흐려진다. 수집이 시작된 뒤
                  이 상자의 정체는 로그이므로 제목은 로그로 두고, 실행은 헤더 우측으로 뺀다. */}
              <CloudStep n={3} title={collapsed ? "수집 로그" : "수집 시작"}
                done={!!cloudRes.length} active={!!azureAcct && pickedSubs.size > 0}
                locked={!azureAcct || !pickedSubs.size}
                grow={collapsed}
                action={collapsed ? (
                  <Btn kind="ghost" onClick={() => scanCloud()}
                    disabled={!pickedSubs.size || busy === "cloud"}
                    style={{ padding: "6px 12px", fontSize: 11.5 }}>
                    {busy === "cloud" ? "훑는 중…" : "다시 수집"}
                  </Btn>
                ) : null}
                desc={collapsed ? null
                  : pickedSubs.size ? `고른 ${pickedSubs.size}개 구독에서 서버와 데이터베이스를 찾아 옵니다.`
                    : "위에서 구독을 하나 이상 골라야 시작할 수 있습니다."}>
                {!collapsed && (
                  <Btn kind="primary" onClick={() => scanCloud()}
                    disabled={!pickedSubs.size || busy === "cloud"}>수집 시작 →</Btn>
                )}
                <ScanProgress busy={busy === "cloud"} log={cloudLog} prog={cloudProg} />
                {checked.cloud && !cloudDone && (
                  <div style={{ marginTop: 12 }}><OkLine>{checked.cloud}</OkLine></div>
                )}
              </CloudStep>
            </div>

            <div style={{ order: cloudDone ? 0 : 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {cloudDone && (
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 11, flexShrink: 0 }}>
                  <OkLine>{checked.cloud || `리소스 ${cloudRes.length}개를 찾았습니다`}</OkLine>
                </div>
              )}
              {/* 훑기는 한 번이고 바구니는 둘이다. 고른 것만 나란히 세운다 — 스텝을 둘로
                  나눠 같은 화면을 연달아 보여주면, 넘어가도 안 넘어간 것처럼 보여
                  버튼을 두 번 누르게 된다. 확인은 한 화면에서 끝낸다. */}
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {selected.includes("cloud") && (
                  <CloudBasket title="찾은 API 원천" items={cloudApi} busy={busy === "cloud"}
                    onRemove={(i) => setCloudApi((c) => c.filter((_, x) => x !== i))} />
                )}
                {selected.includes("clouddb") && (
                  <CloudBasket title="찾은 데이터베이스" items={cloudDb} busy={busy === "cloud"}
                    onRemove={(i) => setCloudDb((c) => c.filter((_, x) => x !== i))} />
                )}
              </div>
              {/* 못 찾은 서버는 포트 프로브의 부산물이라 API 를 골랐을 때만 뜬다.
                  데이터베이스만 고른 사람에게는 무슨 말인지 알 수 없는 상자다. */}
              {selected.includes("cloud") && !!cloudMissed.length && busy !== "cloud" && (

                <MissedVms items={cloudMissed} busy={busy} onProbe={probePort}
                  foundCount={cloudApi.length}
                  onDrop={(id) => setCloudMissed((m) => m.filter((v) => v.id !== id))} />
              )}
            </div>
          </div>
        </>
      )}

      {big === 1 && cur.id === "in:document" && (
        <>
          <Ask q="어떤 문서를 올릴까요?"
            why={<>PDF·DOCX·XLSX 를 올리면 검색용 지식으로 만듭니다.
              <b style={{ color: "var(--navy)" }}> 도구가 아니라 RAG 트랙</b>으로 들어갑니다.</>} />

          <div style={{ flex: 1, minHeight: 0, display: "grid",
                        gridTemplateColumns: "minmax(0,1fr) 392px", gap: 22 }}>
            <div style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
              {/* 배포 형태에 따라 고르는 곳이 다르다 — 구 위자드와 같은 분기다.
                  preview 는 서버 공유 폴더, local 은 내 컴퓨터. */}
              <input ref={docInputRef} type="file" multiple accept=".pdf,.docx,.xlsx" hidden
                onChange={(e) => { addLocalDocs(e.target.files || []); e.target.value = ""; }} />
              <button disabled={!appMode}
                onClick={() => (appMode === "preview" ? setDocOpen(true) : docInputRef.current?.click())} style={{
                display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left",
                padding: "18px 20px", borderRadius: 14, cursor: appMode ? "pointer" : "wait",
                opacity: appMode ? 1 : 0.65, background: "var(--card)",
                border: "1.5px dashed color-mix(in srgb,var(--amber) 45%,var(--line2))",
                fontFamily: "var(--sans)",
              }}>
                <span style={{
                  width: 40, height: 40, flexShrink: 0, borderRadius: 12, display: "grid",
                  placeItems: "center", background: "var(--amber-bg)",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--amber)"
                    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v12m0-12 4 4m-4-4-4 4" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
                  </svg>
                </span>
                <span>
                  <b style={{ display: "block", fontSize: 13.5, color: "var(--navy)" }}>
                    {appMode === "preview" ? "문서 폴더에서 고르기" : "내 컴퓨터에서 문서 고르기"}
                  </b>
                  <small className="mono" style={{ display: "block", marginTop: 4, fontSize: 10.5, color: "var(--muted)" }}>
                    {appMode === "preview" ? "폴더를 바꿔가며 반복해서 담을 수 있어요"
                      : "PDF·DOCX·XLSX 파일을 여러 개 선택할 수 있어요"}
                  </small>
                </span>
              </button>

              <div style={{
                marginTop: 14, padding: "11px 13px", borderRadius: 11, background: "var(--main)",
                border: "1px solid var(--line2)", fontSize: 11.8, color: "var(--muted)", lineHeight: 1.6,
              }}>
                문서는 도구가 아니라 <b style={{ color: "var(--text)" }}>검색용 지식</b>이 됩니다.
                올린 뒤 아래 과정을 거쳐 적재됩니다.
              </div>

              {/* 올린 다음 무슨 일이 일어나는지 — 이걸 안 보여주면 파일을 고르고 나서
                  "이제 뭐가 되는 거지" 가 남는다. */}
              <div style={{ marginTop: "auto", paddingTop: 22 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 650,
                              letterSpacing: ".04em", marginBottom: 10 }}>
                  올린 뒤 진행되는 과정
                </div>
                <div style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
                  {[["자르기", "문단 단위로 나눕니다"],
                    ["임베딩", "의미를 벡터로 바꿉니다"],
                    ["색인", "검색에 쓸 수 있게 저장합니다"]].map(([t, d], i) => (
                    <Fragment key={t}>
                      {i > 0 && (
                        <span style={{ alignSelf: "center", color: "var(--faint)", fontSize: 13 }}>→</span>
                      )}
                      <div style={{
                        flex: 1, padding: "12px 13px", borderRadius: 11, background: "var(--card)",
                        border: "1px solid var(--line2)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span className="mono" style={{
                            width: 18, height: 18, borderRadius: 6, display: "grid", placeItems: "center",
                            fontSize: 9.5, fontWeight: 700, background: "var(--amber-bg)", color: "var(--amber)",
                          }}>{i + 1}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)" }}>{t}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5, lineHeight: 1.5 }}>{d}</div>
                      </div>
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>

            <Basket title="담은 문서" items={docs.map((d, i) => ({
              key: i, name: d.name, detail: `${d.dir} · ${d.meta}`,
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="1.9">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>,
              badge: <span style={{
                fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                background: "var(--amber-bg)", color: "var(--amber)",
                border: "1px solid color-mix(in srgb,var(--amber) 32%,transparent)", flexShrink: 0,
              }}>{d.type}</span>,
              control: (
                <select value={d.pipelineId || ""}
                  onChange={(e) => updateDocPipeline(i, e.target.value)}
                  // 비어 있는 동안만 깜빡인다 — 고르고 나면 조용해지므로,
                  // 남은 깜빡임 개수가 곧 "아직 할 일" 이 된다.
                  className={d.pipelineId ? undefined : "onb-need"}
                  aria-label={`${d.name} 활용 경로`} style={{
                    width: 154, padding: "6px 8px", borderRadius: 8,
                    border: `1px solid ${d.pipelineId ? "var(--line2)" : "var(--amber)"}`,
                    background: d.pipelineId ? "var(--main)" : "var(--amber-bg)",
                    color: d.pipelineId ? "var(--navy)" : "var(--amber)",
                    fontWeight: d.pipelineId ? 400 : 700,
                    fontSize: 10.5, cursor: "pointer",
                  }}>
                  <option value="">활용 경로 선택 *</option>
                  {RAG_DOCUMENT_PIPELINE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              ),
            }))}
              onRemove={(i) => setDocs((c) => c.filter((_, x) => x !== i))}
              hint="검색용 지식으로 적재됩니다"
              emptyHint="문서 없이 진행해도 됩니다"
              emptyAction="왼쪽에서 문서를 고르면 바로 담깁니다" />
          </div>
        </>
      )}

      {big === 1 && cur.id === "in:openapi" && (
        <>
          <Ask q="API 주소를 알려주세요"
            why={<>API 설명서(Swagger)가 열려 있는 주소입니다. 그 안의 기능들이 도구로 바뀝니다.</>} />
          <div style={{ maxWidth: 760, marginTop: 22 }}>
            <Field label="API 설명서 주소" value={openapi.url}
              onChange={(v) => setOpenapi({ ...openapi, url: v })}
              placeholder="http://contract-api.local:8080/openapi.json"
              help={<>보통 <b>/openapi.json</b> 또는 <b>/v3/api-docs</b> 로 끝납니다.</>} />
            <Field label="이 시스템을 뭐라고 부를까요" hint="비워두면 주소를 씁니다" mono={false}
              value={openapi.name} onChange={(v) => setOpenapi({ ...openapi, name: v })}
              placeholder="예) 계약 서비스" />
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
              <Btn kind="ghost" onClick={checkOpenapi} disabled={!openapi.url || busy === "openapi"}>
                {busy === "openapi" ? "확인하는 중…" : "연결 확인"}
              </Btn>
              {busy === "openapi" && <Eq />}
            </div>
            {checked.openapi && <OkLine>{checked.openapi}</OkLine>}
          </div>
        </>
      )}

      {big === 1 && cur.id === "in:db" && (
        <>
          <Ask q={cloudDb.length ? "온프렘 데이터베이스를 알려주세요" : "데이터베이스에 어떻게 접속하나요?"}
            why={<>표 구조를 읽어 조회 도구를 만듭니다. <b style={{ color: "var(--navy)" }}>데이터를 꺼내 보지는 않습니다.</b></>} />
          {/* 이 화면이 무엇을 **더** 받는 자리인지 먼저 말한다. 클라우드 구독 안의 관리형 DB 는
              앞 단계에서 이미 담겼는데, 그걸 모르면 같은 것을 또 넣거나 "왜 또 묻지" 로 읽는다. */}
          <DbScopeNote found={cloudDb} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 26px", maxWidth: 940, marginTop: 22 }}>
            <Field label="데이터베이스 주소" value={db.hostDb} onChange={(v) => setDb({ ...db, hostDb: v })}
              placeholder="postgres.local:5432/contract_db"
              help="인프라 팀에서 알려줄 수 있습니다." />
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12.5, color: "var(--text)", marginBottom: 7, fontWeight: 650 }}>
                종류
              </label>
              <select value={db.driver} onChange={(e) => setDb({ ...db, driver: e.target.value })} style={{
                background: "var(--main)", border: "1px solid var(--line2)", borderRadius: 11,
                padding: "12px 15px", fontSize: 13.5, color: "var(--navy)", width: "100%",
                fontFamily: "var(--sans)", outline: "none",
              }}>
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL / MariaDB</option>
                <option value="oracle">Oracle</option>
                <option value="mssql">SQL Server</option>
              </select>
            </div>
            <Field label="접속 계정" hint="읽기 권한만 있으면 됩니다" value={db.user}
              onChange={(v) => setDb({ ...db, user: v })} placeholder="pps_reader" />
            <Field label="비밀번호" hint="이름만 적습니다" value={db.secret}
              onChange={(v) => setDb({ ...db, secret: v })} placeholder="${vault:db#password}"
              help={<><b style={{ color: "var(--text)" }}>비밀번호를 직접 적지 않습니다.</b> 이 서버에 보관된 값의 이름만 적으면, 쓸 때만 꺼내 씁니다.</>} />
          </div>
        </>
      )}

      {big === 1 && cur.id === "run" && (
        <>
          <Ask q="다 넣으셨습니다" why={<>고르신 {selected.length}가지를 한 번에 읽고 도구로 바꿉니다.</>} />
          <Queue subs={subs} subIdx={subs.length - 1} checked={checked} />
        </>
      )}

      {big === 3 && (
        <RunScreen jobId={jobIdRef.current} name={name} docsRunning={docsRunning}
          onBackground={enter} onDone={() => setRunDone(true)} />
      )}

      {big === 4 && (
        <ProjectContextForm mode="onboarding" projectId={pidRef.current}
          onSaved={() => setBig(5)} onSkip={() => setBig(5)} />
      )}
      {big === 5 && <DoneScreen jobId={jobIdRef.current} name={name} docsRunning={docsRunning} />}

      {/* 문서 폴더 모달 — preview 배포에서만 뜬다. */}
      {docOpen && appMode === "preview" && (
        <DocCollect onClose={() => setDocOpen(false)} onConfirm={mergeDocs} />
      )}
    </Shell>
  );
}

/** 입력 큐 — 복수 선택의 가장 흔한 실패가 "지금 몇 번째지" 다. */
function Queue({ subs, subIdx, checked }) {
  const items = subs.filter((s) => s.id.startsWith("in:"));
  if (items.length < 2) return null;   // 하나뿐이면 큐가 정보를 더하지 않는다
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11, maxWidth: 1140 }}>
      {items.map((s) => {
        const i = subs.indexOf(s);
        const state = i < subIdx ? "done" : i === subIdx ? "now" : "todo";
        const sid = s.id.slice(3);
        return (
          <div key={s.id} style={{
            display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", borderRadius: 14,
            border: `1px solid ${state === "now" ? "var(--sel-border)" : state === "done" ? "#1c4a30" : "var(--line2)"}`,
            background: state === "now" ? "var(--sel)" : "var(--card)",
            opacity: state === "todo" ? 0.55 : 1,
            boxShadow: state === "now" ? "var(--sel-ring)" : "none",
          }}>
            <span style={{
              width: 30, height: 30, flexShrink: 0, borderRadius: 9, display: "grid", placeItems: "center",
              background: state === "done" ? "var(--green)" : state === "now" ? "var(--blue)" : "var(--main)",
              border: `1px solid ${state === "todo" ? "var(--line2)" : "transparent"}`,
            }}>
              {state === "done" && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>
              )}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 750, color: "var(--navy)" }}>{s.label}</span>
              <span style={{ display: "block", fontSize: 11.8, color: "var(--muted)", marginTop: 2 }}>
                {checked[sid] || (state === "now" ? "지금 입력하는 중" : state === "done" ? "입력함" : "다음에 입력")}
              </span>
            </span>
            {state === "now" && <Eq />}
          </div>
        );
      })}
    </div>
  );
}

/** 이 저장소에서 무엇을 찾아내는지. 원래 입력 폼 아래에 가로로 놓여 있었는데,
 *  폼이 길어지면 스크롤에 잘려 "있는지도 모르는 안내" 가 됐다. 설명은 설명이 모여 있는
 *  도우미 패널이 제자리다 — 폼은 입력만 남고 세로도 짧아진다. */
function FindsInRepo() {
  const rows = [
    ["밖에서 부르는 기능", "다른 시스템이 호출하던 창구", "var(--blue)", "var(--blue-bg)"],
    ["안에서만 쓰던 조회", "밖으로 열려 있지 않던 데이터 조회", "var(--purple)", "var(--purple-bg)"],
    ["API 설명서", "있으면 그대로 씁니다", "var(--muted)", "var(--main)"],
  ];
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 650,
                    letterSpacing: ".04em", marginBottom: 8 }}>
        이 저장소에서 찾는 것
      </div>
      <div style={{ display: "grid", gap: 7 }}>
        {rows.map(([t, d, tone, bg]) => (
          <div key={t} style={{
            padding: "9px 11px", borderRadius: 10, background: bg,
            border: `1px solid color-mix(in srgb,${tone} 24%,var(--line2))`,
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: tone }}>{t}</div>
            <div style={{ fontSize: 10.8, color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>{d}</div>
          </div>
        ))}
      </div>
      <HowWeFind steps={HOW_CODE} />
    </div>
  );
}

// 수집 절차 — 결과를 믿으려면 "무엇을 얻나" 만으로는 부족하고 "어떻게 얻나" 를 알아야 한다.
// 다만 이건 궁금한 사람만 읽는 내용이라 기본은 접어 둔다. 펴 두면 입력 화면이 설명서가 된다.
const HOW_CODE = [
  <>저장소 안에 <b>API 설명서 파일</b>이 있으면 그대로 씁니다 — 사람이 쓴 정답지라 가장 정확합니다.</>,
  <>없으면 <b>프로그램에서 명세를 직접 받아냅니다.</b> 설명과 예시까지 들어 있습니다.</>,
  <>그것도 없으면 <b>코드를 읽어 찾습니다.</b> 이때 결과는 추정이라 <b>확인이 필요하다고 표시</b>됩니다.</>,
  <>위와 <b>동시에</b> 밖으로 열려 있지 않은 <b>내부 조회 기능</b>도 찾아 함께 담습니다.</>,
];

const HOW_CLOUD = [
  <>고른 구독에서 <b>서버와 데이터베이스 목록</b>을 가져옵니다.</>,
  <>서버마다 주소를 알아내 <b>API 설명서가 열려 있는지 직접 확인</b>합니다.</>,
  <>설명서가 열려 있는 서버만 담습니다 — <b>서버 자체가 아니라 그 위의 API</b> 가 도구가 됩니다.</>,
  <>데이터베이스는 <b>표 구조</b>를 읽어 표마다 조회 도구를 만듭니다.</>,
];

/** 접이식 "어떻게 찾나요?" — 기본 접힘. */
function HowWeFind({ steps }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 12, border: "1px solid var(--line2)", borderRadius: 11,
                  background: "var(--card)", overflow: "hidden" }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
        background: "var(--main)", border: "none", cursor: "pointer", fontFamily: "var(--sans)",
      }}>
        <span style={{ fontSize: 11.8, fontWeight: 700, color: "var(--navy)" }}>어떻게 찾나요?</span>
        <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--faint)",
                       transition: "transform .18s ease", transform: open ? "rotate(180deg)" : "none" }}>▼</span>
      </button>
      {open && (
        <ol style={{ margin: 0, padding: "11px 12px 12px 28px", fontSize: 11.3,
                     color: "var(--text)", lineHeight: 1.7 }}>
          {steps.map((s, i) => <li key={i} style={{ marginBottom: 7 }}>{s}</li>)}
          <li style={{ listStyle: "none", marginLeft: -16, marginTop: 10, paddingTop: 9,
                       borderTop: "1px solid var(--line)", color: "var(--muted)" }}>
            정보를 <b style={{ color: "var(--navy)" }}>바꾸거나 지우는 기능은 만들지 않습니다.</b> 잘못 불리면 되돌릴 수 없습니다.
          </li>
        </ol>
      )}
    </div>
  );
}

function AgentFor({ big, cur, selected, checked, name }) {
  if (big === 0) {
    return <Agent headline="이름부터 정하고 시작합니다"
      facts={[
        { icon: ICO.ok, text: <>연결한 시스템과 도구가 <b>이 이름 아래</b> 모입니다</> },
        { icon: ICO.info, text: <>나중에 언제든 바꿀 수 있습니다</> },
      ]}
      note="프로젝트를 여러 개 만들어 시스템별로 나눠 담아도 됩니다." />;
  }
  if (big === 1 && cur?.id === "pick") {
    return <Agent headline={selected.length > 1 ? `${selected.length}가지를 함께 읽습니다` : "여러 개를 함께 고를 수 있습니다"}
      facts={[
        { icon: ICO.ok, text: <>각각 주소를 넣은 뒤 <b>한 번에 진행</b>됩니다</> },
        { icon: ICO.ok, text: <>겹치는 도구는 <b>자동으로 합쳐집니다</b></> },
        selected.length
          ? { icon: ICO.info, text: <>입력 화면이 <b>{selected.length}개</b> 이어집니다</> }
          : { icon: ICO.info, text: <>하나 이상 골라야 다음으로 갑니다</> },
      ]}
      note="소스 코드가 가장 많이 얻습니다. 설명서가 없어도 코드에서 API 와 DB 조회 함수를 찾아냅니다." />;
  }
  if (big === 1 && cur?.id === "in:code") {
    return <Agent status="입력 대기" headline="저장소 주소만 있으면 됩니다"
      facts={[
        { icon: ICO.ok, text: <>설명서가 없는 <b>내부 API</b> 도 찾아냅니다</> },
        { icon: ICO.ok, text: <>사본은 읽고 나면 <b>바로 지웁니다</b></> },
        { icon: ICO.info, text: <>비공개 저장소면 <b>읽기 권한 키</b>가 필요합니다</> },
      ]}
      note="코드에는 경로만 있고 그 서비스가 어디 떠 있는지는 없습니다. 호출 주소는 다음 단계에서 채웁니다."
      extra={<FindsInRepo />} />;
  }
  if (big === 1 && cur?.id === "in:cloud") {
    return <Agent status="연결 대기" headline="계정 권한 그대로 찾습니다"
      facts={[
        { icon: ICO.ok, text: <>구독의 <b>서버와 데이터베이스</b>를 함께 가져옵니다</> },
        { icon: ICO.no, text: <>로그인 토큰은 <b>저장하지 않습니다</b></> },
        { icon: ICO.info, text: <>지금은 <b>Azure</b> 만 연결됩니다</> },
      ]}
      note="서버는 그 안에 떠 있는 API 설명서를 찾아본 뒤, 있는 것만 담습니다."
      extra={<HowWeFind steps={HOW_CLOUD} />} />;
  }
  if (big === 1 && cur?.id === "in:document") {
    return <Agent status="입력 대기" headline="문서는 지식이 됩니다"
      facts={[
        { icon: ICO.ok, text: <>PDF·DOCX·XLSX 를 <b>여러 개</b> 한 번에 올립니다</> },
        { icon: ICO.info, text: <>도구가 아니라 <b>검색용 지식</b>으로 들어갑니다</> },
      ]}
      note="문서 없이 넘어가도 됩니다. 올린 문서는 잘라서 색인한 뒤 검색에 쓰입니다." />;
  }
  if (big === 1 && cur?.id === "in:openapi") {
    return <Agent status="입력 대기" headline="주소만 있으면 됩니다"
      facts={[
        { icon: ICO.ok, text: <>설명서에 적힌 기능이 <b>그대로 도구</b>가 됩니다</> },
        { icon: ICO.info, text: <>[연결 확인] 을 누르면 <b>실제로 한 번 다녀옵니다</b></> },
      ]}
      note="확인하지 않고 넘어가도 됩니다. 다만 잘못된 주소는 만드는 단계에서 실패합니다." />;
  }
  if (big === 1 && cur?.id === "in:db") {
    return <Agent status="입력 대기" headline="표 구조만 읽습니다"
      facts={[
        { icon: ICO.ok, text: <><b>읽기 권한</b>만 있으면 됩니다</> },
        { icon: ICO.no, text: <>데이터를 꺼내 보지 <b>않습니다</b></> },
        { icon: ICO.info, text: <>비밀번호는 <b>이름만</b> 저장합니다</> },
      ]}
      note="표 이름과 칸 구조만 확인해 조회 도구를 만듭니다." />;
  }
  if (big === 1 && cur?.id === "run") {
    return <Agent status="준비됨" headline="이제 읽기 시작합니다"
      facts={[
        { icon: ICO.ok, text: <>고르신 <b>{selected.length}가지</b>를 동시에 읽습니다</> },
        { icon: ICO.no, text: <>데이터를 <b>바꾸는 기능</b>은 자동으로 뺍니다</> },
      ]}
      note="잘못 불리면 되돌릴 수 없는 기능이라 자동으로 만들지 않습니다." />;
  }
  if (big === 3) {
    return <Agent status="진행 중" headline="도구를 만들고 있습니다"
      facts={[{ icon: ICO.info, text: <>창을 닫아도 <b>계속됩니다</b></> }]}
      note="닫아도 서버에서 계속 돕니다. 만들어진 도구는 원본 시스템 화면에 쌓입니다." />;
  }
  return <Agent status="완료" headline={`${name || "새 환경"} 준비 완료`}
    facts={[
      { icon: ICO.ok, text: <>도구는 <b>변환 스튜디오</b> 에서 볼 수 있습니다</> },
      { icon: ICO.info, text: <>더 연결하려면 <b>원본 시스템</b> 화면에서 추가합니다</> },
    ]} />;
}

function footHint(big, cur, selected) {
  if (big === 0) return "프로젝트명만 정하면 다음으로 갈 수 있습니다";
  if (big === 1 && cur?.id === "pick") return selected.length ? "나중에 다른 것도 추가할 수 있습니다" : "하나 이상 골라주세요";
  if (big === 1 && cur?.id === "run") return "창을 닫아도 계속 진행됩니다";
  if (big === 1) return "확인하지 않고 넘어가도 됩니다";
  return "";
}

/** 그 화면에서 **실제로 할 일**. 스텝 라벨은 채널 이름 + "입력" 이라, 앞 단계에서 이미
 *  로그인까지 끝낸 클라우드도 계속 "클라우드 계정 입력" 이라 부르게 된다. 버튼이 가리키는
 *  곳과 도착해서 하는 일이 어긋나면, 사용자는 앞으로 가는 버튼을 뒤로 가는 버튼으로 읽는다. */
function stepAction(step, ctx = {}) {
  if (!step) return "";
  switch (step.id) {
    // 로그인은 앞 시트에서 끝난다. 그 뒤 이 화면이 하는 일은 수집이고, 다 끝났으면 확인이다.
    // API 와 데이터베이스를 한 스텝에서 함께 확인한다 — 구독 훑기가 한 번이라
    // 결과만 갈릴 뿐이고, 스텝을 나누면 같은 화면이 연달아 나온다.
    case "in:cloud": return ctx.cloudDone ? "클라우드 리소스 확인"
      : ctx.cloudReady ? "클라우드 리소스 수집" : "클라우드 계정 연결";
    case "in:code": return "소스 코드 담기";
    case "in:document": return "문서 담기";
    // 클라우드 DB 는 앞 단계가 이미 담았다. 이 스텝은 그 목록에 없는 것을 받는 자리라
    // 이름에도 그 범위를 적는다 — "데이터베이스 접속 입력" 이면 아까 한 일과 구분되지 않는다.
    case "in:db": return "온프렘 데이터베이스 입력";
    case "in:openapi": return "API 주소 입력";
    case "run": return "함께 읽기";
    default: return step.label;
  }
}

function nextLabel(big, cur, subs, selected, busy, ctx) {
  if (busy === "run") return "시작하는 중…";
  if (big === 0) return "다음 →";
  if (cur?.id === "pick") {
    const nx = subs[1];
    return nx ? `다음 → ${stepAction(nx, ctx)}` : "다음 →";
  }
  const isLastInput = subs.indexOf(cur) === subs.length - 2;
  if (isLastInput) return "MCP 마이그레이션 시작 →";
  const next = subs[subs.indexOf(cur) + 1];
  return next ? `다음 → ${stepAction(next, ctx)}` : "다음 →";
}

/** 두 갈래 전환 — 둘을 한 화면에 같이 두면 "둘 다 채워야 하나" 로 읽힌다. */
function Segment({ value, onChange, options }) {
  return (
    <div style={{
      display: "inline-flex", background: "var(--main)", border: "1px solid var(--line2)",
      borderRadius: 10, padding: 3, marginBottom: 15, alignSelf: "flex-start",
    }}>
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} style={{
          padding: "7px 14px", borderRadius: 8, fontSize: 12.3, fontWeight: value === k ? 750 : 650,
          border: "none", cursor: "pointer", fontFamily: "var(--sans)",
          background: value === k ? "var(--card)" : "transparent",
          color: value === k ? "var(--blue)" : "var(--muted)",
          boxShadow: value === k ? "0 2px 6px rgba(0,0,0,.3)" : "none",
        }}>{label}</button>
      ))}
    </div>
  );
}

/** 담긴 행의 표시값. 좁은 폭이라 호스트를 떼고 뒤쪽만 남긴다. */
/** 이 화면이 무엇을 더 받는 자리인지 — 데이터베이스 입력 앞에 세우는 안내.
 *
 *  클라우드 구독 안의 관리형 DB 는 앞 단계(클라우드 기반 수집)에서 이미 담겼다. 그걸 모른 채
 *  이 화면을 만나면 같은 것을 또 넣거나 "아까 가져왔는데 왜 또 묻지" 로 읽는다. 그래서
 *  **이미 담은 것을 먼저 세어 보여주고**, 여기는 그 목록에 없는 것을 받는 자리라고 적는다.
 *
 *  담은 게 없으면 셈을 말하지 않는다. "0개를 가져왔습니다" 는 알려 주는 말이 아니라
 *  뭔가 잘못됐다는 신호로 읽힌다 — 클라우드를 아예 안 고른 사용자에게는 특히 그렇다. */
function DbScopeNote({ found }) {
  const has = found.length > 0;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 11, marginTop: 16, maxWidth: 940,
      padding: "13px 16px", borderRadius: 12,
      background: has ? "var(--blue-bg)" : "var(--main)",
      border: `1px solid ${has ? "color-mix(in srgb,var(--blue) 30%,transparent)" : "var(--line2)"}`,
    }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" strokeWidth="2"
        stroke={has ? "var(--blue)" : "var(--muted)"} strokeLinecap="round"
        style={{ flexShrink: 0, marginTop: 2 }}>
        <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
      </svg>
      <div style={{ fontSize: 12.3, lineHeight: 1.7, color: "var(--text)" }}>
        {has ? (
          <>
            클라우드 구독 안의 관리형 데이터베이스{" "}
            <b style={{ color: "var(--navy)" }}>{found.length}개</b>는 앞 단계에서 이미 가져왔습니다
            <span style={{ color: "var(--muted)" }}>
              {" "}— {found.slice(0, 3).map((d) => d.name).join(", ")}
              {found.length > 3 ? ` 외 ${found.length - 3}개` : ""}
            </span>.
            <span style={{ display: "block", marginTop: 3 }}>
              여기에는 <b style={{ color: "var(--navy)" }}>그 목록에 없는 온프렘 데이터베이스</b>만
              넣으면 됩니다. 없으면 비워 두고 넘어가세요.
            </span>
          </>
        ) : (
          <>
            사내망에서 직접 접속할 <b style={{ color: "var(--navy)" }}>온프렘 데이터베이스</b>를 넣습니다.
            <span style={{ display: "block", marginTop: 3, color: "var(--muted)" }}>
              클라우드 구독 안의 관리형 DB 는 <b style={{ color: "var(--text)" }}>클라우드 기반 수집</b>이
              알아서 찾아옵니다 — 여기 적지 않아도 됩니다.
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/** 클라우드에서 찾은 것 한 묶음 — API 원천과 데이터베이스가 같은 화면에 나란히 선다.
 *
 *  훑기는 한 번인데 결과만 둘로 갈린다. 예전에는 스텝도 둘로 나눠 같은 화면을 연달아
 *  보여줬는데, 넘어가도 안 넘어간 것처럼 보여 버튼을 두 번 누르게 됐다.
 *
 *  DB 인지 아닌지로 아이콘과 배지가 갈린다. 그 규칙을 두 군데 적어 두면 한쪽만 고쳐져
 *  서서히 어긋나므로 여기 한 곳에 둔다. */
function CloudBasket({ title, items, busy, onRemove }) {
  return (
    <Basket title={title} busy={busy} items={items.map((r, i) => ({
      key: r.id || i, name: r.name,
      detail: r.res === "db" ? `${r.sub} · ${r.fqdn || ""}`
        : r.res === "apim" ? `${r.sub} · APIM ${r.service || ""}`
          : `${r.sub} · ${r.spec_url}`,
      icon: r.res !== "db" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.9" strokeLinecap="round">
          <rect x="2.5" y="4" width="19" height="12" rx="2.5" /><path d="M8 20h8M12 16v4" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.9">
          <ellipse cx="12" cy="5.5" rx="7.5" ry="3" /><path d="M4.5 5.5v13c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-13" />
          <path d="M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3" /></svg>
      ),
      badge: r.res !== "db" ? (
        <span style={{
          fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
          background: "var(--blue-bg)", color: "var(--blue)", flexShrink: 0,
        }}>API {r.api_count}</span>
      ) : r.dsn_ref ? (
        <span style={{
          fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
          background: "var(--green-bg)", color: "var(--green)", flexShrink: 0,
        }}>자격 있음</span>
      ) : null,
    }))}
      onRemove={onRemove}
      hint="MCP 도구로 변환됩니다"
      emptyHint="고른 구독에서 찾은 것이 여기에 쌓입니다"
      emptyAction={busy ? "구독을 훑는 중입니다…" : "왼쪽에서 구독을 고르고 다시 수집하세요"} />
  );
}

/** 클라우드 로그인 블록 — API 탐색과 데이터베이스 탐색 **양쪽**에 같은 모양으로 선다.
 *
 *  계정은 하나인데 그 계정이 두 가지를 가져온다(API 서버 · 관리형 DB). 한쪽에만 두면
 *  DB 카드에서 클라우드를 골랐는데 로그인할 자리가 없고, 두 곳에 각각 상태를 두면
 *  같은 계정으로 두 번 로그인하게 된다.
 *
 *  그래서 **표시는 두 곳, 상태는 하나**다. 로그인 결과는 위자드 최상위(`azureAcct`)에
 *  올라가고 이 블록은 그걸 props 로 받기만 한다 — 한쪽에서 로그인하면 다른 쪽은 이미
 *  완료된 상태로 열린다. 로그아웃도 자동으로 양쪽에 맞는다.
 *
 *  `what` 은 이 카드가 무엇을 가져오는지, `from` 은 이미 로그인돼 있을 때 어디서 한
 *  로그인인지다. 두 번째가 없으면 사용자가 "아까 그거 아닌가" 로 읽고 중복을 의심한다.
 */
function CloudSso({ acct, subs, onConnected, what, from }) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      {/* 여기서는 로그인까지만 한다. 수집 진행을 이 좁은 시트에 넣으면 고르는 화면이
          진행 화면을 겸하게 되고, 손봐야 할 경고가 작은 로그 창 안에 묻힌다. */}
      <CloudConnect acct={acct} subs={subs} onConnected={onConnected} />
      {!!acct && (
        <div style={{
          marginTop: 10, padding: "11px 13px", borderRadius: 11,
          background: "var(--blue-bg)", fontSize: 11.5, lineHeight: 1.65, color: "var(--text)",
          border: "1px solid color-mix(in srgb,var(--blue) 30%,transparent)",
        }}>
          여기서는 <b style={{ color: "var(--navy)" }}>로그인만</b> 합니다. 다음 화면에서 어느 구독을
          훑을지 고르면 <b style={{ color: "var(--navy)" }}>{what}</b>를 찾아옵니다.
          {from && (
            <span style={{ display: "block", marginTop: 5, color: "var(--muted)" }}>
              {from}에서 연결했다면 이 계정이 그대로 쓰입니다 — 다시 로그인하지 않습니다.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function codeLabel(c) {
  const raw = c.mode === "git" ? c.repoUrl : c.path;
  const last = (raw || "").replace(/\/+$/, "").split("/").pop() || "저장소";
  return last.endsWith(".git") ? last.slice(0, -4) : last;
}
function codeDetail(c) {
  if (c.mode === "folder") return c.path + (c.subpath ? ` · ${c.subpath}` : "");
  const short = (c.repoUrl || "").replace(/^https?:\/\/[^/]+\//, "");
  return short + (c.branch ? ` · ${c.branch}` : "") + (c.subpath ? ` · ${c.subpath}` : "");
}
function codeIcon(c) {
  return c.mode === "git"
    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.9"><path d="M4 8h13l-3-3M20 16H7l3 3" /></svg>
    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.9"><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>;
}

const badgeBase = {
  fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, padding: "2px 7px",
  borderRadius: 999, flexShrink: 0,
};
const bdGit = { ...badgeBase, background: "var(--blue-bg)", color: "var(--blue)",
  border: "1px solid color-mix(in srgb,var(--blue) 32%,transparent)" };
const bdFolder = { ...badgeBase, background: "var(--purple-bg)", color: "var(--purple)",
  border: "1px solid color-mix(in srgb,var(--purple) 32%,transparent)" };
const inpStyle = {
  background: "var(--main)", border: "1px solid var(--line2)", borderRadius: 10,
  padding: "10px 13px", fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--navy)", outline: "none",
};

/** 도구 만들기 진행 — 잡 로그를 그대로 흘린다.
 *
 *  이전에는 "읽은 내용을 도구로 바꾸는 중입니다" 한 줄이라 화면의 대부분이 비었고, 무엇을 하는
 *  중인지도 알 수 없었다. 잡은 이미 `log`(단계 메시지)와 `resources`(소스별 진척)를 들고 있으므로
 *  백엔드를 고치지 않고 그대로 보여준다. */
// 변환 채널 — 소스 종류마다 읽는 방식이 다르다. 한 통에 섞어 흘리면 코드에서 온 줄과
// 클라우드에서 온 줄이 구분되지 않아, 화면은 바쁘지만 무엇이 되고 있는지는 안 읽힌다.
const CHANNELS = [
  { key: "code", label: "소스 코드", short: "소스 코드", types: ["code"], tone: "var(--blue)",
    how: "저장소를 내려받아 API 와 숨은 조회 기능을 찾습니다" },
  { key: "server", label: "서버 · 데이터베이스", short: "서버·DB", types: ["openapi", "db"], tone: "var(--purple)",
    how: "서버에 설명서가 열려 있는지 확인하고 표 구조를 읽습니다" },
  { key: "document", label: "문서", short: "문서", types: ["document"], tone: "var(--amber)",
    how: "문서를 잘라 찾아 읽을 수 있는 조각으로 만듭니다" },
];

/** 소스 코드를 읽는 순서. 위에서부터 시도하고, 되는 데서 멈춘다.
 *
 *  이 순서를 글로 적어 두면 아무도 안 읽는다. 진행 중에 어느 칸이 켜지는지를 보여주면
 *  "설명서가 없어서 코드를 직접 읽었구나" 가 설명 없이 전달된다. 그래서 로그 위에 얹는다.
 *  단계 값은 `resources[].stage` 로 백엔드가 알려준다(로그 문구 매칭은 문구가 바뀌면 깨진다). */
const CODE_STAGES = [
  ["spec-file", "설명서 파일 확인"],
  ["runtime-openapi", "앱에서 명세 읽기"],
  ["route-discovery", "코드 직접 분석"],
  ["db-func", "숨은 조회 기능 찾기"],
  // 여기까지가 "코드에 있어야 할 것". 아래 둘은 "실제로 떠 있는가" 다.
  // 서버 주소를 넣지 않았으면 두 칸이 켜지지 않은 채 지나간다 — 그게 곧
  // "대조를 못 했다" 는 설명이라, 따로 안내 문구를 두지 않는다.
  ["server-spec", "서버 명세 확인"],
  ["reconcile", "실서버와 대조"],
];

function RunScreen({ jobId, name, docsRunning, onBackground, onDone }) {
  const [job, setJob] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!jobId) return;
    let alive = true, timer;
    const tick = () => api.jobStatus(jobId)
      .then((j) => {
        if (!alive) return;
        setJob(j);
        // 끝난 잡을 계속 찌르지 않는다 — 완료 후에도 폴링이 남으면 조용히 자원을 먹는다.
        if (j.status === "running") timer = setTimeout(tick, 1000);
        else onDone?.();
      })
      .catch((e) => { if (alive) setErr(e.message || "진행 상황을 읽지 못했습니다"); });
    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [jobId]);

  const resources = job?.resources || [];
  const tools = job?.tools || [];
  const doneN = resources.filter((r) => ["done", "warn", "fail"].includes(r.state)).length;
  const running = job?.status === "running";

  // 큰 숫자는 굴려서 도달시킨다.
  //
  // 백엔드는 리소스 하나를 다 변환한 뒤에야 도구 목록을 통째로 기록한다(runner.run_apply).
  // DB 한 건이 93개, 스펙 한 건이 36개라 값이 0 에서 93 으로 한 프레임에 튄다. 계산은
  // 맞지만 사람 눈에는 세어 올린 숫자가 아니라 미리 채워 둔 숫자로 보인다.
  // 값은 그대로 두고 도달하는 과정만 보이게 한다. reduced-motion 이면 즉시 확정된다.
  //
  // 도는 동안에는 만들어진 수를 센다 — 그때는 게시가 아직 없어서 그것 말고 셀 것이 없다.
  // 게시가 끝나면 그 수로 갈아탄다. 게시에서 걸러진 것까지 최종값으로 남기면 다음 화면과
  // 대시보드에서 숫자가 줄어들고, 그게 "17 개는 어디 갔나" 가 된다.
  const publishedN = job?.publish?.published;
  const finalCount = publishedN != null ? publishedN : tools.length;
  const shownCount = Math.round(useCountUp(finalCount, 900));
  // 소스는 다 읽었는데 잡이 아직 도는 구간 = 게시 검증. 진행 표시가 이 구간을 말해야
  // "다 됐는데 안 넘어간다" 로 읽히지 않는다.
  const publishing = running && resources.length > 0 && doneN === resources.length;

  // 도구가 어느 채널에서 나왔는지 — tools[].source 는 리소스 이름이므로 그 리소스의
  // 타입을 보고 되짚는다.
  const typeOf = Object.fromEntries(resources.map((r) => [r.name, r.type]));
  const toolsOfChannel = (types) => tools.filter((t) => types.includes(typeOf[t.source] || t.kind)).length;

  // 채널별로 리소스·로그를 갈라 담는다. 로그 줄머리의 `[리소스명]` 이 유일한 단서라 이름으로 맞춘다.
  const byChannel = CHANNELS.map((ch) => {
    const own = resources.filter((r) => ch.types.includes(r.type));
    const names = new Set(own.map((r) => r.name));
    return {
      ...ch, resources: own,
      logs: (job?.log || []).filter((l) => {
        const m = /^\[([^\]]+)\]/.exec(l.msg || "");
        return m && names.has(m[1]);
      }),
      done: own.filter((r) => ["done", "warn", "fail"].includes(r.state)).length,
      count: own.reduce((n, r) => n + (r.count || 0), 0),
    };
  }).filter((ch) => ch.resources.length);

  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", gap: 20, marginBottom: 16, flexShrink: 0,
        padding: "16px 22px", borderRadius: 18, position: "relative", overflow: "hidden",
        background: "linear-gradient(100deg,color-mix(in srgb,var(--blue) 9%,var(--card)) 0%,var(--card) 52%,var(--main) 100%)",
        border: "1px solid color-mix(in srgb,var(--blue) 24%,var(--line2))",
      }}>
        {/* 진행 중에만 흐르는 빛 — 화면이 살아 있다는 신호가 숫자 하나뿐이면 멈춘 것처럼 보인다. */}
        {running && (
          <span aria-hidden style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "linear-gradient(100deg,transparent 30%,color-mix(in srgb,var(--blue) 13%,transparent) 50%,transparent 70%)",
            backgroundSize: "220% 100%", animation: "runSweep 2.8s linear infinite",
          }} />
        )}
        <Pulse />
        <div style={{ minWidth: 0, position: "relative" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--navy)", letterSpacing: "-.03em" }}>
            {running ? "도구를 만들고 있습니다" : "도구가 만들어졌습니다"}
          </div>
          <div style={{ fontSize: 12.8, color: "var(--muted)", marginTop: 5 }}>
            {running ? "창을 닫아도 서버에서 계속됩니다 · 결과는 원본 시스템 화면에 쌓입니다"
              // 변환은 끝났지만 문서 적재가 남아 있다면 "모두" 라고 적지 않는다.
              : docsRunning ? `${name} · ${resources.length}개 소스를 읽었습니다 · 문서 적재는 계속됩니다`
                : `${name} · ${resources.length}개 소스를 모두 읽었습니다`}
          </div>
        </div>
        <span style={{ flex: 1 }} />

        {/* 카운터 — 이 화면에서 가장 크게 움직이는 숫자. 도구가 늘 때마다 눈이 여기로 온다. */}
        <div style={{ position: "relative", display: "flex", alignItems: "flex-end", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <div className="mono" style={{ fontSize: 9.5, letterSpacing: ".14em", color: "var(--muted)",
                                           textTransform: "uppercase", marginBottom: 4 }}>
              {/* 게시 전에는 "수집한" 이 맞고, 게시가 끝나면 그 수는 쓸 수 있는 도구 수다.
                  라벨이 안 바뀌면 같은 말 아래에서 숫자만 줄어 오해를 만든다. */}
              {publishedN != null ? "MCP 도구" : "수집한 MCP 도구"}
            </div>
            <span key={finalCount} style={{
              fontFamily: "var(--disp)", fontSize: 62, fontWeight: 700, color: "var(--blue)",
              display: "inline-block", lineHeight: .92,
              animation: "toolPop .42s cubic-bezier(.2,1.4,.4,1) both",
              textShadow: "0 0 34px color-mix(in srgb,var(--blue) 50%,transparent)",
            }}>{shownCount}</span>

            {/* 전체만 크게 띄우고, 어디서 몇 개가 나왔는지는 그 아래 작게. 채널이 여럿일
                때만 보여준다 — 하나뿐이면 전체 수와 같은 값을 두 번 적는 셈이다. */}
            {byChannel.length > 1 && (
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
                {byChannel.map((ch) => (
                  <span key={ch.key} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: ch.tone }} />
                    <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{ch.short}</span>
                    <b className="mono" style={{ fontSize: 11.5, color: "var(--navy)" }}>
                      {toolsOfChannel(ch.types)}
                    </b>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ width: 150, paddingBottom: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5,
                          color: "var(--muted)", marginBottom: 6 }}>
              {/* 소스를 다 읽었는데도 잡이 도는 구간이 있다 — 게시 검증이다. 그때
                  "N/N 소스 100%" 만 떠 있으면 다 끝났는데 안 넘어가는 것으로 보인다. */}
              <span>{publishing ? "게시하는 중" : `${doneN} / ${resources.length || 0} 소스`}</span>
              <b style={{ color: "var(--navy)" }}>{job?.pct ?? 0}%</b>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "var(--main)", overflow: "hidden" }}>
              <span style={{
                display: "block", height: "100%", borderRadius: 99, width: `${job?.pct ?? 0}%`,
                background: "linear-gradient(90deg,var(--blue-d),#2dd4bf)",
                transition: "width .5s cubic-bezier(.3,1,.4,1)",
                boxShadow: "0 0 12px color-mix(in srgb,var(--blue) 60%,transparent)",
              }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "grid",
                    gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 16 }}>
        {/* 좌: 채널별 로그. 각 채널이 자기 방식으로 읽는 모습을 나란히 보여준다. */}
        <div className="onb-scroll" style={{ minHeight: 0, overflowY: "auto", display: "flex",
                                             flexDirection: "column", gap: 12, paddingRight: 4 }}>
          {err && (
            <div style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--red)",
                          background: "var(--red-bg)", fontSize: 12, color: "var(--red)" }}>{err}</div>
          )}
          {!byChannel.length && !err && (
            <div style={{ padding: 24, borderRadius: 14, border: "1px solid var(--line2)",
                          background: "var(--card)", fontSize: 12.5, color: "var(--faint)", textAlign: "center" }}>
              소스를 준비하는 중입니다…
            </div>
          )}
          {byChannel.map((ch) => (
            <ChannelLog key={ch.key} ch={ch} pending={docsRunning && ch.key === "document"} />
          ))}
        </div>

        {/* 우: 만들어진 도구가 쌓이는 자리. "몇 개" 가 아니라 "어디서 무엇이" 생겼는지 보여준다.
            한 통에 시간순으로 쌓으면 아래로 갈수록 출처를 알 수 없어 "그냥 다 가져왔다" 가 된다. */}
        <ToolPanel tools={tools} resources={resources} channels={CHANNELS}
          publish={job?.publish} running={running}
          pending={docsRunning ? new Set(["document"]) : null} />
      </div>

      {/* 오래 걸리는 변환을 끝까지 지켜볼 이유는 없다 — 두고 나갈 출구를 화면 안에 둔다. */}
      {running && onBackground && (
        <div style={{ flexShrink: 0, marginTop: 14, display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 16px", borderRadius: 13, background: "var(--card)",
                      border: "1px solid var(--line2)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.9" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
          </svg>
          <span style={{ fontSize: 12.3, color: "var(--muted)", flex: 1 }}>
            변환은 서버에서 계속됩니다. 먼저 들어가서 다른 일을 해도 됩니다.
          </span>
          <Btn kind="ghost" onClick={onBackground} style={{ padding: "9px 16px", fontSize: 12.5 }}>
            백그라운드로 두고 들어가기 →
          </Btn>
        </div>
      )}
    </>
  );
}

/** 수집 진행 — 구독을 훑는 몇 초 동안 무엇을 보고 있는지 한 줄씩 흘린다.
 *
 *  버튼 라벨만 바꾸면 화면이 멈춘 것처럼 보이고, 결과가 0개일 때는 어디서 0개가 나왔는지
 *  알 수 없어 "안 되는 건가" 로 끝난다. 찾지 못한 이유까지 그 자리에 적는다. */
function ScanProgress({ busy, log, prog }) {
  const boxRef = useRef(null);
  // scrollIntoView 를 쓰면 안 된다 — 그것은 조상 스크롤 컨테이너를 **전부** 움직여서,
  // 로그 한 줄이 늘 때마다 바깥 열과 페이지까지 같이 끌려간다. 스크롤은 이 상자 안에서만
  // 일어나야 하므로 자기 scrollTop 만 직접 민다.
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);
  if (!busy && !log.length) return null;
  const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
  const TONE = { ok: "#4ade80", warn: "#fbbf24", error: "#f87171", info: "#8a93b0" };

  return (
    <div style={{
      marginTop: 13, borderRadius: 12, overflow: "hidden", position: "relative",
      border: "1px solid #25304d", background: "var(--code)",
      // 머리말·진행바는 고정, 로그만 남는 높이를 먹고 그 안에서 스크롤된다.
      display: "flex", flexDirection: "column", minHeight: 0, flex: 1,
      animation: "fadeUp .26s ease-out both",
    }}>
      {/* 훑는 동안 위아래로 지나가는 스캔선 — "지금 읽고 있다" 를 글자 없이 전한다. */}
      {busy && (
        <span aria-hidden style={{
          position: "absolute", left: 0, right: 0, height: 44, pointerEvents: "none", zIndex: 1,
          background: "linear-gradient(180deg,transparent,color-mix(in srgb,var(--blue) 16%,transparent),transparent)",
          animation: "scanSweep 1.9s ease-in-out infinite",
        }} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 13px",
                    borderBottom: "1px solid #25304d", position: "relative", zIndex: 2 }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%", background: busy ? "var(--blue)" : "#4ade80",
          boxShadow: busy ? "0 0 9px var(--blue)" : "none",
          animation: busy ? "dashRing 1.6s ease-out infinite" : "none",
        }} />
        <span className="mono" style={{ fontSize: 9.5, letterSpacing: ".12em", color: "#8a93b0",
                                        textTransform: "uppercase" }}>
          {busy ? "수집 중" : "수집 기록"}
        </span>
        {!!prog.total && (
          <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: "var(--blue)" }}>
            구독 {prog.done}/{prog.total}
          </span>
        )}
      </div>

      {!!prog.total && (
        <div style={{ height: 3, background: "#1a2238", position: "relative", zIndex: 2 }}>
          <span style={{
            display: "block", height: "100%", width: `${pct}%`,
            background: "linear-gradient(90deg,var(--blue-d),#2dd4bf)",
            transition: "width .45s cubic-bezier(.3,1,.4,1)",
            boxShadow: "0 0 10px color-mix(in srgb,var(--blue) 65%,transparent)",
          }} />
        </div>
      )}

      <div ref={boxRef} className="onb-scroll mono" style={{
        // 남는 높이를 채우되 최소·최대를 둔다. 고정 높이면 화면이 크든 작든 같은 크기라
        // 큰 화면에서는 빈 공간이, 작은 화면에서는 바깥 스크롤이 생긴다.
        flex: 1, minHeight: 96, maxHeight: 320,
        overflowY: "auto", padding: "10px 13px", position: "relative", zIndex: 2,
        fontSize: 10.8, lineHeight: 1.9, color: "var(--code-text)",
      }}>
        {log.map((l) => (
          <div key={l.key} style={{ display: "flex", gap: 8, animation: "stepIn .22s ease-out both" }}>
            <span style={{ width: 11, flexShrink: 0, color: TONE[l.level] || TONE.info }}>
              {l.level === "ok" ? "✓" : l.level === "warn" ? "!" : l.level === "error" ? "✕" : "·"}
            </span>
            <span style={{ flex: 1 }}>{l.msg}</span>
          </div>
        ))}
        {busy && (
          <div style={{ display: "flex", gap: 8, color: "#5a6488" }}>
            <span style={{ width: 11 }}>·</span><Dots />
          </div>
        )}
        {/* 스크롤 앵커는 두지 않는다 — 위 boxRef 가 자기 scrollTop 만 밀어 끝으로 붙인다.
            scrollIntoView 를 쓰던 시절의 앵커가 선언 없이 남아 있어서, 수집을 시작해
            이 컴포넌트가 처음 렌더되는 순간 그 이름을 못 찾고 앱 전체가 죽었다. */}
      </div>
    </div>
  );
}

/** 점 세 개가 차례로 밝아진다 — 마지막 줄 뒤에 아직 진행 중임을 남긴다. */
function Dots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", height: 18 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 4, height: 4, borderRadius: "50%", background: "var(--blue)",
          animation: "dotPulse 1.1s ease-in-out infinite", animationDelay: `${i * 0.16}s`,
        }} />
      ))}
    </span>
  );
}

/** 클라우드 연결의 한 걸음. 끝났는지·지금 할 차례인지·아직 못 하는지를 형태로 구분한다. */
/** 스펙을 못 찾은 서버 — 목록 밖에 따로 세운다.
 *
 *  예전에는 로그에 경고 한 줄로 흘려보내고 끝이었다. 그런데 그 한 줄이 하는 말은
 *  "포트를 아시면 입력해주세요" 였고, 정작 입력할 곳이 화면 어디에도 없었다. 관례 포트만
 *  두드려 본 결과라 "없다" 가 아니라 "여기까지 봤다" 이므로, 아는 사람이 한 칸 채우면 살아난다. */
function MissedVms({ items, busy, onProbe, onDrop, foundCount = 0 }) {
  // 이름으로 알아본 시연용 기본 포트를 미리 채워 둔다. 매 시연마다 같은 값을 손으로 적으면
  // 흐름이 끊긴다. 값이 틀리면 그 자리에서 고쳐 쓰면 된다.
  const [ports, setPorts] = useState(() =>
    Object.fromEntries(items.map((v) => [v.id, v.suggest || ""])));
  useEffect(() => {
    setPorts((p) => {
      const next = { ...p };
      for (const v of items) if (next[v.id] === undefined) next[v.id] = v.suggest || "";
      return next;
    });
  }, [items]);

  return (
    <div style={{
      flexShrink: 0, marginTop: 12, padding: "12px 13px", borderRadius: 12,
      // 목록이 길어져도 이 박스가 위쪽 결과 영역을 밀어내지 않게 높이를 묶는다.
      // 예전에는 내용만큼 자라서 "찾은 리소스" 박스를 덮어 버렸다.
      display: "flex", flexDirection: "column", maxHeight: 300, minHeight: 0,
      background: "var(--amber-bg)", border: "1px solid color-mix(in srgb,var(--amber) 34%,transparent)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 750,
                    color: "var(--amber)", marginBottom: 5, flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" style={{ flexShrink: 0 }}>
          <path d="M12 9v5M12 17h.01" />
          <path d="M10.3 3.9 2.4 17a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
        API 설명서를 찾지 못한 서버 {items.length}대
        <span className="mono" style={{ marginLeft: "auto", fontSize: 10, fontWeight: 400,
                                        color: "color-mix(in srgb,var(--amber) 70%,var(--muted))" }}>
          담김 {foundCount} · 미확인 {items.length}
        </span>
      </div>
      <div style={{ fontSize: 11.3, color: "color-mix(in srgb,var(--amber) 72%,var(--text))",
                    lineHeight: 1.65, marginBottom: 10, flexShrink: 0 }}>
        이 구독에서 찾은 서버에 <b>기본 대역을 확인했지만 API 설명서를 찾지 못했습니다.</b>
        서버 안에 수집할 API 가 있다면 그 API 서버의 포트를 입력해 주세요. 비워 두고 넘어가도 됩니다.
      </div>
      <div className="onb-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 2 }}>
      {items.map((v) => (
        <div key={v.id} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9,
          background: "rgba(0,0,0,.22)", marginBottom: 6,
        }}>
          <span style={{ minWidth: 0, fontSize: 11.8, fontWeight: 650, color: "var(--navy)",
                         overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</span>
          {/* 숫자만 남기지 않는다. 설명서 경로가 표준이 아닌 레거시는 "18001/ctlg/v2/api-docs"
              처럼 경로까지 적어야 찾을 수 있는데, 숫자 필터가 그걸 조용히 지워 버린다. */}
          <input value={ports[v.id] || ""} placeholder="포트 또는 포트/경로"
            onChange={(e) => setPorts((p) => ({ ...p, [v.id]: e.target.value.replace(/[^\d/\-._~a-zA-Z]/g, "") }))}
            onKeyDown={(e) => { if (e.key === "Enter" && ports[v.id]) onProbe(v, ports[v.id]); }}
            style={{ ...inpStyle, marginLeft: "auto", width: 152, flexShrink: 0, padding: "6px 9px", fontSize: 11.5 }} />
          <Btn kind="ghost" style={{ padding: "7px 12px", fontSize: 11.5, flexShrink: 0 }}
            disabled={!ports[v.id] || busy === `probe:${v.id}`}
            onClick={() => onProbe(v, ports[v.id])}>
            {busy === `probe:${v.id}` ? "확인 중…" : "확인"}
          </Btn>
          <button onClick={() => onDrop(v.id)} aria-label="빼기" style={{
            width: 22, height: 22, flexShrink: 0, borderRadius: 7, border: "1px solid var(--line2)",
            background: "transparent", color: "var(--faint)", fontSize: 11, cursor: "pointer",
            display: "grid", placeItems: "center",
          }}>✕</button>
        </div>
      ))}
      </div>
    </div>
  );
}

/** 클라우드 수집의 한 단계.
 *
 *  compact 는 "이미 정한 것" 을 접는 모드다. 수집이 시작되면 관심은 로그로 옮겨가는데,
 *  고르기·포트 상자가 원래 크기를 그대로 차지하면 로그가 화면 밖으로 밀려나 스크롤을
 *  내려야 보인다. 지운 게 아니라 접은 것이라, summary 로 고른 값은 계속 읽힌다.
 */
/** 플랫폼으로 넘어가는 사이를 덮는 진행 표시.
 *
 *  위저드를 지우지 않고 **흐린다** — 결과 화면이 뒤에 남아 있어야 "로딩이 다시 시작됐나" 로
 *  읽히지 않는다. 같은 맥락 안에서 잠깐 물러난다는 신호다.
 *
 *  도구 개수는 넣지 않는다. 그 숫자는 이미 흐린 배경에 떠 있어서 두 번 적는 셈이고,
 *  진행 표시가 두 가지 일을 하면 "지금 도는 중" 이라는 한 가지가 흐려진다.
 */
function EnteringVeil() {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 40, display: "grid", placeItems: "center",
      borderRadius: 18, background: "color-mix(in srgb,var(--app) 45%,transparent)",
      backdropFilter: "blur(5px) brightness(.55)",
      WebkitBackdropFilter: "blur(5px) brightness(.55)",
      animation: "fadeIn .2s ease-out both",
    }}>
      {/* 흐린 배경 위에 맨 요소를 띄우면 대비가 배경에 좌우된다. 판에 담아야 어디서든 읽힌다. */}
      <div style={{
        minWidth: 244, textAlign: "center", padding: "16px 22px 15px", borderRadius: 13,
        background: "var(--card)",
        border: "1px solid color-mix(in srgb,var(--blue) 26%,var(--line2))",
        boxShadow: "0 16px 40px rgba(0,0,0,.45)",
        animation: "veilCardIn .24s cubic-bezier(.2,1,.4,1) both",
      }}>
        <b style={{ fontSize: 12.8, color: "var(--navy)" }}>플랫폼을 여는 중입니다</b>
        {/* 회전은 제자리를 돌고, 막대는 방향이 있다 — "이동 중" 을 더 곧바로 전한다. */}
        <div className="onb-track"><i /></div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 9 }}>
          만든 도구를 목록에 반영하고 있습니다
        </div>
      </div>
    </div>
  );
}

function CloudStep({ n, title, desc, done, active, locked, compact, summary, grow, action, children }) {
  const tone = done ? "var(--green)" : active ? "var(--blue)" : "var(--faint)";
  const dot = compact ? 19 : 23;
  return (
    <div style={{
      padding: compact ? "9px 13px" : "15px 17px", borderRadius: compact ? 11 : 14,
      opacity: locked ? 0.55 : 1,
      // grow 인 단계만 남는 높이를 먹는다. 나머지는 줄어들지 않아야 접힌 요약이 안 잘린다.
      ...(grow ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }
               : { flexShrink: 0 }),
      // 세 단계가 나란히 놓이는 목록이다. 완료된 단계만 배경·테두리가 달라지면 같은 줄에
      // 있던 것이 갑자기 다른 물건으로 보인다. 상태는 번호원 색으로만 말한다.
      background: "var(--main)",
      border: "1px solid var(--line2)",
      transition: "padding .22s ease,opacity .2s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: compact ? 9 : 11,
                    marginBottom: !compact && desc ? 5 : 0 }}>
        {/* 완료돼도 번호는 번호로 남는다. 한 단계만 ✓ 로 바뀌면 나머지와 짝이 맞지 않아
            "이건 다른 종류인가" 로 읽힌다 — 순서를 세는 자리에 상태를 끼워 넣지 않는다. */}
        <span className="mono" style={{
          width: dot, height: dot, flexShrink: 0, borderRadius: "50%", display: "grid", placeItems: "center",
          fontSize: compact ? 9.5 : 10.5, fontWeight: 700, color: tone,
          background: done ? "color-mix(in srgb,var(--green) 14%,transparent)" : "transparent",
          border: `1.5px solid ${tone}`,
        }}>
          {n}
        </span>
        <span style={{ fontSize: compact ? 12 : 13.2, fontWeight: 750, color: "var(--navy)",
                       flexShrink: 0 }}>{title}</span>
        {/* 접힌 상태에서 고른 값은 제목 옆 한 줄로 남는다 — 접었다고 안 보이면 안 된다. */}
        {compact && summary && (
          <span className="mono" style={{
            marginLeft: "auto", minWidth: 0, fontSize: 10.3, color: "var(--muted)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{summary}</span>
        )}
        {locked && !compact && (
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--faint)" }}>이전 단계 먼저</span>
        )}
        {/* 헤더 우측 액션. 제목과 같은 말을 하는 버튼을 본문에 두면 두 번 적힌 것처럼 읽힌다. */}
        {action && !compact && !locked && (
          <span style={{ marginLeft: "auto", flexShrink: 0 }}>{action}</span>
        )}
      </div>
      {!compact && desc && (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginLeft: 34, marginBottom: 11, lineHeight: 1.55 }}>
          {desc}
        </div>
      )}
      {!locked && !compact && (
        <div style={{ marginLeft: 34,
                      ...(grow ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : {}) }}>
          {children}
        </div>
      )}
    </div>
  );
}

/** 마지막 화면 — 무엇이 몇 개 생겼는지. 여기서 숫자를 다시 안 보여주면 방금 본 연출이
 *  기억에만 남고, 사용자는 "그래서 뭐가 생겼지" 를 확인하러 Explorer 를 뒤져야 한다. */
function DoneScreen({ jobId, name, docsRunning }) {
  const [job, setJob] = useState(null);
  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    api.jobStatus(jobId).then((j) => { if (alive) setJob(j); }).catch(() => {});
    return () => { alive = false; };
  }, [jobId]);

  const tools = job?.tools || [];
  const resources = job?.resources || [];
  const api_n = tools.filter((t) => t.backend !== "db").length;
  const db_n = tools.length - api_n;
  const failed = resources.filter((r) => r.state === "fail");

  // 어디서 몇 개가 나왔는지 — 도구의 성격(API/조회)과는 다른 축이다. 둘 다 보여줘야
  // "소스 코드에서 이만큼 건졌다" 가 읽힌다.
  const typeOf = Object.fromEntries(resources.map((r) => [r.name, r.type]));
  const bySource = CHANNELS
    .map((ch) => ({ ...ch, n: tools.filter((t) => ch.types.includes(typeOf[t.source] || t.kind)).length }))
    .filter((ch) => ch.n);
  const held = job?.publish?.held || [];
  const notes = job?.publish?.notes || [];
  // 만들어진 수와 게시된 수는 다르다 — 검증에서 막힌 묶음은 게시되지 않는다.
  // 대시보드가 세는 것은 뒤엣것이라, 두 숫자를 화면에서 이어 주지 않으면 어긋나 보인다.
  const publishedN = job?.publish?.published;
  const heldN = held.reduce((n, h) => n + (h.tools || 0), 0);
  // 화면에 크게 쓸 수 — 대시보드가 세는 것과 같아야 한다. 게시를 건너뛴 실행에는
  // publish 가 없으므로 그때만 만들어진 수로 떨어진다.
  const shownN = publishedN != null ? publishedN : tools.length;

  // 소스에 없는데 서버가 답한 경로 — 도구가 되지 않았으므로 tools 에 없고 잡이 따로 들고 온다.
  // 완료 화면에서 개수를 세지는 않고, 아래 알림 칩으로 "이런 게 더 있다" 만 전한다.
  const orphans = job?.orphans || [];

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ position: "relative", width: 74, height: 74, display: "grid", placeItems: "center" }}>
        <span aria-hidden style={{
          position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid var(--blue)",
          animation: "dashRing 2.4s ease-out infinite",
        }} />
        <span style={{
          width: 60, height: 60, borderRadius: "50%", display: "grid", placeItems: "center",
          background: "var(--blue-bg)", border: "1.5px solid color-mix(in srgb,var(--blue) 45%,transparent)",
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--blue)"
            strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
      </div>

      <div style={{ fontSize: 25, fontWeight: 800, color: "var(--navy)",
                    letterSpacing: "-.03em", marginTop: 22 }}>
        마이그레이션이 끝났습니다
      </div>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8, maxWidth: 460, lineHeight: 1.65 }}>
        <b style={{ color: "var(--text)" }}>{name}</b> 아래에 도구가 등록되었습니다.
        지금부터 AI 가 이 도구들로 기존 시스템을 부를 수 있습니다.
      </div>

      {/* 완료 화면은 **만들어진 개수 하나**만 말한다.
       *
       *  한동안 확인 상태를 세 타일로 나눠 세웠다. 그런데 숫자를 나란히 세우면 사람은 비교부터
       *  한다 — 양방향 0 이 다른 숫자 옆에 같은 크기로 서 있으니 "왜 0이냐" 가 성과보다 먼저
       *  읽혔고, 시연에서 매번 그 질문에 시간을 썼다. 대조 결과는 사라지지 않는다.
       *  전환 상태 화면의 "실재 확인" 칸이 그대로 들고 있다 — 완료 화면에서만 뺀다.
       *
       *  분기도 없앴다. 상태에 따라 화면 모양이 달라지면 시연자가 무엇이 나올지 모른다. */}
      <div style={{ fontFamily: "var(--disp)", fontSize: 68, fontWeight: 700, color: "var(--blue)",
                    lineHeight: 1, marginTop: 26,
                    textShadow: "0 0 44px color-mix(in srgb,var(--blue) 40%,transparent)" }}>
        {shownN}
      </div>
      {/* 이름도 숫자도 대시보드와 같아야 한다. 만들어진 수를 크게 쓰면 플랫폼에 들어간
          순간 숫자가 줄어 "17개는 어디 갔나" 가 된다 — **못 쓰는 것까지 센 숫자**였기
          때문이다. 성과로 내세울 값은 지금 부를 수 있는 것이고, 그게 게시된 수다.
          게시를 건너뛴 실행(publish=false)에서는 게시 개념이 없으므로 만들어진 수를 쓴다. */}
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8, letterSpacing: ".04em" }}>
        MCP 도구
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 14, letterSpacing: ".02em" }}>
        읽은 소스 {resources.length}
        {/* API/조회 내역은 만들어진 것 기준이라 위 숫자와 합이 안 맞는다. 맞지 않는 내역은
            안 적는 편이 낫다 — 대기 건은 아래 알림 칩이 이미 말한다. */}
      </div>

      {/* "끝났습니다" 아래에 아직 도는 일이 있으면 그것도 여기서 말해야 한다. 안 적으면
          사용자는 문서가 누락됐다고 읽고, 되돌아와 같은 문서를 다시 담는다. */}
      {docsRunning && (
        <div style={{
          display: "flex", alignItems: "center", gap: 9, marginTop: 20, maxWidth: 560,
          padding: "11px 15px", borderRadius: 12, textAlign: "left",
          background: "color-mix(in srgb,var(--green) 9%,var(--card))",
          border: "1px solid color-mix(in srgb,var(--green) 36%,var(--line2))",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                         background: "var(--green)",
                         animation: "dotPulse 1.1s ease-in-out infinite" }} />
          <span style={{ fontSize: 12.3, color: "var(--green)", fontWeight: 650, lineHeight: 1.55 }}>
            문서는 접수만 했습니다
            <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)",
                           fontWeight: 500, marginTop: 2 }}>
              적재(RAG)는 이음 시연 범위 밖입니다.
            </span>
          </span>
        </div>
      )}

      {bySource.length > 1 && (
        <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {bySource.map((ch) => (
            <span key={ch.key} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: ch.tone }} />
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{ch.short} 에서</span>
              <b className="mono" style={{ fontSize: 12.5, color: "var(--navy)" }}>{ch.n}</b>
            </span>
          ))}
        </div>
      )}

      {(!!failed.length || !!notes.length || !!held.length || !!orphans.length) && (
        <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {!!failed.length && (
            <NoteChip label={`읽지 못한 소스 ${failed.length}`}
              detail={failed.map((r) => r.name).join(", ")} />
          )}
          {held.map((h, i) => (
            <NoteChip key={`h${i}`} label={`대기 중인 도구 ${h.tools}`} detail={h.reason} />
          ))}
          {notes.map((n, i) => (
            <NoteChip key={`n${i}`} label="호출 주소 없음" detail={n} />
          ))}
          {/* 경고가 아니라 발견이다 — 소스 스캔만으로는 영원히 안 보이던 경로다.
              스키마가 없어 자동 등록하지 않으므로, 여기서는 "이런 게 더 있다" 까지만 알린다. */}
          {!!orphans.length && (
            <NoteChip label={`소스에 없던 API ${orphans.length}`}
              detail={orphans.slice(0, 12).map((o) => `${o.method} ${o.path}`).join(", ")
                + (orphans.length > 12 ? ` 외 ${orphans.length - 12}건` : "")} />
          )}
        </div>
      )}

      <div style={{ marginTop: 24, fontSize: 11.8, color: "var(--faint)" }}>
        도구 목록은 <b style={{ color: "var(--muted)" }}>변환 스튜디오</b> 에서 확인할 수 있습니다
      </div>
    </div>
  );
}

/** 덧붙임 — 다 됐다는 화면에서 못 된 것을 붉은 박스로 키우면 실패한 작업처럼 보인다.
 *  수는 항상 보여주되 사연은 눌러야 펴진다. 알아야 할 사람만 열어보면 된다. */
function NoteChip({ label, detail }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 999,
        background: open ? "var(--card)" : "transparent", cursor: "pointer",
        border: `1px solid ${open ? "var(--line2)" : "var(--line)"}`,
        color: "var(--muted)", fontSize: 11.5, fontFamily: "var(--sans)",
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, opacity: .8 }}>
          <circle cx="12" cy="12" r="9" /><path d="M12 16v-5M12 8h.01" />
        </svg>
        {label}
      </button>
      {open && (
        <span style={{
          position: "absolute", top: "calc(100% + 7px)", left: "50%", transform: "translateX(-50%)",
          zIndex: 5, width: 340, padding: "11px 14px", borderRadius: 12, textAlign: "left",
          background: "var(--card)", border: "1px solid var(--line2)",
          boxShadow: "0 16px 36px rgba(0,0,0,.4)",
          fontSize: 11.5, color: "var(--text)", lineHeight: 1.65, wordBreak: "break-word",
          animation: "fadeUp .18s ease-out both",
        }}>{detail}</span>
      )}
    </span>
  );
}

/** 서버 주소 후보 — 클라우드에서 이미 찾은 곳을 눌러 채운다.
 *
 *  스펙 주소(`http://host:8080/openapi.json`)가 아니라 **오리진**만 남긴다. 도구를 부를 때
 *  쓰는 값은 서비스의 뿌리 주소이고, 스펙 경로까지 들어가면 호출이 `/openapi.json/claims`
 *  로 나간다.
 *
 *  중복을 접는다 — 한 서버에서 API 를 여러 건 찾으면 오리진은 하나다. */
function AddressPicks({ found, onPick }) {
  const origins = [...new Set((found || [])
    .map((r) => {
      try {
        const u = new URL(r.spec_url || r.url || "");
        return u.origin;
      } catch {
        return "";                       // 주소가 아닌 값(APIM 내부 이름 등)은 후보에서 뺀다
      }
    })
    .filter(Boolean))];
  if (!origins.length) return null;
  return (
    <div style={{ marginTop: -8, marginBottom: 18 }}>
      <div style={{ fontSize: 10.8, color: "var(--faint)", marginBottom: 6 }}>
        클라우드에서 찾은 주소 — 누르면 채워집니다
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {origins.slice(0, 6).map((u) => (
          <button key={u} type="button" onClick={() => onPick(u)} className="mono" style={{
            fontSize: 10.8, padding: "5px 10px", borderRadius: 8, cursor: "pointer",
            background: "var(--blue-bg)", color: "var(--blue)",
            border: "1px solid color-mix(in srgb,var(--blue) 32%,transparent)",
          }}>{u}</button>
        ))}
      </div>
    </div>
  );
}

/** 채널 하나 — 무엇을 어떻게 읽는 중인지와 그 채널의 로그만 보여준다. */
/** 지금 어느 방법으로 읽는 중인가 — 소스 코드 채널에만 있는 3단계 폴백을 그대로 비춘다.
 *
 *  변환이 끝나면 결과 쪽(도구 목록)에 방식 배지가 남으므로 여기서는 **읽는 동안만** 보여준다.
 *  다 끝난 화면에 같은 말을 두 번 적으면 둘 다 안 읽힌다. */
function StageBar({ ch }) {
  if (ch.key !== "code") return null;
  const now = ch.resources.find((r) => r.state === "running");
  if (!now) return null;
  const cur = CODE_STAGES.findIndex(([k]) => k === now.stage);
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
      {CODE_STAGES.map(([k, label], i) => {
        const done = cur >= 0 && i < cur, on = cur === i;
        return (
          <span key={k} className="mono" style={{
            display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10,
            padding: "3px 9px", borderRadius: 999,
            border: `1px solid ${on ? "rgba(47,134,246,.45)" : done ? "rgba(74,222,128,.32)" : "#25304d"}`,
            background: on ? "rgba(47,134,246,.12)" : done ? "rgba(74,222,128,.08)" : "transparent",
            color: on ? "var(--blue)" : done ? "#4ade80" : "#5a6488",
            opacity: done ? .75 : 1,
          }}>{label}</span>
        );
      })}
    </div>
  );
}

function ChannelLog({ ch, pending }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [ch.logs.length]);
  // 문서는 MCP 변환이 "끝난" 뒤에도 벡터 적재가 이어진다. 리소스 상태만 보면 다 끝난
  // 것으로 계산되므로, 뒤에서 도는 트랙을 진행 중에 포함시킨다.
  const busy = ch.done < ch.resources.length || pending;

  // 마지막 줄이 언제 찍혔는지 — 로그가 뜸한 구간(접속 대기·클론)에서 "몇 초째 기다리는
  // 중" 을 보여주지 않으면 화면이 죽은 것처럼 보인다. 실제로 DNS 타임아웃은 수십 초다.
  const [waited, setWaited] = useState(0);
  const stamp = useRef(0);
  useEffect(() => { stamp.current = Date.now(); setWaited(0); }, [ch.logs.length]);
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setWaited(Math.floor((Date.now() - stamp.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [busy, ch.logs.length]);
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 14, background: "var(--code)",
                  overflow: "hidden", display: "flex", flexDirection: "column", flex: 1, minHeight: 148 }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #25304d" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: ch.tone,
                         boxShadow: `0 0 9px ${busy ? ch.tone : "transparent"}`,
                         animation: busy ? "dashRing 1.8s ease-out infinite" : "none" }} />
          <span style={{ fontSize: 12, fontWeight: 750, color: "#d6dcf0" }}>{ch.label}</span>
          <span style={{ fontSize: 10, color: "#5a6488" }}>{ch.how}</span>
          <span className="mono" style={{ marginLeft: "auto", fontSize: 10, color: ch.tone }}>
            {ch.done}/{ch.resources.length} · 도구 {ch.count}
          </span>
        </div>
        <StageBar ch={ch} />
      </div>
      <div className="onb-scroll mono" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 14px",
        fontSize: 11.2, lineHeight: 1.9, color: "var(--code-text)" }}>
        {!ch.logs.length && <div style={{ color: "#5a6488" }}>대기 중…</div>}
        {ch.logs.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 9, animation: "stepIn .22s ease-out both" }}>
            <span style={{ width: 13, flexShrink: 0, color: LOG_COLOR[l.level] || "#4ade80" }}>
              {l.level === "error" ? "✕" : l.level === "warn" ? "!" : "✓"}
            </span>
            <span style={{ flex: 1 }}>{(l.msg || "").replace(/^\[[^\]]+\]\s*/, "")}</span>
          </div>
        ))}
        {/* 백그라운드 트랙은 잡 로그에 줄이 더 안 찍힌다. 그러면 마지막 줄이 결론처럼
            읽혀 끝난 화면이 된다 — 여기서 계속 돌고 있음을 직접 적는다. */}
        {pending && (
          <div style={{ display: "flex", gap: 9, animation: "stepIn .22s ease-out both" }}>
            <span style={{ width: 13, flexShrink: 0, color: "#4ade80" }}>·</span>
            <span style={{ flex: 1, color: "#4ade80" }}>
              문서를 잘라 임베딩하고 색인하는 중입니다 — 백그라운드에서 계속됩니다
            </span>
          </div>
        )}
        {busy && (
          <div style={{ display: "flex", gap: 9, color: "#5a6488", alignItems: "center" }}>
            <span style={{ width: 13, flexShrink: 0 }}>·</span>
            <Dots />
            {waited >= 3 && (
              <span style={{ fontSize: 10.5 }}>
                {waited}초째 기다리는 중{waited >= 20 ? " — 응답이 느린 대상일 수 있습니다" : ""}
              </span>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

const LOG_COLOR = { error: "#ef5350", warn: "#e8841e" };
const STATE_TEXT = { pending: "대기", running: "진행 중", done: "완료", warn: "확인 필요", fail: "실패" };
const STATE_COLOR = { done: "#4ade80", warn: "var(--amber)", fail: "var(--red)", running: "var(--blue)" };

function Stat({ label, value, tone }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 13, padding: "11px 13px" }}>
      <div className="mono" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: ".1em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontFamily: "var(--disp)", fontSize: 24, fontWeight: 700, marginTop: 3,
        color: tone === "tl" ? "var(--blue)" : "var(--navy)" }}>{value}</div>
    </div>
  );
}

/** 제품 대시보드가 쓰는 펄스 코어 — 진행 중임을 말하는 최소 장치. */
function Pulse() {
  return (
    <span style={{ position: "relative", width: 44, height: 44, display: "grid", placeItems: "center", flexShrink: 0 }}>
      {[0, 0.8, 1.6].map((d) => (
        <span key={d} style={{
          position: "absolute", width: 14, height: 14, borderRadius: "50%",
          border: "1px solid rgba(47,134,246,.5)", animation: `dashRing 2.4s ease-out ${d}s infinite`,
        }} />
      ))}
      <span style={{
        width: 14, height: 14, borderRadius: "50%", zIndex: 1,
        background: "radial-gradient(circle,#4c97f8,#1769e0)", boxShadow: "0 0 14px rgba(47,134,246,.55)",
      }} />
    </span>
  );
}

/** 첫 화면 일러스트 — 흩어진 레거시가 정렬된 도구로 바뀌고, 그 전부가 한 경계 안에서 끝난다.
 *
 *  제품 라인아트 문법을 따른다: viewBox 320×160, 위치는 8의 배수, 스트로크 3단(.75/1.25/2),
 *  면은 얕은 그라디언트. 새 모티프를 만들지 않고 노드·격자·판·경계선 네 어휘만 쓴다. */
function IntroIllust() {
  return (
    <svg viewBox="0 0 320 160" fill="none" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <linearGradient id="introT" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f86f6" stopOpacity=".18" /><stop offset="1" stopColor="#2f86f6" stopOpacity=".04" />
        </linearGradient>
        <linearGradient id="introP" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6f78d6" stopOpacity=".18" /><stop offset="1" stopColor="#6f78d6" stopOpacity=".04" />
        </linearGradient>
        <linearGradient id="introPlate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".06" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 경계 — 모든 처리가 이 안에서 끝난다는 사실이 그림의 전제다 */}
      <rect x="8" y="16" width="304" height="128" rx="16"
        stroke="var(--blue)" strokeWidth="1.25" strokeDasharray="4 6" opacity=".45" />

      {/* 좌: 흩어진 레거시 */}
      <g opacity=".5">
        {[[32, 48], [56, 40], [40, 72], [64, 64], [32, 96], [60, 96]].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="14" height="14" rx="4"
            fill="var(--card)" stroke="var(--faint)" strokeWidth=".75" />
        ))}
      </g>
      <g opacity=".22" stroke="var(--faint)" strokeWidth=".75">
        <path d="M46 55 56 47M47 79 64 71M46 103 60 103M70 47 70 64" />
      </g>

      {/* 중앙: 변환 지점 — 그림이 멈춰 있으면 "무엇이 일어나는 중"인지 안 읽힌다.
          흐르는 점선과 퍼지는 링, 둘만으로 방향과 동작을 보여준다. */}
      <path d="M88 80h28" stroke="var(--blue)" strokeWidth="1.25" opacity=".5"
        strokeDasharray="3 5" style={{ animation: "introFlow 1.6s linear infinite" }} />
      <circle cx="124" cy="80" r="9" fill="none" stroke="var(--blue)" strokeWidth="2" />
      <circle cx="124" cy="80" r="9" fill="none" stroke="var(--blue)" strokeWidth="1.25"
        style={{ transformOrigin: "124px 80px", animation: "dashRing 2.6s ease-out infinite" }} />
      <circle cx="124" cy="80" r="2.5" fill="var(--blue)" />
      <path d="M133 80h19" stroke="var(--blue)" strokeWidth="2" />

      {/* 우: 정렬된 도구 — API(teal) 와 DB(purple) 두 층 */}
      <rect x="160" y="40" width="128" height="18" rx="6" fill="url(#introT)" stroke="var(--blue)" strokeWidth="1.25" />
      <rect x="160" y="64" width="104" height="18" rx="6" fill="url(#introT)" stroke="var(--blue)" strokeWidth="2" />
      <rect x="160" y="96" width="120" height="18" rx="6" fill="url(#introP)" stroke="var(--purple)" strokeWidth="1.25" />
      <rect x="160" y="40" width="128" height="18" rx="6" fill="url(#introPlate)" />
      <path d="M172 49h40M172 73h28M172 105h34" stroke="var(--blue)" strokeWidth="1.25" opacity=".45" />
    </svg>
  );
}

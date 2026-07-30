import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Stepper from "../components/Stepper";
import Toast, { useToast } from "../components/Toast";
import { ErrorBox, SkeletonRows } from "../components/States";

// 백엔드 apps/backend/app/services/masking.py의 SENSITIVE_KEYS와 같은 목록이어야
// 한다. 값을 바꿀 때는 두 곳을 함께 고친다.
const MASKED_KEYS = ["password", "token", "apiKey", "sessionId", "ssn", "jumin", "cardNumber", "cvv"];

export default function ActionEdit() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [actionId, setActionId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectName, setProjectName] = useState("");
  const [spec, setSpec] = useState<any>(null);
  const [name, setName] = useState("");
  const [toolName, setToolName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("DRAFT");
  // loadError: /api/actions/:id(또는 생성 POST)가 실패해 그릴 것이 전혀
  // 없는 경우에만 쓴다 — 이때만 전체 화면 오류로 대체한다.
  const [loadError, setLoadError] = useState<string | null>(null);
  // error: 브레드크럼용 프로젝트 이름 조회, 활성화 실패처럼 이미 채워진
  // 폼을 그대로 둬야 하는 경우에 쓴다 — 인라인 배너로만 보여준다.
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const { toasts, showToast, dismiss } = useToast();

  // React 18 StrictMode는 개발 모드에서 effect를 두 번 실행한다. 이 가드가
  // 없으면 POST가 두 번 나가 Action이 두 개 생긴다.
  const requested = useRef(false);

  useEffect(() => {
    // 1) /actions/:id — 이미 만들어진 액션을 읽기만 한다. POST하지 않는다.
    if (id) {
      api.get(`/api/actions/${id}`)
        .then((row) => {
          setActionId(row.id);
          setProjectId(row.projectId);
          setSpec(row.actionSpec);
          setName(row.name);
          setToolName(row.toolName);
          setDescription(row.description);
          setStatus(row.status);
        })
        .catch((err) => setLoadError(errorMessage(err)));
      return;
    }

    // 2) /actions/new?requestId=N — 한 번만 만들고 곧바로 /actions/:id로 옮긴다.
    //    주소가 바뀌므로 새로고침해도 다시 만들어지지 않는다.
    const requestId = params.get("requestId");
    if (!requestId || requested.current) return;
    requested.current = true;

    // 이름은 보내지 않는다. 백엔드가 기록된 URL에서 초안을 만든다 —
    // 하드코딩하면 어떤 사이트를 기록해도 같은 이름을 달고 태어난다.
    api.post("/api/actions", { networkRequestId: Number(requestId) })
      .then((res) => navigate(`/actions/${res.id}`, { replace: true }))
      .catch((err) => setLoadError(errorMessage(err)));
    // name·toolName·description은 일부러 의존성에서 뺀다. 생성 경로에서만
    // 읽는 값이고 그때 필요한 것은 초기 기본값이며, 재실행은 requested 가드가
    // 막는다. 반대로 의존성에 넣으면 /actions/:id 경로에서 응답이 이 값들을
    // 갱신하는 순간 effect가 다시 돌아 같은 액션을 한 번 더 GET하게 된다.
  }, [id, params, navigate]);

  // 프로젝트 이름은 브레드크럼에만 쓰이므로 projectId를 알게 된 뒤 조회한다.
  useEffect(() => {
    if (projectId == null) return;
    api.get("/api/projects")
      .then((list: { id: number; name: string }[]) => {
        const found = list.find((p) => p.id === projectId);
        setProjectName(found ? found.name : `#${projectId}`);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [projectId]);

  if (loadError) {
    return (
      <Shell breadcrumb={["프로젝트", projectName, name]} projectId={projectId} projectName={projectName}>
        <ErrorBox message={loadError} />
      </Shell>
    );
  }

  if (!spec) {
    return (
      <Shell breadcrumb={["프로젝트", projectName, name]} projectId={projectId} projectName={projectName}>
        <SkeletonRows rows={2} />
      </Shell>
    );
  }

  const paramTable = spec.request.bodySchema ?? spec.request.querySchema ?? {};

  // LLM 에게 감춘 파라미터 = 실행 시점에 서버가 채워야 하는 값. 기관마다 이름이
  // 달라(serviceKey / ServiceKey) 하드코딩하지 않고 스펙에서 읽는다.
  const hiddenParams = Object.entries(paramTable)
    .filter(([, def]: [string, any]) => def?.llmEditable === false)
    .map(([key]) => key);

  function updateParam(key: string, field: string, value: unknown) {
    setSpec((prev: any) => {
      const target = prev.request.bodySchema ? "bodySchema" : "querySchema";
      return {
        ...prev,
        request: {
          ...prev.request,
          [target]: { ...prev.request[target], [key]: { ...prev.request[target][key], [field]: value } },
        },
      };
    });
  }

  /** 폼 내용을 저장한다. 상태를 넘기지 않으면 서버가 현재 상태를 유지한다. */
  async function persist(nextStatus?: string) {
    if (!actionId) return;
    setActivating(true);
    setError(null);
    try {
      await api.put(`/api/actions/${actionId}`, {
        name,
        toolName,
        // 스펙에도 같은 값을 실어 둔다. 도구 정의는 스펙의 toolName을 읽고
        // 콘솔의 중복 제거는 컬럼을 읽으므로, 둘이 어긋나면 이름이 갈린다.
        actionSpec: { ...spec, name, toolName, description },
        description,
        ...(nextStatus ? { status: nextStatus } : {}),
      });
      setSpec({ ...spec, name, toolName, description });
      if (nextStatus) setStatus(nextStatus);
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setActivating(false);
    }
  }

  /** 저장만 하고 화면에 머무른다 (이미 활성화된 액션을 고칠 때). */
  async function save() {
    if (await persist()) showToast("저장했습니다");
  }

  /**
   * 활성화한 뒤 테스트 콘솔로 넘어간다. 버튼이 "활성화하고 테스트하기"라고
   * 약속하므로 활성화만 하고 멈추면 약속을 지키지 않는 것이다.
   */
  async function activate() {
    const ok = await persist("ACTIVE");
    if (ok && projectId) navigate(`/projects/${projectId}/console`);
  }

  return (
    <Shell breadcrumb={["프로젝트", projectName, name]} projectId={projectId} projectName={projectName}>
      <div className="page-head">
        <div>
          <span className="eyebrow">action</span>
          <h1>{name}</h1>
          <p className="page-sub">
            <span className={status === "ACTIVE" ? "dot dot-ok" : "dot"}>
              {status === "ACTIVE" ? "활성" : "초안"}
            </span>
          </p>
        </div>
      </div>

      <Stepper current={3} />

      <div className="edit-grid">
        <article className="panel panel-pad">
          <div className="panel-head">
            <h2>기본 정보</h2>
          </div>
          <div className="form-grid">
            <label className="field">
              <span className="field-label">액션명</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Tool 이름</span>
              <input
                className="input input-mono"
                value={toolName}
                onChange={(e) => setToolName(e.target.value)}
              />
            </label>
            <label className="field wide">
              <span className="field-label">설명</span>
              <textarea
                className="textarea"
                value={description}
                placeholder="LLM이 언제 이 도구를 골라야 하는지 설명하세요"
                onChange={(e) => setDescription(e.target.value)}
              />
              <span className="field-help">LLM 이 도구를 고를 때 읽는 유일한 근거입니다</span>
            </label>
          </div>

          <div className="endpoint">
            <strong>{spec.request.method}</strong>
            <span className="truncate">{spec.request.urlTemplate}</span>
          </div>

          <div className="panel-head mt-4" style={{ marginTop: 28 }}>
            <h2>요청 파라미터</h2>
            <span className="tag">자동 추론 {Object.keys(paramTable).length}</span>
          </div>

          {Object.entries(paramTable).map(([key, def]: [string, any]) => {
            // llmEditable=false 인 파라미터는 인증키다. 실행 직전에 서버가
            // 채우므로 LLM 도, 사용자도 여기서 값을 넣지 않는다. 왜 다른지가
            // 화면에서 읽혀야 한다 — 일반 파라미터와 똑같이 그리면 안 된다.
            const credential = def.llmEditable === false;
            return (
              <div className={credential ? "param-card is-credential" : "param-card"} key={key}>
                <div className="param-head">
                  <code className="param-key">{key}</code>
                  {credential ? (
                    <span className="kind-badge kind-portal">LLM 에게 숨김</span>
                  ) : (
                    <>
                      {def.required && <span className="tag tag-danger">필수</span>}
                      <select
                        className="select param-type"
                        aria-label={`${key} 타입`}
                        value={def.type}
                        onChange={(e) => updateParam(key, "type", e.target.value)}
                      >
                        {["string", "integer", "number", "boolean"].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                      {def.example !== undefined && def.example !== null && (
                        <span className="param-example" title={String(def.example)}>
                          예시 <b>{String(def.example)}</b>
                        </span>
                      )}
                    </>
                  )}
                </div>

                {credential ? (
                  <p className="field-help">
                    실행 직전 프로젝트 인증키에서 주입됩니다. 키가 없으면 호출 전에 막힙니다.
                  </p>
                ) : (
                  <input
                    className="input mt-2"
                    aria-label={`${key} 설명`}
                    value={def.description ?? ""}
                    placeholder="이 파라미터에 무엇을 넣어야 하는지 LLM에게 설명하세요"
                    onChange={(e) => updateParam(key, "description", e.target.value)}
                  />
                )}
              </div>
            );
          })}

          <div className="callout">
            <strong>민감정보 마스킹 {MASKED_KEYS.length}종 적용 중</strong>
            <p>{MASKED_KEYS.join(" · ")}</p>
            <p>URL 쿼리 · 요청 본문 · 응답 샘플 세 곳에 적용됩니다.</p>
          </div>

          {/* 인증키는 액션이 아니라 프로젝트에 붙고(Project.credentials) 입력란은
              테스트 콘솔에 있다. 액션 편집 화면에서 키를 찾으면 없으므로 길을
              알려준다. authMode 로 갈라 트래픽 액션(NONE)에는 띄우지 않는다. */}
          {spec.execution?.authMode === "CREDENTIAL" && (
            <div className="callout" style={{ borderLeftColor: "var(--kind-portal)" }}>
              <strong>이 액션은 포털 인증키가 필요합니다</strong>
              <p>
                {hiddenParams.length > 0 && <code className="param-key">{hiddenParams.join(", ")}</code>}
                {hiddenParams.length > 0 && " 는 "}
                LLM 에게 넘기지 않고 실행 직전에 서버가 채웁니다. 등록되지 않았으면 호출 전에 막힙니다.
              </p>
              {projectId && (
                <p className="mt-2">
                  <Link className="btn btn-sm" to={`/projects/${projectId}/console`}>
                    테스트 콘솔에서 인증키 등록
                  </Link>
                </p>
              )}
            </div>
          )}

          {error && <ErrorBox title="저장하지 못했습니다" message={error} />}

          {/* 활성화 뒤에도 설명을 고칠 수 있어야 한다. 예전에는 ACTIVE가 되면
              버튼이 비활성으로 잠겨, 그 뒤에 입력한 설명을 저장할 방법이 없었다. */}
          <div className="edit-actions">
            {status === "ACTIVE" ? (
              <>
                <button type="button" className="btn" onClick={save} disabled={activating}>
                  {activating ? "저장 중…" : "저장"}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => projectId && navigate(`/projects/${projectId}/console`)}
                >
                  테스트 콘솔로 이동
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary" onClick={activate} disabled={activating}>
                {activating ? "활성화 중…" : "활성화하고 테스트하기"}
              </button>
            )}
          </div>
        </article>

        <article className="code">
          <div className="code-head">
            <span>ActionSpec</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(JSON.stringify(spec, null, 2))
                  .then(() => showToast("ActionSpec 을 복사했습니다"))
                  .catch(() => showToast("복사하지 못했습니다", "error"));
              }}
            >
              복사
            </button>
          </div>
          <pre>{JSON.stringify(spec, null, 2)}</pre>
        </article>
      </div>

      <Toast items={toasts} onDismiss={dismiss} />
    </Shell>
  );
}

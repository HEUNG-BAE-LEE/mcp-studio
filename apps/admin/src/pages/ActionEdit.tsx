import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Stepper from "../components/Stepper";

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
  const [name, setName] = useState("아파트 단지 조회");
  const [toolName, setToolName] = useState("search_apartment_markers");
  const [description, setDescription] = useState("지도 영역 안의 아파트 단지 목록을 조회합니다.");
  const [status, setStatus] = useState("DRAFT");
  // loadError: /api/actions/:id(또는 생성 POST)가 실패해 그릴 것이 전혀
  // 없는 경우에만 쓴다 — 이때만 전체 화면 오류로 대체한다.
  const [loadError, setLoadError] = useState<string | null>(null);
  // error: 브레드크럼용 프로젝트 이름 조회, 활성화 실패처럼 이미 채워진
  // 폼을 그대로 둬야 하는 경우에 쓴다 — 인라인 배너로만 보여준다.
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

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

    api.post("/api/actions", { networkRequestId: Number(requestId), name, toolName, description })
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
      <Shell breadcrumb={["Projects", projectName, name]} projectId={projectId} projectName={projectName}>
        <div className="error-banner">
          <strong>요청을 처리하지 못했습니다</strong>
          <p>{loadError}</p>
        </div>
      </Shell>
    );
  }

  if (!spec) {
    return (
      <Shell breadcrumb={["Projects", projectName, name]} projectId={projectId} projectName={projectName}>
        <p>불러오는 중...</p>
      </Shell>
    );
  }

  const paramTable = spec.request.bodySchema ?? spec.request.querySchema ?? {};

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

  async function activate() {
    if (!actionId) return;
    setActivating(true);
    setError(null);
    try {
      await api.put(`/api/actions/${actionId}`, {
        name,
        toolName,
        actionSpec: { ...spec, name, toolName, description },
        description,
        status: "ACTIVE",
      });
      setStatus("ACTIVE");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActivating(false);
    }
  }

  return (
    <Shell breadcrumb={["Projects", projectName, name]} projectId={projectId} projectName={projectName}>
      <section className="heading-row">
        <div>
          <p className="eyebrow">액션 생성</p>
          <h1>{name}</h1>
          <p className="subtitle">
            <span className={status === "ACTIVE" ? "status" : "status status-1"}>{status}</span>
          </p>
        </div>
      </section>

      <Stepper current={3} />

      <div className="builder-layout">
        <article className="panel builder-form">
          <div className="panel-heading">
            <h2>기본정보</h2>
          </div>
          <div className="form-grid">
            <label>
              액션명
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Tool 이름
              <input value={toolName} onChange={(e) => setToolName(e.target.value)} />
            </label>
            <label className="wide">
              설명 (LLM이 이 도구를 선택할 때 읽는 내용)
              <textarea
                value={description}
                placeholder="LLM이 언제 이 도구를 골라야 하는지 설명하세요"
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </div>
          <p className="mono endpoint-line">
            {spec.request.method} {spec.request.urlTemplate}
          </p>

          <h3 className="subheading">요청 파라미터 — 자동 추론됨</h3>
          {Object.entries(paramTable).map(([key, def]: [string, any]) => (
            <div className="schema-row" key={key}>
              <code>{key}</code>
              <select value={def.type} onChange={(e) => updateParam(key, "type", e.target.value)}>
                {["string", "integer", "number", "boolean"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <small title={String(def.example)}>{String(def.example)}</small>
              <p>
                <input
                  value={def.description ?? ""}
                  placeholder="이 파라미터에 무엇을 넣어야 하는지 LLM에게 설명하세요"
                  onChange={(e) => updateParam(key, "description", e.target.value)}
                />
              </p>
            </div>
          ))}

          <div className="security-callout">
            <strong>민감정보 마스킹 {MASKED_KEYS.length} rules</strong>
            <p>{MASKED_KEYS.join(" · ")}</p>
            <p>URL 쿼리 · 요청 본문 · 응답 샘플 세 곳에 적용됩니다.</p>
          </div>

          {error && (
            <div className="error-banner">
              <strong>활성화에 실패했습니다</strong>
              <p>{error}</p>
            </div>
          )}

          <button className="primary activate-button" onClick={activate} disabled={activating || status === "ACTIVE"}>
            {activating ? "활성화 중..." : status === "ACTIVE" ? "활성화됨" : "활성화하고 테스트하기"}
          </button>
        </article>

        <article className="panel code-preview">
          <div className="panel-heading">
            <h2>ActionSpec</h2>
          </div>
          <pre>{JSON.stringify(spec, null, 2)}</pre>
        </article>
      </div>
    </Shell>
  );
}

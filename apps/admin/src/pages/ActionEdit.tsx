import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";

export default function ActionEdit() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [actionId, setActionId] = useState<number | null>(null);
  const [spec, setSpec] = useState<any>(null);
  const [name, setName] = useState("아파트 단지 조회");
  const [toolName, setToolName] = useState("search_apartment_markers");
  const [description, setDescription] = useState("지도 영역 안의 아파트 단지 목록을 조회합니다.");
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  // React 18 StrictMode는 개발 모드에서 effect를 두 번 실행한다.
  // 이 effect는 POST /api/actions를 호출해 Action 행을 하나 만드는데,
  // 가드 없이는 Action이 두 개 생겨 영상에서 눈에 띄게 된다.
  const requested = useRef(false);

  useEffect(() => {
    const requestId = params.get("requestId");
    if (!requestId || requested.current) return;
    requested.current = true;

    api
      .post("/api/actions", {
        projectId: 1,
        networkRequestId: Number(requestId),
        name,
        toolName,
        description,
      })
      .then((res) => {
        setActionId(res.id);
        setSpec(res.actionSpec);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: 20 }}>액션 편집</h1>
        <div style={{ marginTop: 16, padding: 12, background: "#fef2f2", color: "#b91c1c", borderRadius: 6 }}>
          ActionSpec 생성에 실패했습니다: {error}
        </div>
      </div>
    );
  }

  if (!spec) return <p style={{ padding: 24 }}>ActionSpec 생성 중...</p>;

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
        actionSpec: { ...spec, name, toolName, description },
        description,
        status: "ACTIVE",
      });
      navigate("/console");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setActivating(false);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1000 }}>
      <h1 style={{ fontSize: 20 }}>액션 편집</h1>

      <fieldset style={{ border: "1px solid #ddd", padding: 16, marginBottom: 20 }}>
        <legend>기본정보</legend>
        <label>
          액션명 <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: 300 }} />
        </label>
        <label style={{ marginLeft: 16 }}>
          Tool 이름 <input value={toolName} onChange={(e) => setToolName(e.target.value)} style={{ width: 300 }} />
        </label>
        <div style={{ marginTop: 10 }}>
          <label>
            설명 (LLM이 이 도구를 선택할 때 읽는 내용)
            <input
              value={description}
              placeholder="LLM이 언제 이 도구를 골라야 하는지 설명하세요"
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: 700, display: "block", marginTop: 4 }}
            />
          </label>
        </div>
        <div style={{ marginTop: 10, fontFamily: "monospace", fontSize: 12, color: "#555" }}>
          {spec.request.method} {spec.request.urlTemplate}
        </div>
      </fieldset>

      <fieldset style={{ border: "1px solid #ddd", padding: 16 }}>
        <legend>요청 파라미터 — 자동 추론됨</legend>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
              <th style={{ padding: 6, width: 120 }}>이름</th>
              <th style={{ padding: 6, width: 110 }}>타입</th>
              <th style={{ padding: 6 }}>설명 (LLM에게 줄 힌트)</th>
              <th style={{ padding: 6, width: 140 }}>예시값</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(paramTable).map(([key, def]: [string, any]) => (
              <tr key={key} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: 6, fontFamily: "monospace" }}>{key}</td>
                <td style={{ padding: 6 }}>
                  <select value={def.type} onChange={(e) => updateParam(key, "type", e.target.value)}>
                    {["string", "integer", "number", "boolean"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: 6 }}>
                  <input
                    value={def.description ?? ""}
                    placeholder="이 파라미터에 무엇을 넣어야 하는지 LLM에게 설명하세요"
                    onChange={(e) => updateParam(key, "description", e.target.value)}
                    style={{ width: "100%", minWidth: 320, boxSizing: "border-box" }}
                  />
                </td>
                <td style={{ padding: 6, fontFamily: "monospace", fontSize: 12, color: "#666" }}>
                  {/* 예시값은 읽기 전용이며 기록된 값 그대로 보여준다.
                      가공/반올림하지 않는다 — Task 14의 LLM이 좌표 생성 시
                      이 값을 가장 강력한 힌트로 사용한다. */}
                  {String(def.example)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </fieldset>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: "#fef2f2", color: "#b91c1c", borderRadius: 6 }}>
          활성화에 실패했습니다: {error}
        </div>
      )}

      <button
        onClick={activate}
        disabled={activating}
        style={{
          marginTop: 20,
          padding: "10px 20px",
          background: activating ? "#86efac" : "#16a34a",
          color: "#fff",
          border: 0,
          borderRadius: 6,
          cursor: activating ? "default" : "pointer",
        }}
      >
        {activating ? "활성화 중..." : "활성화하고 테스트하기"}
      </button>
    </div>
  );
}

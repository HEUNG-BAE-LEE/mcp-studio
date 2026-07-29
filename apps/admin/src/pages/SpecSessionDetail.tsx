import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Stepper from "../components/Stepper";
import { MarkPortal } from "../components/CollectionMark";

/**
 * 포털 공개 기반 수집 세션의 후보 목록.
 *
 * 트래픽 세션은 "어느 요청이 진짜 업무 API인가"를 점수로 가려야 하지만,
 * 포털 명세는 기관이 직접 공개한 것이라 가릴 필요가 없다. 대신 파라미터가
 * 몇 개이고 무엇이 필수인지가 사용자의 판단 근거라 그것을 보여준다.
 */

type SpecParam = {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example: string | null;
};

type SpecOperationRow = {
  id: number;
  opName: string;
  summary: string;
  method: string;
  url: string;
  serviceName: string;
  provider: string;
  paramCount: number;
  requiredCount: number;
  responseFieldCount: number;
  params: SpecParam[];
  warnings: string[];
};

export default function SpecSessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const session = useQuery({
    queryKey: ["session", id],
    queryFn: () => api.get(`/api/recording-sessions/${id}`),
  });

  const operations = useQuery<SpecOperationRow[]>({
    queryKey: ["spec-operations", id],
    queryFn: () => api.get(`/api/recording-sessions/${id}/spec-operations`),
  });

  const createAction = useMutation({
    mutationFn: (operationId: number) => api.post(`/api/spec-operations/${operationId}/actions`, {}),
    onSuccess: (action: { id: number }) => navigate(`/actions/${action.id}`),
    onError: (err) => setError(errorMessage(err)),
  });

  const projectId: number | null = session.data?.projectId ?? null;
  const projectName: string = session.data?.projectName ?? "";
  const breadcrumb = ["Projects", projectName, `세션 #${id}`];

  if (operations.isLoading) {
    return (
      <Shell breadcrumb={breadcrumb} projectId={projectId} projectName={projectName}>
        <p>불러오는 중...</p>
      </Shell>
    );
  }

  if (operations.isError) {
    return (
      <Shell breadcrumb={breadcrumb} projectId={projectId} projectName={projectName}>
        <div className="error-banner">
          <strong>불러오지 못했습니다</strong>
          <p>{errorMessage(operations.error)}</p>
        </div>
      </Shell>
    );
  }

  const rows = operations.data ?? [];
  const serviceName = rows[0]?.serviceName ?? session.data?.sourceLabel ?? "";

  return (
    <Shell breadcrumb={breadcrumb} projectId={projectId} projectName={projectName}>
      <section className="heading-row">
        <div>
          <p className="eyebrow">명세 파싱</p>
          <h1>세션 #{id}</h1>
          <p className="subtitle">{serviceName || "포털이 공개한 명세"}에서 읽어온 오퍼레이션입니다.</p>
        </div>
      </section>

      <Stepper current={2} kind="portal" />

      {error && (
        <div className="error-banner">
          <strong>액션을 만들지 못했습니다</strong>
          <p>{error}</p>
        </div>
      )}

      {/* 포털은 상세기능을 목록에서 하나씩만 렌더한다. 이 사실을 밝히지 않으면
          사용자는 "5개 중 1개만 잡혔다"를 버그로 읽는다. */}
      <p className="spec-note">
        <MarkPortal /> 포털 상세페이지는 상세기능을 목록에서 하나씩 보여줍니다. 다른 기능도 수집하려면
        그 페이지에서 목록을 바꾼 뒤 확장에서 <strong>공개 명세 수집</strong>을 다시 누르세요.
      </p>

      {rows.length === 0 ? (
        <div className="empty-state">
          <strong>아직 수집된 오퍼레이션이 없습니다</strong>
        </div>
      ) : (
        <article className="panel" style={{ marginTop: 16, padding: 18 }}>
          <div className="project-table table-6col spec-table">
            <div className="table-head">
              <span>오퍼레이션</span>
              <span>Method</span>
              <span>파라미터</span>
              <span>필수</span>
              <span>응답 필드</span>
              <span />
            </div>

            {rows.map((row) => (
              <div key={row.id}>
                <div className="table-row">
                  <span>
                    <strong className="op-name">{row.opName}</strong>
                    <span className="mono op-url" title={row.url}>{row.url}</span>
                    {row.warnings.length > 0 && <span className="op-warning">{row.warnings[0]}</span>}
                  </span>
                  <span>{row.method}</span>
                  <span className="mono">{row.paramCount}</span>
                  <span className="mono">{row.requiredCount}</span>
                  <span className="mono">{row.responseFieldCount}</span>
                  <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      className="quiet-button"
                      onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                    >
                      {expanded === row.id ? "접기" : "상세"}
                    </button>
                    <button
                      className="primary"
                      disabled={createAction.isPending}
                      onClick={() => {
                        setError(null);
                        createAction.mutate(row.id);
                      }}
                    >
                      액션 만들기
                    </button>
                  </span>
                </div>

                {expanded === row.id && (
                  <div style={{ padding: "10px 12px 14px", background: "#fafbfd", borderTop: "1px solid #edf0f4" }}>
                    <div className="project-table spec-params">
                      <div className="table-head">
                        <span>이름</span>
                        <span>타입</span>
                        <span>필수</span>
                        <span>예시</span>
                        <span>설명</span>
                      </div>
                      {row.params.map((param) => (
                        <div className="table-row" key={param.name}>
                          <span className="mono">{param.name}</span>
                          <span>{param.type}</span>
                          <span>{param.required ? "필수" : "선택"}</span>
                          <span className="mono">{param.example ?? "-"}</span>
                          <span title={param.description}>{param.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </article>
      )}
    </Shell>
  );
}

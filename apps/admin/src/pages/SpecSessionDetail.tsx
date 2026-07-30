import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Stepper from "../components/Stepper";
import { KindMark } from "../components/CollectionMark";

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
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const session = useQuery({
    queryKey: ["session", id],
    queryFn: () => api.get(`/api/recording-sessions/${id}`),
  });

  const operations = useQuery<SpecOperationRow[]>({
    queryKey: ["spec-operations", id],
    queryFn: () => api.get(`/api/recording-sessions/${id}/spec-operations`),
  });

  // 일괄 수집은 한 번에 수십 개를 모은다. MCP 를 하나씩 만들게 하면 수집을
  // 자동화한 의미가 사라진다.
  const createAll = useMutation({
    mutationFn: () => api.post(`/api/recording-sessions/${id}/spec-actions`, { status: "ACTIVE" }),
    onSuccess: (result: { message: string }) => setBulkResult(result.message),
    onError: (err) => setError(errorMessage(err)),
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
        <div className="error-box">
          <strong>불러오지 못했습니다</strong>
          <p>{errorMessage(operations.error)}</p>
        </div>
      </Shell>
    );
  }

  const rows = operations.data ?? [];
  const serviceName = rows[0]?.serviceName ?? session.data?.sourceLabel ?? "";
  const serviceCount = new Set(rows.map((row) => row.serviceName)).size;
  // 일괄 수집이면 세션 하나에 여러 서비스가 섞인다. 서비스명을 접두로 보여주지
  // 않으면 무엇을 모았는지 화면에서 읽을 수 없다.
  const bulkCollected = serviceCount > 1;
  // 이 화면은 포털·문서 두 방식이 함께 쓴다(둘 다 명세를 파싱해 후보를 만든다).
  // 방식을 구분하지 않으면 문서에서 읽은 세션에 "확장에서 다시 누르세요" 같은
  // 포털 안내가 붙는다.
  const fromDocument = session.data?.kind === "document";

  return (
    <Shell breadcrumb={breadcrumb} projectId={projectId} projectName={projectName}>
      <section className="page-head">
        <div>
          <p className="eyebrow">명세 파싱</p>
          <h1>세션 #{id}</h1>
          <p className="page-sub">
            {serviceName || (fromDocument ? "올린 문서" : "포털이 공개한 명세")}에서 읽어온 오퍼레이션입니다.
          </p>
        </div>
      </section>

      <Stepper current={2} kind={fromDocument ? "document" : "portal"} />

      {error && (
        <div className="error-box">
          <strong>MCP 를 만들지 못했습니다</strong>
          <p>{error}</p>
        </div>
      )}

      {/* 안내는 어떻게 수집했는지에 따라 달라야 한다. 일괄 수집인데 "확장에서
          다시 누르세요"라고 하면 하지 않아도 될 일을 시키는 셈이다. */}
      <p className="spec-note">
        <KindMark kind={fromDocument ? "document" : "portal"} />
        {fromDocument ? (
          <>
            문서에서 읽은 명세입니다. 엔드포인트·파라미터가 문서와 맞는지 확인한 뒤
            MCP 로 만들고, <strong>Playground</strong> 에서 한 번 호출해 보세요.
          </>
        ) : bulkCollected ? (
          <>
            목록 URL 하나로 <strong>서비스 {serviceCount}개 · 오퍼레이션 {rows.length}개</strong>를 모았습니다.
            아래에서 한 번에 MCP 로 만들 수 있습니다.
          </>
        ) : (
          <>
            포털 상세페이지는 상세기능을 목록에서 하나씩 보여줍니다. 다른 기능도 수집하려면
            그 페이지에서 목록을 바꾼 뒤 확장에서 <strong>공개 명세 수집</strong>을 다시 누르세요.
          </>
        )}
      </p>

      {rows.length > 0 && (
        <div className="bulk-bar">
          <div>
            <strong>{rows.length}개 오퍼레이션</strong>
            <span>{serviceCount}개 서비스에서 수집됨</span>
          </div>
          {bulkResult && <em className="bulk-result">{bulkResult}</em>}
          <button
            className="btn btn-primary"
            disabled={createAll.isPending}
            onClick={() => {
              setError(null);
              setBulkResult(null);
              createAll.mutate();
            }}
          >
            {createAll.isPending ? "만드는 중…" : "전체를 MCP 로 만들기"}
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="empty">
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
                    {bulkCollected && (
                      <span className="op-service" title={row.serviceName}>
                        {row.provider ? `${row.provider} · ` : ""}{row.serviceName}
                      </span>
                    )}
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
                      className="btn btn-ghost btn-sm"
                      onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                    >
                      {expanded === row.id ? "접기" : "상세"}
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={createAction.isPending}
                      onClick={() => {
                        setError(null);
                        createAction.mutate(row.id);
                      }}
                    >
                      MCP 만들기
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

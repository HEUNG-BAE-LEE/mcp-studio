import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import Stepper from "../components/Stepper";
import { MarkPortal } from "../components/CollectionMark";
import { EmptyState, ErrorBox, SkeletonRows } from "../components/States";

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

  // 일괄 수집은 한 번에 수십 개를 모은다. 액션을 하나씩 만들게 하면 수집을
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
  const breadcrumb = ["프로젝트", projectName, `세션 #${id}`];

  if (operations.isLoading) {
    return (
      <Shell breadcrumb={breadcrumb} projectId={projectId} projectName={projectName}>
        <SkeletonRows />
      </Shell>
    );
  }

  if (operations.isError) {
    return (
      <Shell breadcrumb={breadcrumb} projectId={projectId} projectName={projectName}>
        <ErrorBox
          title="불러오지 못했습니다"
          message={errorMessage(operations.error)}
          detail={`GET /api/recording-sessions/${id}/spec-operations`}
        />
      </Shell>
    );
  }

  const rows = operations.data ?? [];
  const serviceName = rows[0]?.serviceName ?? session.data?.sourceLabel ?? "";
  const serviceCount = new Set(rows.map((row) => row.serviceName)).size;
  // 일괄 수집이면 세션 하나에 여러 서비스가 섞인다. 서비스명을 접두로 보여주지
  // 않으면 무엇을 모았는지 화면에서 읽을 수 없다.
  const bulkCollected = serviceCount > 1;

  return (
    <Shell breadcrumb={breadcrumb} projectId={projectId} projectName={projectName}>
      <div className="page-head">
        <div>
          <span className="eyebrow">spec parsing</span>
          <h1>세션 #{id}</h1>
          <p className="page-sub">{serviceName || "포털이 공개한 명세"}에서 읽어온 오퍼레이션입니다</p>
        </div>
        {rows.length > 0 && (
          <div className="metrics head-side">
            <div>
              <b>{rows.length}</b>
              <small>오퍼레이션</small>
            </div>
            <div>
              <b>{serviceCount}</b>
              <small>서비스</small>
            </div>
          </div>
        )}
      </div>

      <Stepper current={2} kind="portal" />

      {error && <ErrorBox title="액션을 만들지 못했습니다" message={error} />}

      {/* 안내는 어떻게 수집했는지에 따라 달라야 한다. 일괄 수집인데 "확장에서
          다시 누르세요"라고 하면 하지 않아도 될 일을 시키는 셈이다. */}
      <p className="spec-note">
        <span style={{ color: "var(--kind-portal)", flexShrink: 0, marginTop: 2 }}>
          <MarkPortal />
        </span>
        {bulkCollected ? (
          <>
            목록 URL 하나로 <strong>서비스 {serviceCount}개 · 오퍼레이션 {rows.length}개</strong>를 모았습니다.
            아래에서 한 번에 액션으로 만들 수 있습니다.
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
            {createAll.isPending ? "만드는 중…" : "전체를 액션으로 만들기"}
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title="아직 수집된 오퍼레이션이 없습니다" />
      ) : (
        <div className="panel">
          <table className="tbl">
            <thead>
              <tr>
                <th>오퍼레이션</th>
                <th style={{ width: 84 }}>Method</th>
                <th style={{ width: 104 }}>파라미터</th>
                <th style={{ width: 84 }}>필수</th>
                <th style={{ width: 104 }}>응답 필드</th>
                <th style={{ width: 190 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const open = expanded === row.id;
                return [
                  <tr key={row.id}>
                    <td data-label="오퍼레이션">
                      {bulkCollected && (
                        <span className="op-service" title={row.serviceName}>
                          {row.provider ? `${row.provider} · ` : ""}
                          {row.serviceName}
                        </span>
                      )}
                      <span className="op-name">{row.opName}</span>
                      <span className="op-url" title={row.url}>{row.url}</span>
                      {row.warnings.length > 0 && (
                        <span className="dot dot-warn" style={{ marginTop: 5 }}>
                          {row.warnings[0]}
                          {row.warnings.length > 1 && ` 외 ${row.warnings.length - 1}건`}
                        </span>
                      )}
                    </td>
                    <td data-label="Method" className="num">{row.method}</td>
                    <td data-label="파라미터" className="num">{row.paramCount}</td>
                    <td data-label="필수" className="num">{row.requiredCount}</td>
                    <td data-label="응답 필드" className="num">{row.responseFieldCount}</td>
                    <td className="right">
                      <span className="cluster" style={{ justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          aria-expanded={open}
                          onClick={() => setExpanded(open ? null : row.id)}
                        >
                          <span className={open ? "chev open" : "chev"} aria-hidden="true">›</span>
                          상세
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={createAction.isPending}
                          onClick={() => {
                            setError(null);
                            createAction.mutate(row.id);
                          }}
                        >
                          액션 만들기
                        </button>
                      </span>
                    </td>
                  </tr>,
                  open ? (
                    <tr className="op-detail" key={`${row.id}-detail`}>
                      <td colSpan={6}>
                        <div className="inner">
                          <table className="tbl spec-params">
                            <thead>
                              <tr>
                                <th style={{ width: 180 }}>이름</th>
                                <th style={{ width: 96 }}>타입</th>
                                <th style={{ width: 86 }}>필수</th>
                                <th style={{ width: 140 }}>예시</th>
                                <th>설명</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.params.map((param) => (
                                <tr key={param.name}>
                                  <td data-label="이름" className="num">{param.name}</td>
                                  <td data-label="타입">{param.type}</td>
                                  <td data-label="필수">
                                    {param.required ? (
                                      <span className="tag tag-danger">필수</span>
                                    ) : (
                                      <span className="tag">선택</span>
                                    )}
                                  </td>
                                  <td data-label="예시" className="num">{param.example ?? "-"}</td>
                                  <td data-label="설명" title={param.description}>{param.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, errorMessage } from "../api/client";
import Shell from "../components/Shell";
import CollectPanels from "../components/CollectPanels";
import { ErrorBox } from "../components/States";
import { KindMark } from "../components/CollectionMark";

/**
 * 수집 스튜디오 — API 를 MCP 로 바꾸는 세 엔진.
 *
 * 마켓 모델에서 이건 "주방 도구"라 손님에게 보일 필요가 없다. 그런데도 화면에
 * 남기는 이유는 이 셋이 **우리 해자**이기 때문이다. 카탈로그를 사람이 손으로
 * 채웠다면 지금 규모가 안 된다. 스튜디오를 숨기면 이 제품은
 * "API 링크 모음집"으로 읽힌다.
 *
 * 권한 개념이 아직 정립되지 않았고 경진대회 기간이므로 모든 사용자에게 연다.
 *
 * 엔진 라벨과 설명은 CollectPanels 의 정본을 그대로 쓴다 — 같은 문구가 두 곳에
 * 생기면 한쪽만 고쳐지는 날이 온다.
 */

type Project = { id: number; name: string };

/** 방식마다 "무엇을 어떻게 읽는지"가 다르다. 화면이 그 절차를 먼저 말한다. */
const HOW: Record<string, { title: string; steps: string[] }> = {
  portal: {
    title: "포털 공개 기반은 이렇게 동작합니다",
    steps: [
      "포털 상세 페이지를 열어 요청주소·요청변수 표를 읽습니다",
      "기관마다 다른 라벨을 폴백 사슬로 흡수합니다 (요청주소 → 서비스URL → End Point)",
      "인증키로 쓰이는 파라미터를 찾아 LLM 에게 숨깁니다",
      "수집 직후 샘플 호출 1회로 실제 동작을 확인합니다",
    ],
  },
  document: {
    title: "문서 기반은 이렇게 동작합니다",
    steps: [
      "활용가이드 PDF·엑셀을 올리면 표와 문단을 함께 읽습니다",
      "규칙 기반 파서가 먼저 훑고, 놓친 것만 LLM 이 채웁니다",
      "포털에 표가 없는 기관을 이 경로로 흡수합니다",
      "추출한 명세를 사람이 확인한 뒤 MCP 로 만듭니다",
    ],
  },
  traffic: {
    title: "트래픽 기반은 이렇게 동작합니다",
    steps: [
      "브라우저 확장을 켜고 대상 화면을 조작합니다",
      "그 뒤에서 오간 API 호출을 관측해 요청·응답을 모읍니다",
      "점수로 정렬해 쓸 만한 것만 후보로 남깁니다",
      "문서가 아예 없는 시스템을 다루는 유일한 방법입니다",
    ],
  },
};

export default function Studio() {
  const [params] = useSearchParams();
  const projectParam = params.get("project");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | null>(
    projectParam ? Number(projectParam) : null,
  );
  const [engine, setEngine] = useState("portal");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/api/projects")
      .then((rows: Project[]) => {
        setProjects(rows);
        // 담을 곳이 정해지지 않으면 수집을 시작할 수 없다. 하나뿐이면 고민할
        // 것이 없으므로 자동으로 고른다.
        setProjectId((cur) => cur ?? (rows.length ? rows[0].id : null));
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const how = HOW[engine] ?? HOW.portal;
  const current = projects.find((p) => p.id === projectId);

  return (
    <Shell breadcrumb={["수집 스튜디오"]}>
      <div className="page-head">
        <div>
          <span className="eyebrow">studio</span>
          <h1>수집 스튜디오</h1>
          <p className="page-sub">
            API 를 MCP 도구로 바꿉니다 — 마켓에 진열된 것도 전부 여기서 만들어졌습니다.
          </p>
        </div>
        <div className="head-side">
          <label className="field-label" htmlFor="st-pj" style={{ margin: 0 }}>담을 곳</label>
          <select id="st-pj" className="input" style={{ width: 200 }}
                  value={projectId ?? ""}
                  onChange={(e) => setProjectId(Number(e.target.value))}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {projects.length === 0 && !error && (
        <p className="guide-note">
          <strong>프로젝트를 먼저 만들어 주세요</strong>
          수집한 MCP 는 프로젝트에 담깁니다. 홈에서 새 프로젝트를 만들면 됩니다.
        </p>
      )}

      {projectId && (
        <div className="studio-layout">
          <div>
            <CollectPanels
              projectId={projectId}
              projectName={current?.name ?? ""}
              onEngineChange={setEngine}
            />
          </div>

          <aside className="studio-side">
            <div className="studio-how">
              <div className="studio-how-hd">
                <KindMark kind={engine} size={15} />
                <b>{how.title}</b>
              </div>
              <ol className="steps">
                {how.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
            </div>

            <p className="guide-note">
              <strong>여기서 만든 것은 이 프로젝트 전용입니다</strong>
              마켓에 자동으로 올라가지 않습니다. 쓸 만한 것이 나오면
              카탈로그 등재를 따로 신청하는 흐름을 둘 예정입니다.
            </p>
          </aside>
        </div>
      )}
    </Shell>
  );
}

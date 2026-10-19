// 리소스 카테고리 — 변환 가능한 종류를 미리 보여주고 카테고리별로 등록한다.
// target: manifest 값(mcp|vectordb), tLabel: 화면 표기(MCP|RAG)
const Ico = (d) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
export const CATS = [
  { id: "openapi", label: "API 서버", desc: "OpenAPI / Swagger 스펙", target: "mcp", tLabel: "MCP", color: "var(--blue)", bg: "var(--blue-bg)",
    icon: Ico(<><rect x="3" y="4" width="18" height="5" rx="1.5" /><rect x="3" y="11" width="18" height="5" rx="1.5" /><path d="M7 6.5h.01M7 13.5h.01" /></>),
    hint: "실 API 서버의 Swagger URL 또는 스펙 파일 경로를 입력하면 각 엔드포인트가 MCP tool로 변환됩니다. 가장 정확한 방식입니다." },
  { id: "db", label: "데이터베이스", desc: "PG / MySQL / Oracle / Mongo", target: "mcp", tLabel: "MCP", color: "#6f78d6", bg: "#eef0fc",
    icon: Ico(<><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>),
    hint: "DSN으로 접속해 테이블/쿼리를 조회용 MCP tool로 노출합니다. 자격증명은 ${vault:db#dsn} 형식으로 안전하게 참조하세요." },
  { id: "document", label: "문서", desc: "PDF / docx / 이미지", target: "vectordb", tLabel: "RAG", color: "var(--amber)", bg: "var(--amber-bg)",
    icon: Ico(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>),
    hint: "문서를 청크로 나눠 임베딩한 뒤 VectorDB(RAG)에 적재합니다. glob 패턴(예: /srv/docs/**/*.pdf)으로 여러 파일을 한번에 지정할 수 있습니다." },
  { id: "system", label: "시스템 / ERP", desc: "SAP OData / RFC", target: "mcp", tLabel: "MCP", color: "#1faf6b", bg: "var(--green-bg)",
    icon: Ico(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
    hint: "SAP 등 사내 시스템의 OData/RFC 엔드포인트를 MCP tool로 래핑합니다. 폐쇄망 내부 주소를 그대로 입력하세요." },
];
// 코드 저장소 — 변환 前 원천 목록·blank() 가 이 항목을 찾는다.
CATS.push({
  id: "code", label: "소스 코드", desc: "사내 Git 저장소", target: "mcp", tLabel: "MCP",
  color: "var(--blue)", bg: "var(--blue-bg)",
  icon: Ico(<><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>),
  hint: "저장소를 읽어 API 목록을 만듭니다. 사본은 읽고 나면 지웁니다. 비공개 저장소는 읽기 권한 키가 필요합니다.",
});

export const cat = (id) => CATS.find((c) => c.id === id);

export const blank = (type) => ({
  name: "", type, target: cat(type).target,
  url: "", auth_value: "",
  path: "",
  driver: "postgres", dsn: "", dbUser: "", dbSecret: "", tables: "",
  repo_url: "", branch: "", subpath: "", token_ref: "",
  kind: "sap-odata", endpoint: "",
});

// db: driver 별 SQLAlchemy 스킴. 온프렘 DB 는 host/db + 읽기전용 계정을 받아 DSN 합성.
export const DB_SCHEME = { postgres: "postgresql+psycopg", mysql: "mysql+pymysql", oracle: "oracle+oracledb", mssql: "mssql+pyodbc", mongo: "mongodb" };
export const DB_DRIVERS = [
  ["postgres", "PostgreSQL"], ["mysql", "MySQL / MariaDB"], ["oracle", "Oracle"],
  ["mssql", "SQL Server"], ["mongo", "MongoDB"],
];

/** host/db + 읽기전용 계정 → SQLAlchemy DSN. 계정이 없으면 입력값을 그대로 통과시킨다.
 *
 *  온보딩(toResource)과 리소스 화면의 개별 추가가 이 한 함수를 공유한다. 규칙을 두 벌로
 *  두면 같은 DB 를 어디서 넣었느냐에 따라 DSN 문자열이 갈리고, 재변환 시 drop_source 가
 *  이전 소스를 못 찾아 tool 이 `_2` 로 중복된다. */
export function composeDsn(driver, hostDb, user, secret) {
  const raw = (hostDb || "").replace(/\s+/g, "");
  if (!user) return raw;
  const scheme = DB_SCHEME[driver] || driver;
  return `${scheme}://${user}:${secret || "${vault:db#password}"}@${raw}`;
}

/** AuthPicker 값 → manifest Auth. manifest 스키마엔 bearer 가 없어 header 로 매핑한다. */
export function toManifestAuth(auth) {
  if (!auth || !auth.type || auth.type === "none") return null;
  return auth.type === "bearer"
    ? { type: "header", value: `Bearer ${auth.token || ""}` }
    : auth;
}

// 빌더 row → manifest resource
export function toResource(r) {
  const res = { name: r.name, type: r.type, target: r.target };
  // 인증: 온보딩은 AuthPicker 가 만든 객체(r.auth)를, BatchMigrate 는 헤더 문자열(r.auth_value)을 준다.
  // manifest Auth 스키마엔 bearer 타입이 없으므로 bearer 는 header(Bearer <token>) 로 매핑한다.
  const mAuth = toManifestAuth(r.auth);
  if (mAuth) {
    res.auth = mAuth;
  } else if (r.auth_value) {
    res.auth = { type: "header", value: r.auth_value };
  }
  if (r.type === "openapi") {
    res.url = r.url;
    // APIM 처럼 **발견 시점에만** 읽을 수 있는 원천은 명세를 실어 보낸다. 조회에 쓴 ARM
    // 토큰은 세션 한정이라 저장하지 않고, 변환은 한참 뒤 워커에서 도므로 그때는 부를 수단이
    // 없다. url 은 남겨 둔다 — 도구를 실제로 호출할 주소로 쓰인다.
    if (r.spec) res.spec = r.spec;
  }
  if (r.type === "db") {
    res.driver = r.driver;
    // 온프렘 수동 입력(host/db + 읽기전용 계정) → DSN 합성. 비번은 ${vault:} 참조 유지.
    // 클라우드 자동발견 행은 이미 완성 DSN(dbUser 없음)이라 그대로 통과.
    res.dsn = composeDsn(r.driver, r.dsn, r.dbUser, r.dbSecret) || r.dsn;
    const tables = (r.tables || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (tables.length) res.include = { tables };
  }
  if (r.type === "code") {
    // 값이 있는 것만 싣는다 — 빈 문자열을 보내면 백엔드가 "지정됨" 으로 오해한다.
    if (r.repo_url) res.repo_url = r.repo_url;
    if (r.branch) res.branch = r.branch;
    if (r.subpath) res.subpath = r.subpath;
    if (r.token_ref) res.token_ref = r.token_ref;
    if (r.path) res.path = r.path;
    // 저장소가 제공하는 API 가 떠 있는 주소 / 그 코드가 읽는 DB. 둘 다 코드에는 없고
    // 배포 설정에 있어 사용자가 알려줘야 하는 값이다.
    if (r.url) res.base_url = r.url;
    if (r.dsn) res.dsn = composeDsn(r.driver, r.dsn, r.dbUser, r.dbSecret) || r.dsn;
  }
  if (r.type === "document") {
    res.path = r.path;
    if (r.blob_url) res.blob_url = r.blob_url;
    if (r.chunkers_url) res.chunkers_url = r.chunkers_url;
    if (r.chunkers_path) res.chunkers_path = r.chunkers_path;
  }
  if (r.type === "system") { res.kind = r.kind; res.endpoint = r.endpoint; }
  return res;
}

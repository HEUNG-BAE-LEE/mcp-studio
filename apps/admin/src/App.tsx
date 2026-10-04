import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Market from "./pages/Market";
import CatalogDetail from "./pages/CatalogDetail";
import Studio from "./pages/Studio";
import SkillManager from "./pages/SkillManager";
import SkillBuilder from "./pages/SkillBuilder";
import ProjectList from "./pages/ProjectList";
import SessionList from "./pages/SessionList";
import SessionDetail from "./pages/SessionDetail";
import ActionList from "./pages/ActionList";
import ActionEdit from "./pages/ActionEdit";
import LlmConsole from "./pages/LlmConsole";
import SourceList from "./pages/SourceList";
import EngineSessionList from "./pages/EngineSessionList";
import CrawlStatus from "./pages/CrawlStatus";
import SpecSessionDetail from "./pages/SpecSessionDetail";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* 홈은 프로젝트 하나가 아니라 "내가 가진 전부"를 보여준다.
              프로젝트 목록은 /projects 로 내린다. */}
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<ProjectList />} />
          <Route path="/market" element={<Market />} />
          <Route path="/market/:slug" element={<CatalogDetail />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/projects/:id/skills" element={<SkillManager />} />
          <Route path="/projects/:id/skills/:skillId" element={<SkillBuilder />} />
          <Route path="/projects/:id" element={<SessionList />} />
          <Route path="/projects/:id/actions" element={<ActionList />} />
          <Route path="/projects/:id/console" element={<LlmConsole />} />
          <Route path="/sources" element={<SourceList />} />
          <Route path="/engines/:kind" element={<EngineSessionList />} />
          {/* 수집은 프로젝트 안에서 시작한다. 전역 /sources 는 방식 소개만 한다 */}
          <Route path="/projects/:id/crawls" element={<CrawlStatus />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/spec-sessions/:id" element={<SpecSessionDetail />} />
          <Route path="/actions/new" element={<ActionEdit />} />
          <Route path="/actions/:id" element={<ActionEdit />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

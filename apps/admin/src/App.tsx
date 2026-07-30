import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProjectList from "./pages/ProjectList";
import SessionList from "./pages/SessionList";
import SessionDetail from "./pages/SessionDetail";
import ActionList from "./pages/ActionList";
import ActionEdit from "./pages/ActionEdit";
import LlmConsole from "./pages/LlmConsole";
import SourceList from "./pages/SourceList";
import EngineSessionList from "./pages/EngineSessionList";
import SpecSessionDetail from "./pages/SpecSessionDetail";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/projects/:id" element={<SessionList />} />
          <Route path="/projects/:id/actions" element={<ActionList />} />
          <Route path="/projects/:id/console" element={<LlmConsole />} />
          <Route path="/sources" element={<SourceList />} />
          <Route path="/engines/:kind" element={<EngineSessionList />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/spec-sessions/:id" element={<SpecSessionDetail />} />
          <Route path="/actions/new" element={<ActionEdit />} />
          <Route path="/actions/:id" element={<ActionEdit />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

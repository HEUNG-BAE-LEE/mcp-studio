import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProjectList from "./pages/ProjectList";
import SessionList from "./pages/SessionList";
import SessionDetail from "./pages/SessionDetail";
import ActionEdit from "./pages/ActionEdit";
import LlmConsole from "./pages/LlmConsole";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/projects/:id" element={<SessionList />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />
          <Route path="/actions/new" element={<ActionEdit />} />
          <Route path="/console" element={<LlmConsole />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

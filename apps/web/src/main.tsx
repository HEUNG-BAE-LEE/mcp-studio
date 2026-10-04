import '@/styles/tokens.css';
import '@/styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { parseScenario, setScenario } from './api/dummy/scenario';
import { App } from './app/App';

const container = document.getElementById('root');
if (!container) throw new Error('index.html에 #root 요소가 없습니다');

// ?mock=<시나리오>는 시작 전에 한 번 읽는다(api/dummy/scenario)
setScenario(parseScenario(window.location.search));

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

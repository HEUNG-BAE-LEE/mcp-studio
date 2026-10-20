// 진입점. ?mock= 시나리오는 개발 빌드에서만 시작 때 한 번 읽는다(api/scenario)
import '@/styles/tokens.css';
import '@/styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initScenario } from './api/scenario';
import { App } from './app/App';

const container = document.getElementById('root');
if (!container) throw new Error('index.html에 #root 요소가 없습니다');

if (import.meta.env.DEV) initScenario(window.location.search);

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

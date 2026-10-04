// apps/web/src/app/frame.tsx — 앱 프레임 DOM 노드를 화면 층(모달 · 다이얼로그)에 넘기는 컨텍스트. body에 붙이면 뷰포트 가운데라 프레임 가운데와 어긋난다
import { createContext, useContext } from 'react';

const FrameContext = createContext<HTMLElement | null>(null);
export const FrameProvider = FrameContext.Provider;
/** 층의 `container`로 넘긴다. 셸 밖은 null = body */
export const useFrameContainer = () => useContext(FrameContext);

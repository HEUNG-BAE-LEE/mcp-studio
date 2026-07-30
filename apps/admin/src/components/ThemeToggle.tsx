import { useEffect, useState } from "react";

const KEY = "mcpStudioTheme";

/**
 * 다크가 기본이고 라이트("페이퍼")는 선택이다. 토큰의 값만 갈아끼우므로
 * 컴포넌트 규칙은 한 줄도 바뀌지 않는다 (app.css 의 :root[data-theme="light"]).
 *
 * 저장은 localStorage 한 키. 첫 페인트 전에 값을 읽어야 화면이 번쩍이지 않지만,
 * 여기서는 index.html 의 인라인 스크립트가 그 일을 먼저 한다.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (document.documentElement.dataset.theme === "light" ? "light" : "dark"),
  );

  useEffect(() => {
    if (theme === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="rail-item"
      title={next === "light" ? "밝은 화면으로" : "어두운 화면으로"}
      aria-label={next === "light" ? "밝은 화면으로" : "어두운 화면으로"}
      onClick={() => setTheme(next)}
    >
      {theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="10" cy="10" r="3.4" />
          <path d="M10 2.6v2M10 15.4v2M2.6 10h2M15.4 10h2M4.8 4.8l1.4 1.4M13.8 13.8l1.4 1.4M15.2 4.8l-1.4 1.4M6.2 13.8l-1.4 1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M16.2 12.4A6.8 6.8 0 0 1 7.6 3.8a6.8 6.8 0 1 0 8.6 8.6z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

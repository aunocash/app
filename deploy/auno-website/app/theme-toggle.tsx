"use client";

import { FiMoon, FiSun } from "react-icons/fi";
import { setAunoTheme, useAunoTheme, type Theme } from "./theme";

export function ThemeToggle() {
  const theme = useAunoTheme();
  const nextTheme: Theme = theme === "dark" ? "light" : "dark";

  return <button className="theme-toggle" type="button" aria-label={`Switch to ${nextTheme} theme`} title={`Switch to ${nextTheme} theme`} onClick={() => setAunoTheme(nextTheme)}>
    {theme === "dark" ? <FiSun aria-hidden="true" /> : <FiMoon aria-hidden="true" />}
  </button>;
}

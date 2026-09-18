"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const storageKey = "auno-theme";

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function useAunoTheme() {
  return useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);
}

export function setAunoTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);
  localStorage.setItem(storageKey, theme);
}

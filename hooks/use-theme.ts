"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type SocTheme = "dark" | "light";

const STORAGE_KEY = "soc-theme";
const listeners = new Set<() => void>();
let memoryTheme: SocTheme | null = null;

function readStoredTheme(): SocTheme | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return memoryTheme;
  } catch {
    return memoryTheme;
  }
}

function systemTheme(): SocTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function getSnapshot(): SocTheme {
  return readStoredTheme() ?? systemTheme();
}

function getServerSnapshot(): SocTheme {
  return "dark";
}

function applyTheme(theme: SocTheme) {
  document.documentElement.setAttribute("data-soc-theme", theme);
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: light)");
  const onMediaChange = () => {
    if (!readStoredTheme()) listener();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  media.addEventListener("change", onMediaChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onMediaChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next: SocTheme = getSnapshot() === "dark" ? "light" : "dark";
    memoryTheme = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The in-memory fallback still drives this session.
    }
    emit();
  }, []);

  return { theme, toggleTheme };
}

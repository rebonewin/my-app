"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "soc-sidebar-collapsed";
const listeners = new Set<() => void>();
let memoryCollapsed = false;

function readCollapsed(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return memoryCollapsed;
    return stored === "1";
  } catch {
    return memoryCollapsed;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) listener();
  }
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Persists the desktop sidebar width. `useSyncExternalStore` keeps the
 * server-rendered markup stable (expanded) and applies the saved preference
 * after hydration without a cascading effect.
 */
export function useSidebar() {
  const collapsed = useSyncExternalStore(
    subscribe,
    readCollapsed,
    () => false,
  );

  const toggleCollapsed = useCallback(() => {
    const next = !readCollapsed();
    memoryCollapsed = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // The in-memory fallback still drives this session.
    }
    emit();
  }, []);

  return { collapsed, toggleCollapsed };
}

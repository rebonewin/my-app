"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SearchIcon } from "@/components/ui/icons";
import {
  SOC_NAV_SECTIONS,
  type SocNavItem,
} from "@/lib/soc/navigation";
import { cn } from "@/lib/utils";
import { SocNavIcon } from "./SocNavIcon";

interface CommandResult {
  item: SocNavItem;
  section: string;
}

const ALL_RESULTS: CommandResult[] = SOC_NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({ item, section: section.label })),
);

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ALL_RESULTS;
    return ALL_RESULTS.filter(({ item, section }) =>
      [item.label, item.description, section]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [query]);

  if (!open) return null;

  const safeIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));

  function select(result: CommandResult | undefined) {
    if (!result) return;
    onClose();
    router.push(result.item.href);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="SOC command menu"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-soc-border bg-soc-elevated-2 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex(results.length ? (safeIndex + 1) % results.length : 0);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex(
              results.length
                ? (safeIndex - 1 + results.length) % results.length
                : 0,
            );
          }
          if (event.key === "Enter") {
            event.preventDefault();
            select(results[safeIndex]);
          }
        }}
      >
        <div className="flex items-center gap-3 border-b border-soc-border px-4 py-3.5">
          <SearchIcon size={17} className="text-soc-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search modules, findings and actions…"
            aria-label="Search the SOC"
            className="h-7 min-w-0 flex-1 bg-transparent text-sm text-soc-fg outline-none placeholder:text-soc-faint"
          />
          <kbd className="rounded-md border border-soc-border bg-soc-hover px-1.5 py-0.5 text-[10px] text-soc-faint">
            esc
          </kbd>
        </div>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-soc-muted">
              No module matches “{query}”.
            </p>
          ) : (
            <ul className="space-y-0.5" role="listbox" aria-label="Results">
              {results.map((result, index) => (
                <li key={result.item.href}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === safeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => select(result)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                      index === safeIndex
                        ? "bg-soc-accent-soft text-soc-fg"
                        : "text-soc-muted hover:bg-soc-hover hover:text-soc-fg",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        index === safeIndex
                          ? "bg-soc-accent/15 text-soc-accent"
                          : "bg-soc-hover text-soc-faint",
                      )}
                    >
                      <SocNavIcon name={result.item.icon} size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">
                        {result.item.label}
                      </span>
                      <span className="block truncate text-[10px] text-soc-faint">
                        {result.item.description}
                      </span>
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
                      {result.section}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-soc-border px-4 py-2 text-[10px] text-soc-faint">
          <span>Navigate with ↑ ↓ · open with ↵</span>
          <span>1Security SOC</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const label = `Switch to ${theme === "dark" ? "light" : "dark"} theme`;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center rounded-xl border border-soc-border bg-soc-elevated text-soc-muted outline-none transition hover:border-soc-border-strong hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-soc-bg",
        className,
      )}
    >
      {theme === "light" ? (
        <MoonIcon size={16} />
      ) : (
        <SunIcon size={16} />
      )}
    </button>
  );
}

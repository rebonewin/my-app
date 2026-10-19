"use client";

import { cn } from "@/lib/utils";

/**
 * Accessible switch. The real input stays in the DOM (with `sr-only`) so
 * keyboard focus, form submission and screen readers all behave natively.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  id,
  name,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  id?: string;
  name?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex items-center gap-3",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input
          id={id}
          name={name}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          className={cn(
            "h-6 w-11 rounded-full border transition-colors duration-200",
            checked
              ? "border-cyan-400/50 bg-cyan-400/30"
              : "border-white/10 bg-white/[0.08]",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-400/60",
          )}
        />
        <span
          className={cn(
            "pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </span>
      {label ? <span className="text-sm text-slate-300">{label}</span> : null}
    </label>
  );
}

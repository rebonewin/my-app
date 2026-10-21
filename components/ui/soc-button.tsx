import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type SocButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type SocButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<SocButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-soc-accent to-soc-blue text-soc-accent-contrast font-semibold shadow-[0_10px_30px_-12px_var(--soc-accent-glow)] hover:brightness-110",
  secondary:
    "border border-soc-border bg-soc-elevated text-soc-fg hover:bg-soc-hover hover:border-soc-border-strong",
  ghost: "text-soc-muted hover:bg-soc-hover hover:text-soc-fg",
  outline:
    "border border-soc-accent/40 text-soc-accent hover:border-soc-accent/70 hover:bg-soc-accent-soft",
  danger:
    "border border-soc-critical/30 bg-soc-critical-soft text-soc-critical hover:border-soc-critical/50",
};

const sizes: Record<SocButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-11 gap-2 rounded-xl px-5 text-sm",
  icon: "h-9 w-9 rounded-lg",
};

const base =
  "inline-flex items-center justify-center whitespace-nowrap outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-soc-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-soc-bg disabled:pointer-events-none disabled:opacity-50";

export function SocButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: SocButtonVariant;
  size?: SocButtonSize;
}) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function SocLink({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
  target,
  rel,
  ariaLabel,
}: {
  href: string;
  variant?: SocButtonVariant;
  size?: SocButtonSize;
  className?: string;
  children: React.ReactNode;
  target?: string;
  rel?: string;
  ariaLabel?: string;
}) {
  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      aria-label={ariaLabel}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {children}
    </Link>
  );
}

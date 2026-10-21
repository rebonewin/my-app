"use client";

import Link from "next/link";

import { AlertIcon } from "@/components/ui/icons";
import { SocCard } from "@/components/ui/soc";
import { SocButton } from "@/components/ui/soc-button";

export function SocErrorState({
  title,
  description,
  reset,
  digest,
}: {
  title: string;
  description: string;
  reset: () => void;
  digest?: string;
}) {
  return (
    <SocCard
      role="alert"
      className="mx-auto flex max-w-xl flex-col items-center px-6 py-12 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-soc-critical-soft text-soc-critical">
        <AlertIcon size={22} />
      </span>
      <h1 className="mt-4 text-lg font-semibold tracking-tight text-soc-fg">
        {title}
      </h1>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-soc-muted">
        {description}
      </p>
      {digest ? (
        <p className="mt-2 text-[9px] uppercase tracking-[0.14em] text-soc-faint">
          Reference {digest}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
        <SocButton type="button" variant="primary" size="md" onClick={reset}>
          Try again
        </SocButton>
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center rounded-xl border border-soc-border bg-soc-elevated px-4 text-sm text-soc-fg outline-none transition hover:bg-soc-hover focus-visible:ring-2 focus-visible:ring-soc-accent/60"
        >
          Back to dashboard
        </Link>
      </div>
    </SocCard>
  );
}

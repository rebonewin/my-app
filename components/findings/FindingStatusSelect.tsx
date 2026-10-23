"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { FINDING_STATUSES, type FindingStatus } from "@/types/findings";
import { FINDING_STATUS_META } from "@/lib/soc/findings";

export function FindingStatusSelect({
  findingId,
  initialStatus,
  disabled,
}: {
  findingId: string;
  initialStatus: FindingStatus;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<FindingStatus>(initialStatus);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function change(next: FindingStatus) {
    const previous = status;
    setStatus(next);
    setPending(true);
    setError(false);

    try {
      const response = await fetch(`/api/findings/${findingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        setStatus(previous);
        setError(true);
        return;
      }
      router.refresh();
    } catch {
      setStatus(previous);
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <label htmlFor={`finding-status-${findingId}`} className="sr-only">
        Update finding status
      </label>
      <select
        id={`finding-status-${findingId}`}
        value={status}
        disabled={disabled || pending}
        onChange={(event) => change(event.target.value as FindingStatus)}
        aria-invalid={error || undefined}
        className="h-8 min-w-30 rounded-lg border border-soc-border bg-soc-elevated px-2 text-[10px] font-medium text-soc-fg outline-none transition focus-visible:ring-2 focus-visible:ring-soc-accent/60 disabled:opacity-60"
        title={FINDING_STATUS_META[status].label}
      >
        {FINDING_STATUSES.map((value) => (
          <option key={value} value={value}>
            {FINDING_STATUS_META[value].label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1 text-[9px] text-soc-critical" role="status">
          Update failed
        </p>
      ) : null}
    </div>
  );
}

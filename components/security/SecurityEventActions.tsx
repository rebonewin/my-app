"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckIcon, XIcon } from "@/components/ui/icons";

export function SecurityEventActions({
  eventId,
  status,
  canResolve,
  canDismiss,
}: {
  eventId: string;
  status: string;
  canResolve: boolean;
  canDismiss: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(next: "open" | "resolved" | "dismissed") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/security/events", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: eventId, status: next }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error ?? "Could not update the event.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return <p className="text-[10px] text-red-400">{error}</p>;
  }

  if (status !== "open") {
    return canResolve ? (
      <Button
        size="sm"
        variant="ghost"
        disabled={busy || pending}
        onClick={() => update("open")}
      >
        Reopen
      </Button>
    ) : null;
  }

  return (
    <div className="flex items-center gap-1.5">
      {canResolve ? (
        <Button
          size="sm"
          variant="secondary"
          loading={busy || pending}
          onClick={() => update("resolved")}
        >
          <CheckIcon size={13} />
          Resolve
        </Button>
      ) : null}
      {canDismiss ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || pending}
          onClick={() => update("dismissed")}
          aria-label="Dismiss event"
        >
          <XIcon size={13} />
        </Button>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { MonitorIcon, SmartphoneIcon, TrashIcon } from "@/components/ui/icons";
import { formatDate, relativeTime } from "@/lib/utils";

export interface SessionRow {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  deviceId: string | null;
  impersonatedBy: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  city: string | null;
  country: string | null;
}

export function SessionsManager({
  sessions,
  currentSessionId,
  canRevoke,
  canRevokeAll,
}: {
  sessions: SessionRow[];
  currentSessionId: string;
  canRevoke: boolean;
  canRevokeAll: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke(id: string) {
    if (!confirm("Terminate this session? The device will need to sign in again.")) {
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Could not revoke the session.");
        return;
      }
      if (payload?.signedOut) {
        router.push("/sign-in");
        router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  async function revokeAll() {
    if (
      !confirm(
        "Terminate every other session? All other devices will be signed out immediately.",
      )
    ) {
      return;
    }
    setRevokingAll(true);
    setError(null);
    try {
      const response = await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true, keepCurrent: true }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Could not revoke sessions.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setRevokingAll(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {canRevokeAll && sessions.length > 1 ? (
        <div className="flex justify-end">
          <Button
            variant="danger"
            size="sm"
            loading={revokingAll}
            onClick={revokeAll}
          >
            <TrashIcon size={13} />
            Revoke all other sessions
          </Button>
        </div>
      ) : null}

      <ul className="space-y-3">
        {sessions.map((session) => {
          const current = session.id === currentSessionId;
          const isMobile =
            session.deviceType === "mobile" || session.deviceType === "tablet";

          return (
            <li
              key={session.id}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">
                    {isMobile ? (
                      <SmartphoneIcon size={18} />
                    ) : (
                      <MonitorIcon size={18} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-white">
                        {session.browser ?? "Unknown browser"}
                        {session.os ? ` on ${session.os}` : ""}
                      </p>
                      {current ? (
                        <Badge tone="green">This device</Badge>
                      ) : null}
                      {session.impersonatedBy ? (
                        <Badge tone="violet">Impersonated</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-mono">
                        {session.ipAddress ?? "unknown IP"}
                      </span>
                      <span>·</span>
                      <span>
                        {[session.city, session.country]
                          .filter(Boolean)
                          .join(", ") || "Unknown location"}
                      </span>
                      {session.deviceId ? (
                        <>
                          <span>·</span>
                          <span>device bound</span>
                        </>
                      ) : null}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-600">
                      Started {formatDate(session.createdAt)} · last active{" "}
                      {relativeTime(session.lastActiveAt)} · expires{" "}
                      {formatDate(session.expiresAt)}
                    </p>
                  </div>
                </div>

                {canRevoke ? (
                  <Button
                    variant={current ? "danger" : "secondary"}
                    size="sm"
                    loading={busyId === session.id}
                    disabled={busyId !== null || revokingAll}
                    onClick={() => revoke(session.id)}
                    className="shrink-0"
                  >
                    <TrashIcon size={13} />
                    {current ? "Sign out" : "Revoke"}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CheckIcon,
  MonitorIcon,
  SmartphoneIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { formatDate, relativeTime } from "@/lib/utils";

export interface DeviceRow {
  id: string;
  name: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  trusted: boolean;
  trustedUntil: string | null;
  lastIp: string | null;
  lastCountry: string | null;
  lastCity: string | null;
  lastSeenAt: string;
  createdAt: string;
  sessionCount: number;
}

export function DevicesManager({
  devices,
  canManage,
}: {
  devices: DeviceRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function mutate(id: string, body: Record<string, unknown>, method = "PATCH") {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch("/api/devices", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Could not update the device.");
        return;
      }
      setRenamingId(null);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <ul className="space-y-3">
        {devices.map((device) => {
          const mobile =
            device.deviceType === "mobile" || device.deviceType === "tablet";

          return (
            <li
              key={device.id}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300">
                    {mobile ? <SmartphoneIcon size={18} /> : <MonitorIcon size={18} />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-white">
                        {device.name ?? "Unnamed device"}
                      </p>
                      {device.trusted ? (
                        <Badge tone="green">
                          <CheckIcon size={10} /> Trusted
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Untrusted</Badge>
                      )}
                      <Badge tone="cyan">
                        {device.sessionCount} active session
                        {device.sessionCount === 1 ? "" : "s"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {device.browser ?? "Unknown browser"}
                      {device.os ? ` · ${device.os}` : ""}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
                      <span className="font-mono">{device.lastIp ?? "unknown IP"}</span>
                      <span>·</span>
                      <span>
                        {[device.lastCity, device.lastCountry]
                          .filter(Boolean)
                          .join(", ") || "Unknown location"}
                      </span>
                      <span>·</span>
                      <span>seen {relativeTime(device.lastSeenAt)}</span>
                      <span>·</span>
                      <span>first seen {formatDate(device.createdAt)}</span>
                    </p>
                    {device.trustedUntil ? (
                      <p className="mt-1 text-[10px] text-emerald-400/70">
                        Trust expires {formatDate(device.trustedUntil)}
                      </p>
                    ) : null}
                  </div>
                </div>

                {canManage ? (
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {renamingId === device.id ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (renameValue.trim()) {
                            void mutate(device.id, { name: renameValue.trim() });
                          }
                        }}
                        className="flex items-center gap-1.5"
                      >
                        <Input
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          className="h-8 w-36 text-xs"
                          maxLength={80}
                          autoFocus
                          placeholder="Device name"
                        />
                        <Button size="sm" type="submit" loading={busyId === device.id}>
                          Save
                        </Button>
                      </form>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId !== null}
                        onClick={() => {
                          setRenamingId(device.id);
                          setRenameValue(device.name ?? "");
                        }}
                      >
                        Rename
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={device.trusted ? "secondary" : "outline"}
                      disabled={busyId !== null}
                      onClick={() =>
                        mutate(device.id, { trusted: !device.trusted })
                      }
                    >
                      {device.trusted ? "Untrust" : "Trust"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={busyId === device.id}
                      disabled={busyId !== null}
                      onClick={() => {
                        if (
                          confirm(
                            "Revoke this device? Every session bound to it is terminated immediately.",
                          )
                        ) {
                          void mutate(device.id, {}, "DELETE");
                        }
                      }}
                    >
                      <TrashIcon size={13} />
                      Revoke
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

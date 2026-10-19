"use client";

import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { CopyIcon, KeyIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { formatDate, isPast, relativeTime } from "@/lib/utils";

interface ApiKeyRow {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  enabled: boolean | null;
  expiresAt: Date | string | null;
  createdAt: Date | string;
  lastRequest: Date | string | null;
  requestCount: number | null;
  remaining: number | null;
  rateLimitEnabled: boolean | null;
  permissions: Record<string, string[]> | null;
}

export function ApiKeysPanel({
  canCreate,
  canRevoke,
}: {
  canCreate: boolean;
  canRevoke: boolean;
}) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [expiresIn, setExpiresIn] = useState("90");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: listError } = await authClient.apiKey.list();
    setLoading(false);
    if (listError) {
      setError(listError.message ?? "Could not load API keys.");
      return;
    }
    setKeys(((data as { apiKeys?: ApiKeyRow[] } | null)?.apiKeys ?? []) as ApiKeyRow[]);
  }, []);

  useEffect(() => {
    let cancelled = false;

    authClient.apiKey
      .list()
      .then(({ data, error: listError }) => {
        if (cancelled) return;

        if (listError) {
          setError(listError.message ?? "Could not load API keys.");
          setLoading(false);
          return;
        }

        setKeys(
          ((data as { apiKeys?: ApiKeyRow[] } | null)?.apiKeys ??
            []) as ApiKeyRow[],
        );
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load API keys.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function createKey(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    setNewKey(null);

    const { data, error: createError } = await authClient.apiKey.create({
      name: name.trim(),
      // The plugin expects seconds; the select is in days.
      expiresIn: Number(expiresIn) * 86_400,
    });

    setCreating(false);

    if (createError) {
      setError(createError.message ?? "Could not create the key.");
      return;
    }

    const created = data as { key?: string } | null;
    if (created?.key) setNewKey(created.key);
    setName("");
    await load();
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this API key? Requests using it will fail immediately.")) {
      return;
    }
    setBusyId(id);
    setError(null);
    const { error: deleteError } = await authClient.apiKey.delete({ keyId: id });
    setBusyId(null);
    if (deleteError) {
      setError(deleteError.message ?? "Could not revoke the key.");
      return;
    }
    await load();
  }

  async function toggle(id: string, enabled: boolean) {
    setBusyId(id);
    setError(null);
    const { error: updateError } = await authClient.apiKey.update({
      keyId: id,
      enabled,
    });
    setBusyId(null);
    if (updateError) {
      setError(updateError.message ?? "Could not update the key.");
      return;
    }
    await load();
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      setError("Clipboard access was blocked by the browser.");
    }
  }

  return (
    <div className="space-y-5">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {newKey ? (
        <Alert tone="success" title="Copy your key now">
          <p className="mb-2">
            This is the only time the full key is shown. It is stored hashed.
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-emerald-400/20 bg-black/40 px-3 py-2 font-mono text-[11px] text-emerald-200">
              {newKey}
            </code>
            <Button size="sm" variant="secondary" onClick={() => copy(newKey)}>
              <CopyIcon size={13} />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </Alert>
      ) : null}

      {canCreate ? (
        <Card>
          <CardHeader
            title="Create an API key"
            description="Keys inherit your role's scopes at creation time and can never exceed them."
          />
          <CardBody>
            <form
              onSubmit={createKey}
              className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
            >
              <Field label="Key name" htmlFor="key-name" required>
                <Input
                  id="key-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="CI scanner"
                  maxLength={64}
                  required
                />
              </Field>
              <Field label="Expires in" htmlFor="key-expiry">
                <Select
                  id="key-expiry"
                  value={expiresIn}
                  onChange={(event) => setExpiresIn(event.target.value)}
                >
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">1 year</option>
                </Select>
              </Field>
              <Button type="submit" loading={creating} className="h-11">
                <PlusIcon size={15} />
                Create key
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Your API keys"
          description="Use `Authorization: Bearer <key>` or `x-api-key` on supported endpoints."
        />
        <CardBody className="p-0">
          {loading ? (
            <div className="space-y-2 p-5">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-xl bg-white/[0.03]"
                />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <EmptyState
              icon={<KeyIcon size={20} />}
              title="No API keys"
              description="Create a scoped key to call the scanner from CI or a SOAR playbook."
            />
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {keys.map((key) => {
                const expired = isPast(key.expiresAt);

                return (
                  <li key={key.id} className="px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-white">
                            {key.name ?? "Unnamed key"}
                          </p>
                          <Badge tone={expired ? "red" : key.enabled === false ? "amber" : "green"}>
                            {expired
                              ? "expired"
                              : key.enabled === false
                                ? "disabled"
                                : "active"}
                          </Badge>
                          {key.rateLimitEnabled ? (
                            <Badge tone="neutral">rate limited</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-slate-500">
                          {key.prefix ?? "1sec_"}
                          {key.start ?? "••••"}••••••••
                        </p>
                        <p className="mt-1 text-[10px] text-slate-600">
                          Created {formatDate(key.createdAt)} · expires{" "}
                          {key.expiresAt ? formatDate(key.expiresAt) : "never"} ·
                          last used{" "}
                          {key.lastRequest ? relativeTime(key.lastRequest) : "never"} ·{" "}
                          {key.requestCount ?? 0} requests
                        </p>
                        {key.permissions ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {Object.entries(key.permissions)
                              .slice(0, 8)
                              .map(([resource, actions]) => (
                                <span
                                  key={resource}
                                  className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-slate-400"
                                >
                                  {resource}:{Array.isArray(actions) ? actions.join(",") : "*"}
                                </span>
                              ))}
                          </div>
                        ) : null}
                      </div>

                      {canRevoke ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId !== null}
                            onClick={() => toggle(key.id, key.enabled === false)}
                          >
                            {key.enabled === false ? "Enable" : "Disable"}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            loading={busyId === key.id}
                            disabled={busyId !== null}
                            onClick={() => revoke(key.id)}
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
          )}
        </CardBody>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { TrashIcon } from "@/components/ui/icons";
import { SocButton } from "@/components/ui/soc-button";
import {
  SocBadge,
  SocCard,
  SocCardBody,
  SocCardHeader,
} from "@/components/ui/soc";
import { cn } from "@/lib/utils";
import {
  SCAN_MODULES,
  SCAN_MODULE_LABELS,
  type ScanModule,
  type ScanProfileSummary,
} from "@/types/scanner";

const fieldClass =
  "h-10 w-full rounded-xl border border-soc-border bg-soc-elevated px-3 text-xs text-soc-fg outline-none transition placeholder:text-soc-faint focus-visible:border-soc-accent/50 focus-visible:ring-2 focus-visible:ring-soc-accent/50";

export function ScanProfileManager({
  profiles,
  canManage,
}: {
  profiles: ScanProfileSummary[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [modules, setModules] = useState<ScanModule[]>(["http", "headers"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = profiles.find((profile) => profile.id === editingId) ?? null;

  function reset() {
    setEditingId(null);
    setName("");
    setDescription("");
    setModules(["http", "headers"]);
    setError(null);
  }

  function startEdit(profile: ScanProfileSummary) {
    setEditingId(profile.id);
    setName(profile.name);
    setDescription(profile.description);
    setModules(profile.modules);
    setError(null);
  }

  function toggleModule(module: ScanModule) {
    setModules((current) =>
      current.includes(module)
        ? current.filter((value) => value !== module)
        : [...current, module],
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || saving) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        editing ? `/api/scan-profiles/${editing.id}` : "/api/scan-profiles",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            modules,
          }),
        },
      );
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        setError(data?.error ?? "The profile could not be saved.");
        return;
      }
      reset();
      router.refresh();
    } catch {
      setError("Network error while saving the profile.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(profile: ScanProfileSummary) {
    if (!canManage || profile.isSystem) return;
    if (!window.confirm(`Delete the custom profile ${profile.name}?`)) return;
    setError(null);
    try {
      const response = await fetch(`/api/scan-profiles/${profile.id}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        setError(data?.error ?? "The profile could not be deleted.");
        return;
      }
      if (editingId === profile.id) reset();
      router.refresh();
    } catch {
      setError("Network error while deleting the profile.");
    }
  }

  return (
    <div className="space-y-5">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] xl:items-start">
        <SocCard className="overflow-hidden">
          <SocCardHeader
            title="Reusable profiles"
            description="Built-in profiles are maintained with the scanner. Custom profiles are scoped to your workspace."
          />
          <SocCardBody className="space-y-3">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="rounded-xl border border-soc-border bg-soc-elevated/40 p-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11.5px] font-semibold text-soc-fg">
                        {profile.name}
                      </p>
                      <SocBadge tone={profile.isSystem ? "accent" : "violet"}>
                        {profile.isSystem ? "Built-in" : "Custom"}
                      </SocBadge>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-soc-muted">
                      {profile.description}
                    </p>
                  </div>
                  {!profile.isSystem && canManage ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(profile)}
                        className="rounded-lg px-2 py-1 text-[9px] font-medium text-soc-accent outline-none hover:bg-soc-hover focus-visible:ring-2 focus-visible:ring-soc-accent/60"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(profile)}
                        className="rounded-lg p-1.5 text-soc-faint outline-none hover:bg-soc-critical-soft hover:text-soc-critical focus-visible:ring-2 focus-visible:ring-soc-critical/60"
                        aria-label={`Delete ${profile.name}`}
                      >
                        <TrashIcon size={12} />
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {profile.modules.map((module) => (
                    <span
                      key={module}
                      className="rounded-md bg-soc-hover px-1.5 py-1 text-[8px] font-medium uppercase tracking-[0.08em] text-soc-muted"
                    >
                      {SCAN_MODULE_LABELS[module]}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </SocCardBody>
        </SocCard>

        <SocCard className="overflow-hidden">
          <SocCardHeader
            title={editing ? `Edit ${editing.name}` : "New custom profile"}
            description="Select the passive modules the profile should execute."
          />
          <SocCardBody>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label
                  htmlFor="profile-name"
                  className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-soc-faint"
                >
                  Profile name
                </label>
                <input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Quarterly edge review"
                  className={fieldClass}
                  disabled={!canManage}
                />
              </div>
              <div>
                <label
                  htmlFor="profile-description"
                  className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-soc-faint"
                >
                  Description
                </label>
                <textarea
                  id="profile-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="What this profile is used for."
                  className="w-full rounded-xl border border-soc-border bg-soc-elevated px-3 py-2.5 text-xs text-soc-fg outline-none transition placeholder:text-soc-faint focus-visible:border-soc-accent/50 focus-visible:ring-2 focus-visible:ring-soc-accent/50"
                  disabled={!canManage}
                />
              </div>
              <fieldset>
                <legend className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-soc-faint">
                  Modules
                </legend>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {SCAN_MODULES.map((module) => (
                    <label
                      key={module}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-[10px] transition",
                        modules.includes(module)
                          ? "border-soc-accent/30 bg-soc-accent-soft text-soc-accent"
                          : "border-soc-border text-soc-muted hover:bg-soc-hover",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={modules.includes(module)}
                        onChange={() => toggleModule(module)}
                        className="h-3.5 w-3.5 rounded border-soc-border accent-[var(--soc-accent)]"
                        disabled={!canManage}
                      />
                      {SCAN_MODULE_LABELS[module]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex gap-2 border-t border-soc-border pt-3">
                {editing ? (
                  <SocButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={reset}
                    disabled={saving}
                  >
                    Cancel
                  </SocButton>
                ) : null}
                <SocButton
                  type="submit"
                  size="sm"
                  disabled={!canManage || saving || modules.length === 0}
                >
                  {saving ? "Saving…" : editing ? "Save profile" : "Create profile"}
                </SocButton>
              </div>
            </form>
          </SocCardBody>
        </SocCard>
      </div>
    </div>
  );
}

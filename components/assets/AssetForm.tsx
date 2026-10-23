"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { SocButton } from "@/components/ui/soc-button";
import { SocCard, SocCardBody, SocCardHeader } from "@/components/ui/soc";
import {
  ASSET_CRITICALITIES,
  ASSET_ENVIRONMENTS,
  ASSET_TYPES,
  type AssetRecord,
} from "@/types/assets";
import {
  ASSET_ENVIRONMENT_LABELS,
  ASSET_TYPE_LABELS,
} from "@/lib/soc/assets";
import { titleCase } from "@/lib/utils";

const fieldClass =
  "h-10 w-full rounded-xl border border-soc-border bg-soc-elevated px-3 text-xs text-soc-fg outline-none transition placeholder:text-soc-faint focus-visible:border-soc-accent/50 focus-visible:ring-2 focus-visible:ring-soc-accent/50";
const labelClass =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-soc-faint";

export function AssetForm({ asset }: { asset?: AssetRecord }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(asset?.name ?? "");
  const [targetUrl, setTargetUrl] = useState(asset?.targetUrl ?? "");
  const [type, setType] = useState(asset?.type ?? "website");
  const [environment, setEnvironment] = useState(
    asset?.environment ?? "production",
  );
  const [criticality, setCriticality] = useState(
    asset?.criticality ?? "medium",
  );
  const [owner, setOwner] = useState(asset?.owner ?? "");
  const [tags, setTags] = useState(asset?.tags.join(", ") ?? "");
  const [description, setDescription] = useState(asset?.description ?? "");
  const [status, setStatus] = useState(asset?.status ?? "active");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);

    const payload = {
      name,
      targetUrl,
      type,
      environment,
      criticality,
      owner: owner.trim() || null,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      description: description.trim() || null,
      status,
    };

    try {
      const response = await fetch(
        asset ? `/api/assets/${asset.id}` : "/api/assets",
        {
          method: asset ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json().catch(() => null)) as
        | { asset?: AssetRecord; error?: string }
        | null;

      if (!response.ok || !data?.asset) {
        setError(data?.error ?? "The asset could not be saved.");
        return;
      }

      router.push(`/assets/${data.asset.id}`);
      router.refresh();
    } catch {
      setError("Network error while saving the asset.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <SocCard className="overflow-hidden">
        <SocCardHeader
          title={asset ? "Edit asset" : "Register an asset"}
          description="Use the canonical target URL. The scanner resolves the domain and IP when the asset is saved."
        />
        <SocCardBody className="space-y-5">
          {error ? <Alert tone="error">{error}</Alert> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="asset-name" className={labelClass}>
                Asset name
              </label>
              <input
                id="asset-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={160}
                placeholder="Customer portal"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="asset-target" className={labelClass}>
                Target URL
              </label>
              <input
                id="asset-target"
                value={targetUrl}
                onChange={(event) => setTargetUrl(event.target.value)}
                required
                inputMode="url"
                placeholder="https://app.example.com"
                className={fieldClass}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="asset-type" className={labelClass}>
                Asset type
              </label>
              <select
                id="asset-type"
                value={type}
                onChange={(event) =>
                  setType(event.target.value as typeof type)
                }
                className={fieldClass}
              >
                {ASSET_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {ASSET_TYPE_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="asset-environment" className={labelClass}>
                Environment
              </label>
              <select
                id="asset-environment"
                value={environment}
                onChange={(event) =>
                  setEnvironment(event.target.value as typeof environment)
                }
                className={fieldClass}
              >
                {ASSET_ENVIRONMENTS.map((value) => (
                  <option key={value} value={value}>
                    {ASSET_ENVIRONMENT_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="asset-criticality" className={labelClass}>
                Business criticality
              </label>
              <select
                id="asset-criticality"
                value={criticality}
                onChange={(event) =>
                  setCriticality(event.target.value as typeof criticality)
                }
                className={fieldClass}
              >
                {ASSET_CRITICALITIES.map((value) => (
                  <option key={value} value={value}>
                    {titleCase(value)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="asset-owner" className={labelClass}>
                Owner
              </label>
              <input
                id="asset-owner"
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                placeholder="security-team@example.com"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="asset-tags" className={labelClass}>
                Tags
              </label>
              <input
                id="asset-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="customer-facing, pci, tier-1"
                className={fieldClass}
              />
              <p className="mt-1.5 text-[9px] text-soc-faint">
                Separate tags with commas.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="asset-description" className={labelClass}>
              Description
            </label>
            <textarea
              id="asset-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="What the asset does, its data classification and who owns it."
              className="w-full rounded-xl border border-soc-border bg-soc-elevated px-3 py-2.5 text-xs leading-relaxed text-soc-fg outline-none transition placeholder:text-soc-faint focus-visible:border-soc-accent/50 focus-visible:ring-2 focus-visible:ring-soc-accent/50"
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-soc-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2.5 text-xs text-soc-muted">
              <input
                type="checkbox"
                checked={status === "active"}
                onChange={(event) =>
                  setStatus(event.target.checked ? "active" : "disabled")
                }
                className="h-4 w-4 rounded border-soc-border accent-[var(--soc-accent)]"
              />
              Asset is active and can be scanned
            </label>
            <div className="flex gap-2">
              <SocButton
                type="button"
                variant="secondary"
                onClick={() => router.back()}
                disabled={saving}
              >
                Cancel
              </SocButton>
              <SocButton type="submit" disabled={saving}>
                {saving ? "Saving…" : asset ? "Save changes" : "Register asset"}
              </SocButton>
            </div>
          </div>
        </SocCardBody>
      </SocCard>
    </form>
  );
}

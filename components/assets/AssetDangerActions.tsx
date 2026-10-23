"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { TrashIcon } from "@/components/ui/icons";
import { SocButton } from "@/components/ui/soc-button";

export function AssetDangerActions({
  assetId,
  assetName,
}: {
  assetId: string;
  assetName: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (deleting) return;
    const confirmed = window.confirm(
      `Delete ${assetName}? Scan history is retained, but the asset and its current findings will be removed.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        setError(data?.error ?? "The asset could not be deleted.");
        return;
      }
      router.push("/assets");
      router.refresh();
    } catch {
      setError("Network error while deleting the asset.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="text-right">
      <SocButton
        type="button"
        variant="danger"
        size="sm"
        onClick={remove}
        disabled={deleting}
      >
        <TrashIcon size={13} />
        {deleting ? "Deleting…" : "Delete asset"}
      </SocButton>
      {error ? <p className="mt-1.5 text-[9px] text-soc-critical">{error}</p> : null}
    </div>
  );
}

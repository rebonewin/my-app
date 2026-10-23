import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssetForm } from "@/components/assets/AssetForm";
import { requirePermission } from "@/lib/auth/server";
import { tenantScope } from "@/lib/tenancy";
import { getAsset } from "@/services/assets";

export const instant = false;

export const metadata: Metadata = {
  title: "Edit asset",
  description: "Update asset metadata and scan scope.",
};

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("scanner:start");
  const { id } = await params;
  const asset = await getAsset(tenantScope(context), id);
  if (!asset) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href={`/assets/${asset.id}`}
          className="text-[10px] font-medium text-soc-accent outline-none hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
        >
          ← {asset.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-soc-fg sm:text-3xl">
          Edit asset
        </h1>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-soc-muted">
          Changes to the target URL are reflected in the next assessment. Scan
          history remains attached to this asset.
        </p>
      </div>
      <AssetForm asset={asset} />
    </div>
  );
}

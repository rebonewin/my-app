import type { Metadata } from "next";
import Link from "next/link";

import { AssetForm } from "@/components/assets/AssetForm";
import { requirePermission } from "@/lib/auth/server";

export const instant = false;

export const metadata: Metadata = {
  title: "Register asset",
  description: "Add a website, API or service to the security inventory.",
};

export default async function NewAssetPage() {
  await requirePermission("scanner:start", { next: "/assets/new" });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href="/assets"
          className="text-[10px] font-medium text-soc-accent outline-none hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
        >
          ← Asset inventory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-soc-fg sm:text-3xl">
          Register an asset
        </h1>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-soc-muted">
          Asset metadata drives prioritisation, scan scope and the security
          dashboard. Target URLs must be public for active assessments.
        </p>
      </div>
      <AssetForm />
    </div>
  );
}

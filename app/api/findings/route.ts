import { NextResponse } from "next/server";

import { guard } from "@/lib/api/guard";
import { tenantScope } from "@/lib/tenancy";
import { getFindingsPageData } from "@/services/findings";
import { SEVERITY_ORDER } from "@/lib/soc/severity";
import { FINDING_STATUSES } from "@/types/findings";
import type { Severity } from "@/types/dashboard";

export async function GET(request: Request) {
  const gate = await guard("scanner:read");
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(request.url);
  const severity = SEVERITY_ORDER.find(
    (value) => value === searchParams.get("severity"),
  ) as Severity | undefined;
  const status = FINDING_STATUSES.find(
    (value) => value === searchParams.get("status"),
  );
  const sortParam = searchParams.get("sort");
  const sort = ["recent", "severity", "cvss", "asset", "status"].includes(
    sortParam ?? "",
  )
    ? (sortParam as "recent" | "severity" | "cvss" | "asset" | "status")
    : "severity";

  const data = await getFindingsPageData(tenantScope(gate.ctx), {
    severity,
    status,
    category: searchParams.get("category") ?? undefined,
    assetId: searchParams.get("assetId") ?? undefined,
    query: searchParams.get("q") ?? undefined,
    sort,
  });

  return NextResponse.json(data);
}

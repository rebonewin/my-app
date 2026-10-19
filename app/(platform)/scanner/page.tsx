import { desc, eq } from "drizzle-orm";

import { PageHeader } from "@/components/layout/PageHeader";
import { ScannerWorkspace } from "@/components/scanner/ScannerWorkspace";
import { requirePermission } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { scan } from "@/lib/db/schema";

export const instant = false;

export const metadata = {
  title: "Scanner · 1Security",
};

export default async function ScannerPage() {
  const context = await requirePermission("scanner:read", { next: "/scanner" });

  const recentScans = await db
    .select({
      id: scan.id,
      target: scan.target,
      riskLevel: scan.riskLevel,
      riskScore: scan.riskScore,
      createdAt: scan.createdAt,
    })
    .from(scan)
    .where(eq(scan.userId, context.user.id))
    .orderBy(desc(scan.createdAt))
    .limit(8);

  return (
    <div>
      <PageHeader
        eyebrow="Attack surface"
        title="Security scanner"
        description="Passive assessment of headers, TLS, cookies, CORS, framing controls and exposed services. Every result is signed into the audit trail."
      />
      <ScannerWorkspace
        canStart={context.permissions.has("scanner:start")}
        recentScans={recentScans}
      />
    </div>
  );
}

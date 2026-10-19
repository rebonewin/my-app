import { PageHeader } from "@/components/layout/PageHeader";
import { AuditLogViewer } from "@/components/audit/AuditLogViewer";
import { requirePermission } from "@/lib/auth/server";

export const instant = false;

export const metadata = {
  title: "Audit log · 1Security",
};

export default async function AuditPage() {
  const context = await requirePermission("audit:read", { next: "/audit" });

  return (
    <div>
      <PageHeader
        eyebrow="Governance"
        title="Audit log"
        description="Append-only record of authentication, authorization, scanning and administrative actions. Entries are never edited in place."
      />
      <AuditLogViewer
        canExport={context.permissions.has("audit:export")}
        isPlatformAdmin={context.permissions.has("dashboard:admin")}
      />
    </div>
  );
}

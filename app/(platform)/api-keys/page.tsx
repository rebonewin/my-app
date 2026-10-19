import { PageHeader } from "@/components/layout/PageHeader";
import { ApiKeysPanel } from "@/components/api-keys/ApiKeysPanel";
import { Alert } from "@/components/ui/alert";
import { requirePermission } from "@/lib/auth/server";

export const instant = false;

export const metadata = {
  title: "API keys · 1Security",
};

export default async function ApiKeysPage() {
  const context = await requirePermission("api_key:read", { next: "/api-keys" });

  return (
    <div>
      <PageHeader
        eyebrow="Machine access"
        title="API keys"
        description="Scoped machine credentials for CI pipelines, SOAR playbooks and scheduled assessments. Keys are hashed at rest and inherit your role's permissions."
      />

      <div className="mb-5">
        <Alert tone="info" title="How scoping works">
          Key scopes are snapshotted from your role when the key is created. If
          your role is reduced later, revoke and recreate the key to apply the
          narrower scope. Keys are rate limited to 120 requests per minute.
        </Alert>
      </div>

      <ApiKeysPanel
        canCreate={context.permissions.has("api_key:create")}
        canRevoke={context.permissions.has("api_key:revoke")}
      />
    </div>
  );
}

import { PageHeader } from "@/components/layout/PageHeader";
import {
  AdminUsersPanel,
  type AdminRoleOption,
} from "@/components/admin/AdminUsersPanel";
import { requirePermission } from "@/lib/auth/server";
import { PLATFORM_ROLES, ROLES } from "@/lib/rbac/permissions";

export const instant = false;

export const metadata = {
  title: "User management · 1Security",
};

export default async function AdminUsersPage() {
  const context = await requirePermission("user:read", { next: "/admin/users" });

  const roleOptions: AdminRoleOption[] = PLATFORM_ROLES
    .filter((slug) => slug !== "guest")
    .map((slug) => ({
      slug,
      name: ROLES[slug].name,
      rank: ROLES[slug].rank,
    }))
    .sort((a, b) => b.rank - a.rank);

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="User management"
        description="Assign platform roles, suspend abusive accounts and review identity posture. Rank checks prevent privilege escalation in both directions."
      />
      <AdminUsersPanel
        selfId={context.user.id}
        roleOptions={roleOptions}
        canSetRole={context.permissions.has("user:set-role")}
        canBan={context.permissions.has("user:ban")}
      />
    </div>
  );
}

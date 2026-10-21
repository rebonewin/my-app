import { PageHeader } from "@/components/layout/PageHeader";
import { AdminUserDetail } from "@/components/admin/AdminUserDetail";
import { requirePermission } from "@/lib/auth/server";

export const instant = false;

export const metadata = {
  title: "User detail · 1Security",
};

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("user:read", { next: "/admin/users" });
  const { id } = await params;

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="User detail"
        description="Identity, live sessions and the full audit trail for one account. Rank checks prevent inspecting accounts at or above your own."
      />
      <AdminUserDetail userId={id} />
    </div>
  );
}

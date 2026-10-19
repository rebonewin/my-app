import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { LockIcon } from "@/components/ui/icons";
import { getAuthContext } from "@/lib/auth/server";
import { getRole } from "@/lib/rbac/permissions";

export const instant = false;

export const metadata = {
  title: "Access denied · 1Security",
};

export default async function ForbiddenPage() {
  const context = await getAuthContext();
  const role = getRole(context?.user.role);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md">
        <CardBody className="p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10 text-red-300">
            <LockIcon size={24} />
          </span>
          <p className="mt-4 text-[10px] uppercase tracking-[0.22em] text-red-400/80">
            403 · Forbidden
          </p>
          <h1 className="mt-1 text-xl font-semibold text-white">
            Your role cannot open this
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Access is enforced by the server-side permission matrix, not just the
            navigation. Your current role is{" "}
            <span className="text-slate-200">{role.name}</span>. Ask a platform
            administrator if you need elevated access.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <ButtonLink href="/dashboard" size="sm">
              Back to dashboard
            </ButtonLink>
            <ButtonLink href="/settings" size="sm" variant="secondary">
              Account settings
            </ButtonLink>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

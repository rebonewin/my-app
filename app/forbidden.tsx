import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { LockIcon } from "@/components/ui/icons";

export const metadata = {
  title: "Access denied · 1Security",
  robots: { index: false },
};

/**
 * 403 boundary.
 *
 * Rendered by `forbidden()` from the RBAC guards in `lib/auth/server.ts`. Next
 * returns a real 403 status before streaming starts; after streaming starts the
 * body is replaced with this UI in a 200 response, because the shell has already
 * been flushed.
 */
export default function Forbidden() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
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
            Access is enforced by the server-side permission matrix, not only by
            the navigation. Platform administration is evaluated against your
            platform role, so organization authority never widens it.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <ButtonLink href="/dashboard" size="sm">
              Back to dashboard
            </ButtonLink>
            <ButtonLink href="/settings" size="sm" variant="secondary">
              Account settings
            </ButtonLink>
          </div>
          <p className="mt-4 text-[10px] text-slate-600">
            Need elevated access?{" "}
            <Link href="/settings" className="underline decoration-dotted">
              Review your roles
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

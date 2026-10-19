"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { BuildingIcon, CheckIcon, XIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/utils";

export function AcceptInvitation({
  invitationId,
  organizationId,
  organizationName,
  roleName,
  inviterName,
  expiresAt,
  email,
  emailMatches,
}: {
  invitationId: string;
  organizationId: string;
  organizationName: string;
  roleName: string;
  inviterName: string;
  expiresAt: string;
  email: string;
  emailMatches: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy("accept");
    setError(null);

    const { error: acceptError } = await authClient.organization.acceptInvitation({
      invitationId,
    });

    if (acceptError) {
      setBusy(null);
      setError(acceptError.message ?? "Could not accept the invitation.");
      return;
    }

    await authClient.organization.setActive({ organizationId });

    router.push("/organization/members");
    router.refresh();
  }

  async function decline() {
    setBusy("decline");
    setError(null);

    const { error: rejectError } = await authClient.organization.rejectInvitation({
      invitationId,
    });

    if (rejectError) {
      setBusy(null);
      setError(rejectError.message ?? "Could not decline the invitation.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardBody className="space-y-5 p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
            <BuildingIcon size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-500/80">
              Invitation
            </p>
            <h1 className="truncate text-lg font-semibold text-white">
              {organizationName}
            </h1>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs">
          <Row label="Invited by" value={inviterName} />
          <Row label="Role" value={roleName} />
          <Row label="Sent to" value={email} />
          <Row label="Expires" value={formatDate(expiresAt)} />
        </div>

        {!emailMatches ? (
          <Alert tone="warning" title="Wrong account">
            This invitation was sent to <strong>{email}</strong>, but you are
            signed in with a different address. Sign in with the invited address
            to accept it.
          </Alert>
        ) : null}

        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1"
            loading={busy === "accept"}
            disabled={!emailMatches || busy !== null}
            onClick={accept}
          >
            <CheckIcon size={14} />
            Accept invitation
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            loading={busy === "decline"}
            disabled={busy !== null}
            onClick={decline}
          >
            <XIcon size={14} />
            Decline
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="truncate text-right text-slate-200">{value}</span>
    </div>
  );
}

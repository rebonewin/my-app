import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { AcceptInvitation } from "@/components/organization/AcceptInvitation";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAuth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { invitation, organization, user } from "@/lib/db/schema";
import { getRole } from "@/lib/rbac/permissions";
import { isPast } from "@/lib/utils";

export const instant = false;

export const metadata = {
  title: "Accept invitation · 1Security",
};

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireAuth(`/accept-invitation/${id}`);

  const [row] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      organizationId: organization.id,
      organizationName: organization.name,
      inviterName: user.name,
      inviterEmail: user.email,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .innerJoin(user, eq(invitation.inviterId, user.id))
    .where(eq(invitation.id, id))
    .limit(1);

  if (!row) notFound();

  const expired = isPast(row.expiresAt);

  if (row.status !== "pending" || expired) {
    return (
      <div>
        <PageHeader
          eyebrow="Invitation"
          title="This invitation is no longer valid"
          description="Invitations expire after seven days and can only be accepted once."
        />
        <Alert tone="warning" title={`Status: ${row.status}`}>
          Ask an organization administrator to send a new invitation to{" "}
          {row.email}.
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Invitation"
        title="Join the organization"
        description="Accepting adds you as a member with the role chosen by the inviter. Your platform account is unchanged."
      />
      <AcceptInvitation
        invitationId={row.id}
        organizationId={row.organizationId}
        organizationName={row.organizationName}
        roleName={getRole(row.role).name}
        inviterName={row.inviterName || row.inviterEmail}
        expiresAt={row.expiresAt.toISOString()}
        email={row.email}
        emailMatches={
          row.email.toLowerCase() === context.user.email.toLowerCase()
        }
      />
    </div>
  );
}

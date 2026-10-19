"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import {
  CheckIcon,
  MailIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { formatDate, initials, relativeTime } from "@/lib/utils";

export interface MemberRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  roleName: string;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  isSelf: boolean;
  canManage: boolean;
}

export interface InvitationRow {
  id: string;
  email: string;
  role: string;
  roleName: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface RoleOption {
  slug: string;
  name: string;
}

export function MembersManager({
  organizationName,
  members,
  invitations,
  roleOptions,
  canInvite,
  canUpdateRole,
  canRemove,
}: {
  organizationName: string;
  members: MemberRow[];
  invitations: InvitationRow[];
  roleOptions: RoleOption[];
  canInvite: boolean;
  canUpdateRole: boolean;
  canRemove: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roleOptions[0]?.slug ?? "customer");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/organizations/members", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role }),
    });

    const payload = await response.json().catch(() => null);
    setBusy(false);

    if (!response.ok) {
      setError(payload?.error ?? "Could not send the invitation.");
      return;
    }

    setEmail("");
    setMessage(`Invitation sent to ${email.trim()}.`);
    router.refresh();
  }

  async function changeRole(member: MemberRow, nextRole: string) {
    if (nextRole === member.role) return;
    if (
      !confirm(
        `Change ${member.email} from ${member.roleName} to ${
          roleOptions.find((option) => option.slug === nextRole)?.name ?? nextRole
        }?`,
      )
    ) {
      return;
    }

    setBusyId(member.id);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/organizations/members", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId: member.id, role: nextRole }),
    });

    const payload = await response.json().catch(() => null);
    setBusyId(null);

    if (!response.ok) {
      setError(payload?.error ?? "Could not update the member role.");
      return;
    }

    setMessage(`${member.email} is now ${nextRole}.`);
    router.refresh();
  }

  async function remove(member: MemberRow) {
    if (
      !confirm(
        `Remove ${member.email} from ${organizationName}? Their sessions stay active, but tenant access is revoked.`,
      )
    ) {
      return;
    }

    setBusyId(member.id);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/organizations/members", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId: member.id }),
    });

    const payload = await response.json().catch(() => null);
    setBusyId(null);

    if (!response.ok) {
      setError(payload?.error ?? "Could not remove the member.");
      return;
    }

    setMessage(`${member.email} removed.`);
    router.refresh();
  }

  async function cancelInvitation(invitation: InvitationRow) {
    if (!confirm(`Cancel the invitation to ${invitation.email}?`)) return;

    setBusyId(invitation.id);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/organizations/members", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ invitationId: invitation.id }),
    });

    const payload = await response.json().catch(() => null);
    setBusyId(null);

    if (!response.ok) {
      setError(payload?.error ?? "Could not cancel the invitation.");
      return;
    }

    setMessage("Invitation cancelled.");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {canInvite ? (
        <Card>
          <CardHeader
            title="Invite a member"
            description="The invitation expires after 7 days and is bound to the recipient's email address."
          />
          <CardBody>
            <form
              onSubmit={invite}
              className="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end"
            >
              <Field label="Email address" htmlFor="invite-email" required>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="analyst@company.com"
                  maxLength={254}
                  required
                />
              </Field>
              <Field label="Organization role" htmlFor="invite-role">
                <Select
                  id="invite-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                >
                  {roleOptions.map((option) => (
                    <option key={option.slug} value={option.slug}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" loading={busy} className="h-11">
                <MailIcon size={14} />
                Send invite
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Members"
          description={`${members.length} member${members.length === 1 ? "" : "s"} in ${organizationName}`}
          action={
            <Badge tone="neutral">
              <UsersIcon size={10} /> {members.length}
            </Badge>
          }
        />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium">Member</th>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">Security</th>
                  <th className="px-3 py-3 font-medium">Last sign-in</th>
                  <th className="px-3 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {members.map((member) => (
                  <tr key={member.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] text-[10px] font-semibold text-cyan-200">
                          {member.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={member.image}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            initials(member.name || member.email)
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate text-slate-200">
                            {member.name || "Unnamed member"}
                            {member.isSelf ? (
                              <span className="text-[9px] uppercase tracking-wider text-cyan-400">
                                you
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate text-[10px] text-slate-500">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {canUpdateRole && member.canManage && !member.isSelf ? (
                        <Select
                          value={member.role}
                          disabled={busyId !== null}
                          onChange={(event) => changeRole(member, event.target.value)}
                          className="h-8 w-40 text-[11px]"
                          aria-label={`Role for ${member.email}`}
                        >
                          {roleOptions.map((option) => (
                            <option key={option.slug} value={option.slug}>
                              {option.name}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Badge tone="neutral">{member.roleName}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={member.twoFactorEnabled ? "green" : "amber"}>
                        <ShieldCheckIcon size={10} />
                        {member.twoFactorEnabled ? "2FA" : "No 2FA"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {member.lastLoginAt
                        ? relativeTime(member.lastLoginAt)
                        : "Never"}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatDate(member.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canRemove && member.canManage && !member.isSelf ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={busyId === member.id}
                          disabled={busyId !== null}
                          onClick={() => remove(member)}
                          aria-label={`Remove ${member.email}`}
                        >
                          <TrashIcon size={13} />
                        </Button>
                      ) : member.isSelf ? (
                        <span className="text-[10px] text-slate-600">—</span>
                      ) : (
                        <span className="text-[10px] text-slate-600">
                          Protected
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Pending invitations"
          description="Unaccepted invitations remain valid until they expire."
          action={<Badge tone="amber">{invitations.length}</Badge>}
        />
        <CardBody className="p-0">
          {invitations.length === 0 ? (
            <EmptyState
              icon={<CheckIcon size={20} />}
              title="No pending invitations"
              description="Every invitation has been accepted, declined or expired."
            />
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {invitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs text-slate-200">
                      {invitation.email}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {invitation.roleName} · sent{" "}
                      {relativeTime(invitation.createdAt)} · expires{" "}
                      {formatDate(invitation.expiresAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge tone="amber">{invitation.status}</Badge>
                    {canInvite ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busyId === invitation.id}
                        disabled={busyId !== null}
                        onClick={() => cancelInvitation(invitation)}
                      >
                        <TrashIcon size={13} />
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {!canInvite ? (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
          <PlusIcon size={11} />
          Your organization role cannot invite or manage members.
        </p>
      ) : null}
    </div>
  );
}

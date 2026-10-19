"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import {
  BuildingIcon,
  CheckIcon,
  PlusIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { formatDate } from "@/lib/utils";

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  role: string;
  roleName: string;
  plan: string;
  seats: number;
  memberCount: number;
  createdAt: string;
  isActive: boolean;
}

export function OrganizationSettings({
  organizations,
  canCreate,
  canUpdate,
}: {
  organizations: OrganizationRow[];
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const active = organizations.find((org) => org.isActive) ?? null;

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setError(null);
    setMessage(null);

    const response = await fetch("/api/organizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        ...(slug.trim() ? { slug: slug.trim() } : {}),
      }),
    });

    const payload = await response.json().catch(() => null);
    setCreating(false);

    if (!response.ok) {
      setError(payload?.error ?? "Could not create the organization.");
      return;
    }

    setName("");
    setSlug("");
    setMessage("Organization created and selected.");
    router.refresh();
  }

  async function switchOrganization(organizationId: string) {
    setSwitching(organizationId);
    setError(null);
    const { error: switchError } = await authClient.organization.setActive({
      organizationId,
    });
    setSwitching(null);

    if (switchError) {
      setError(switchError.message ?? "Could not switch organization.");
      return;
    }

    router.refresh();
  }

  async function leave(organization: OrganizationRow) {
    if (
      !confirm(
        `Leave ${organization.name}? You will lose access to its scans and members immediately.`,
      )
    ) {
      return;
    }

    setSwitching(organization.id);
    setError(null);
    const { error: leaveError } = await authClient.organization.leave({
      organizationId: organization.id,
    });
    setSwitching(null);

    if (leaveError) {
      setError(leaveError.message ?? "Could not leave the organization.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-5">
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {organizations.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<BuildingIcon size={20} />}
              title="No organization yet"
              description="Organizations scope members, roles, scans and reports. Create the first one to activate team features."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {organizations.map((org) => (
            <Card
              key={org.id}
              className={
                org.isActive
                  ? "border-cyan-400/30 bg-cyan-400/[0.03]"
                  : undefined
              }
            >
              <CardBody className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-400/15 to-blue-600/15 text-cyan-300">
                    <BuildingIcon size={18} />
                  </span>
                  {org.isActive ? (
                    <Badge tone="green">
                      <CheckIcon size={10} /> Active
                    </Badge>
                  ) : (
                    <Badge tone="neutral">{org.plan}</Badge>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {org.name}
                  </p>
                  <p className="truncate font-mono text-[11px] text-slate-500">
                    /{org.slug}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <UsersIcon size={11} /> {org.memberCount}/
                    {org.seats} seats
                  </span>
                  <span>{org.roleName}</span>
                </div>

                <p className="text-[10px] text-slate-600">
                  Created {formatDate(org.createdAt)}
                </p>

                <div className="flex gap-1.5 pt-1">
                  {!org.isActive ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={switching === org.id}
                      disabled={switching !== null}
                      onClick={() => switchOrganization(org.id)}
                    >
                      Switch
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={switching !== null}
                    onClick={() => leave(org)}
                  >
                    Leave
                  </Button>
                  <a
                    href="/organization/members"
                    className="ml-auto inline-flex h-8 items-center rounded-lg border border-white/10 px-2.5 text-[11px] text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
                  >
                    Members
                  </a>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {active && canUpdate ? <RenameOrganization organization={active} /> : null}

      {canCreate ? (
        <Card>
          <CardHeader
            title="Create an organization"
            description="You become the owner. Roles, members and scans are scoped to this tenant."
          />
          <CardBody>
            <form
              onSubmit={create}
              className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            >
              <Field label="Name" htmlFor="org-name" required>
                <Input
                  id="org-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Acme Security"
                  maxLength={80}
                  required
                />
              </Field>
              <Field
                label="Slug"
                htmlFor="org-slug"
                hint="Optional. Generated from the name."
              >
                <Input
                  id="org-slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="acme-security"
                  maxLength={48}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                />
              </Field>
              <Button type="submit" loading={creating} className="h-11">
                <PlusIcon size={15} />
                Create
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function RenameOrganization({ organization }: { organization: OrganizationRow }) {
  const router = useRouter();
  const [name, setName] = useState(organization.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const { error: updateError } = await authClient.organization.update({
      organizationId: organization.id,
      data: { name: name.trim() },
    });

    setSaving(false);

    if (updateError) {
      setError(updateError.message ?? "Could not update the organization.");
      return;
    }

    setMessage("Organization updated.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader
        title={`Settings · ${organization.name}`}
        description="Only owners and administrators can rename the tenant."
      />
      <CardBody>
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Display name" htmlFor="active-org-name" required>
              <Input
                id="active-org-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                required
              />
            </Field>
            <Field label="Slug" htmlFor="active-org-slug" hint="Immutable.">
              <Input
                id="active-org-slug"
                value={organization.slug}
                readOnly
                disabled
              />
            </Field>
          </div>
          {message ? <Alert tone="success">{message}</Alert> : null}
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

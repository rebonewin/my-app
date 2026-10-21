"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { cn, initials } from "@/lib/utils";
import {
  ChevronDownIcon,
  LogOutIcon,
  MenuIcon,
  SearchIcon,
  ShieldCheckIcon,
  XIcon,
} from "@/components/ui/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | null;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface ShellUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  roleLabel: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

export interface ShellOrganization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export function AppShell({
  user,
  sections,
  organizations,
  activeOrganizationId,
  children,
}: {
  user: ShellUser;
  sections: NavSection[];
  organizations: ShellOrganization[];
  activeOrganizationId: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);
  const [clock, setClock] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close overlays when the route changes. This is the React-endorsed
  // "adjust state during render" pattern; an effect here triggers cascading
  // renders and is rejected by the hooks lint.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
    setMenuOpen(false);
    setOrgOpen(false);
  }

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setOrgOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const activeOrg = organizations.find((o) => o.id === activeOrganizationId);
  const current =
    sections
      .flatMap((section) => section.items)
      .find(
        (item) =>
          pathname === item.href || pathname.startsWith(`${item.href}/`),
      ) ?? null;

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  async function switchOrganization(organizationId: string) {
    await authClient.organization.setActive({ organizationId });
    setOrgOpen(false);
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/[0.06] px-5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950">
            <ShieldCheckIcon size={18} />
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">
            1<span className="text-cyan-400">Security</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.title} className="mb-5">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                        active
                          ? "bg-gradient-to-r from-cyan-400/15 to-transparent text-white shadow-[inset_1px_0_0_0_rgba(34,211,238,0.7)]"
                          : "text-slate-400 hover:bg-white/[0.04] hover:text-white",
                      )}
                    >
                      <span
                        className={cn(
                          "transition-colors",
                          active
                            ? "text-cyan-300"
                            : "text-slate-500 group-hover:text-cyan-300",
                        )}
                      >
                        {item.icon}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.06] p-3">
        {organizations.length > 0 ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setOrgOpen((v) => !v)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-white/10 hover:bg-white/[0.06]"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-[11px] font-semibold text-violet-300">
                {initials(activeOrg?.name ?? "No")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-white">
                  {activeOrg?.name ?? "No organization"}
                </span>
                <span className="block truncate text-[10px] text-slate-500">
                  {activeOrg?.role ?? "personal account"}
                </span>
              </span>
              <ChevronDownIcon size={14} className="text-slate-500" />
            </button>

            {orgOpen ? (
              <div className="absolute bottom-full left-0 right-0 mb-2 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#0a0f1e] p-1 shadow-2xl">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => switchOrganization(org.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition",
                      org.id === activeOrganizationId
                        ? "bg-cyan-400/10 text-cyan-200"
                        : "text-slate-300 hover:bg-white/[0.06]",
                    )}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/20 text-[10px] font-semibold text-violet-300">
                      {initials(org.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{org.name}</span>
                      <span className="block truncate text-[10px] text-slate-500">
                        {org.role}
                      </span>
                    </span>
                  </button>
                ))}
                <Link
                  href="/organization"
                  className="mt-1 block rounded-lg px-2.5 py-2 text-xs text-cyan-300 transition hover:bg-white/[0.06]"
                >
                  Manage organizations
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#050816]">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-white/[0.06] bg-[#070b17] lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 border-r border-white/10 bg-[#070b17]">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:text-white"
              aria-label="Close navigation"
            >
              <XIcon size={16} />
            </button>
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-[#070b17]/85 px-4 backdrop-blur-xl lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
            aria-label="Open navigation"
          >
            <MenuIcon size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-white">
              {current?.label ?? "1Security"}
            </h1>
            <p className="hidden text-[11px] text-slate-500 sm:block">
              {activeOrg ? activeOrg.name : "Personal workspace"} ·{" "}
              {user.roleLabel}
            </p>
          </div>

          <div className="hidden items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-500 md:flex">
            <SearchIcon size={13} />
            <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px]">
              ⌘K
            </kbd>
          </div>

          <span className="hidden font-mono text-xs text-cyan-400/80 sm:block">
            {clock}
          </span>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] py-1.5 pl-1.5 pr-2.5 transition hover:border-white/10 hover:bg-white/[0.06]"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 text-[11px] font-bold text-slate-950">
                {initials(user.name)}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block max-w-[9rem] truncate text-xs font-medium text-white">
                  {user.name}
                </span>
                <span className="block max-w-[9rem] truncate text-[10px] text-slate-500">
                  {user.email}
                </span>
              </span>
              <ChevronDownIcon size={14} className="text-slate-500" />
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#0a0f1e] shadow-2xl">
                <div className="border-b border-white/[0.06] px-4 py-3">
                  <p className="truncate text-sm font-medium text-white">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {user.email}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-300">
                      {user.roleLabel}
                    </span>
                    {user.twoFactorEnabled ? (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">
                        2FA on
                      </span>
                    ) : (
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300">
                        2FA off
                      </span>
                    )}
                    {user.emailVerified ? null : (
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300">
                        unverified
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-1.5">
                  <Link
                    href="/profile"
                    className="block rounded-lg px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Profile
                  </Link>
                  <Link
                    href="/settings"
                    className="block rounded-lg px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Account settings
                  </Link>
                  <Link
                    href="/settings/security"
                    className="block rounded-lg px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    Security &amp; two-factor
                  </Link>
                  {!user.emailVerified ? (
                    <Link
                      href={`/verify-email?email=${encodeURIComponent(user.email)}`}
                      className="block rounded-lg px-3 py-2 text-xs text-amber-300 transition hover:bg-white/[0.06]"
                    >
                      Verify email address
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-300 transition hover:bg-red-500/10"
                  >
                    <LogOutIcon size={14} />
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}

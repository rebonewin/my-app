"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { SocNavIcon } from "@/components/layout/SocNavIcon";
import {
  BellIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CommandIcon,
  LogOutIcon,
  MenuIcon,
  PanelLeftIcon,
  SearchIcon,
  ShieldCheckIcon,
  XIcon,
} from "@/components/ui/icons";
import { useSidebar } from "@/hooks/use-sidebar";
import { authClient } from "@/lib/auth/client";
import {
  SOC_NAV_SECTIONS,
  isSocNavActive,
  socPageTitle,
} from "@/lib/soc/navigation";
import { cn, initials } from "@/lib/utils";

export interface SocShellUser {
  name: string;
  email: string;
  roleLabel: string;
  organizationName: string | null;
  organizationRole: string | null;
}

export function SocShell({
  user,
  children,
}: {
  user: SocShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggleCollapsed } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  const pageTitle = socPageTitle(pathname);

  // Close transient overlays on navigation.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
    setMenuOpen(false);
    setCommandOpen(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setMenuOpen(false);
        setMobileOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    const trigger = mobileTriggerRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      trigger?.focus();
    };
  }, [mobileOpen]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
    } finally {
      router.push("/sign-in");
      router.refresh();
    }
  }

  const sidebarContent = (isCollapsed: boolean, mobile: boolean) => (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-[72px] shrink-0 items-center border-b border-soc-border",
          isCollapsed ? "justify-center px-3" : "justify-between px-4",
        )}
      >
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2.5"
          title="1Security SOC"
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-soc-accent via-soc-blue to-soc-violet text-soc-accent-contrast shadow-[0_0_24px_-6px_var(--soc-accent-glow)]">
            <ShieldCheckIcon size={19} />
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent soc-sweep" />
          </span>
          {!isCollapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold tracking-[0.08em] text-soc-fg">
                1SECURITY
              </span>
              <span className="block truncate text-[9px] font-semibold uppercase tracking-[0.2em] text-soc-faint">
                Security operations
              </span>
            </span>
          ) : null}
        </Link>

        {mobile ? (
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="rounded-lg p-2 text-soc-muted transition hover:bg-soc-hover hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
          >
            <XIcon size={17} />
          </button>
        ) : null}
      </div>

      <div className={cn("shrink-0 px-3 pt-4", isCollapsed && "px-2")}>
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-xl border border-soc-border bg-soc-elevated/60 p-2.5",
            isCollapsed && "justify-center border-transparent bg-transparent p-0",
          )}
          title={user.organizationName ?? "Personal workspace"}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-soc-violet-soft text-[10px] font-bold text-soc-violet">
            {initials(user.organizationName ?? user.name)}
          </span>
          {!isCollapsed ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-semibold text-soc-fg">
                {user.organizationName ?? "Personal workspace"}
              </span>
              <span className="block truncate text-[9px] uppercase tracking-[0.14em] text-soc-faint">
                {user.organizationRole ?? "SOC operator"}
              </span>
            </span>
          ) : null}
        </div>
      </div>

      <nav
        aria-label="SOC navigation"
        className="soc-scroll flex-1 overflow-y-auto px-3 py-4"
      >
        {SOC_NAV_SECTIONS.map((section, sectionIndex) => (
          <div
            key={section.id}
            className={cn(sectionIndex > 0 ? "mt-5" : "mt-0")}
          >
            {!isCollapsed ? (
              <p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-soc-faint">
                {section.label}
              </p>
            ) : sectionIndex > 0 ? (
              <div className="mx-auto mb-3 h-px w-6 bg-soc-border" />
            ) : null}

            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isSocNavActive(item, pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={isCollapsed ? item.label : item.description}
                      onClick={mobile ? () => setMobileOpen(false) : undefined}
                      className={cn(
                        "group relative flex items-center rounded-xl text-[12.5px] outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-soc-accent/60",
                        isCollapsed
                          ? "h-10 justify-center"
                          : "h-10 gap-3 px-3",
                        active
                          ? "bg-gradient-to-r from-soc-accent/15 via-soc-accent/5 to-transparent font-medium text-soc-fg shadow-[inset_2px_0_0_var(--soc-accent)]"
                          : "text-soc-muted hover:bg-soc-hover hover:text-soc-fg",
                      )}
                    >
                      <span
                        className={cn(
                          "shrink-0 transition-colors",
                          active
                            ? "text-soc-accent"
                            : "text-soc-faint group-hover:text-soc-accent",
                        )}
                      >
                        <SocNavIcon name={item.icon} size={17} />
                      </span>
                      {!isCollapsed ? (
                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                        </span>
                      ) : null}
                      {!isCollapsed && active ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-soc-accent shadow-[0_0_10px_var(--soc-accent)]" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "shrink-0 space-y-3 border-t border-soc-border p-3",
          isCollapsed && "px-2",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl border border-soc-border bg-soc-elevated/50 px-3 py-2.5",
            isCollapsed && "justify-center border-transparent bg-transparent px-0 py-1",
          )}
          title="All systems nominal"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="soc-live-dot absolute inline-flex h-full w-full rounded-full bg-soc-success opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-soc-success" />
          </span>
          {!isCollapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-[10px] font-semibold text-soc-fg">
                All systems nominal
              </span>
              <span className="block truncate text-[9px] text-soc-faint">
                Telemetry streaming
              </span>
            </span>
          ) : null}
        </div>

        <div
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-1.5 py-1",
            isCollapsed && "justify-center px-0",
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-soc-accent/25 to-soc-violet/25 text-[10px] font-bold text-soc-fg">
            {initials(user.name)}
          </span>
          {!isCollapsed ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-medium text-soc-fg">
                {user.name}
              </span>
              <span className="block truncate text-[9px] uppercase tracking-[0.12em] text-soc-faint">
                {user.roleLabel}
              </span>
            </span>
          ) : null}
        </div>

        {!mobile ? (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={cn(
              "flex h-9 w-full items-center rounded-xl text-[11px] text-soc-faint outline-none transition hover:bg-soc-hover hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60",
              isCollapsed ? "justify-center" : "gap-2.5 px-3",
            )}
          >
            <PanelLeftIcon size={15} />
            {!isCollapsed ? <span>Collapse sidebar</span> : null}
          </button>
        ) : null}
      </div>
    </div>
  );

  function trapMobileFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.offsetParent !== null);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="min-h-dvh">
      <a
        href="#soc-main"
        className="sr-only z-[100] rounded-lg bg-soc-accent px-3 py-2 text-xs font-semibold text-soc-accent-contrast focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <div className="flex min-h-dvh">
        <aside
          className={cn(
            "sticky top-0 hidden h-dvh shrink-0 border-r border-soc-border bg-soc-sidebar backdrop-blur-2xl transition-[width] duration-300 lg:flex lg:flex-col",
            collapsed ? "w-[78px]" : "w-[264px]",
          )}
        >
          {sidebarContent(collapsed, false)}
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="SOC navigation"
              onKeyDown={trapMobileFocus}
              className="absolute inset-y-0 left-0 w-[min(86vw,300px)] border-r border-soc-border bg-soc-sidebar shadow-2xl backdrop-blur-2xl"
            >
              {sidebarContent(false, true)}
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-[72px] items-center gap-2 border-b border-soc-border bg-soc-bg/80 px-3 backdrop-blur-2xl sm:gap-3 sm:px-5 lg:px-7">
            <button
              ref={mobileTriggerRef}
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-soc-border bg-soc-elevated text-soc-muted transition hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60 lg:hidden"
            >
              <MenuIcon size={18} />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-soc-faint sm:inline">
                  SOC
                </span>
                <ChevronRightIcon
                  size={12}
                  className="hidden text-soc-faint/60 sm:block"
                />
                <h1 className="truncate text-sm font-semibold tracking-tight text-soc-fg">
                  {pageTitle}
                </h1>
              </div>
              <p className="mt-0.5 hidden text-[10px] text-soc-faint sm:block">
                {user.organizationName ?? "Personal workspace"} ·{" "}
                {user.roleLabel}
              </p>
            </div>

            <div className="hidden items-center gap-2 rounded-xl border border-soc-border bg-soc-elevated px-2.5 py-2 text-[10px] text-soc-faint xl:flex">
              <span className="soc-live-dot h-1.5 w-1.5 rounded-full bg-soc-success" />
              Live telemetry
            </div>

            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="hidden h-9 items-center gap-2 rounded-xl border border-soc-border bg-soc-elevated px-3 text-xs text-soc-faint transition hover:border-soc-border-strong hover:text-soc-muted focus-visible:ring-2 focus-visible:ring-soc-accent/60 md:flex"
            >
              <SearchIcon size={14} />
              <span className="hidden lg:inline">Search SOC…</span>
              <kbd className="ml-2 flex items-center gap-0.5 rounded border border-soc-border bg-soc-hover px-1.5 py-0.5 text-[9px]">
                <CommandIcon size={9} />K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label="Search SOC"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-soc-border bg-soc-elevated text-soc-muted transition hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60 md:hidden"
            >
              <SearchIcon size={16} />
            </button>

            <ThemeToggle />

            <Link
              href="/activity"
              aria-label="Security notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-soc-border bg-soc-elevated text-soc-muted transition hover:border-soc-border-strong hover:text-soc-fg focus-visible:ring-2 focus-visible:ring-soc-accent/60"
            >
              <BellIcon size={16} />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-soc-critical ring-2 ring-soc-bg" />
            </Link>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex items-center gap-2 rounded-xl border border-soc-border bg-soc-elevated py-1.5 pl-1.5 pr-2.5 transition hover:border-soc-border-strong focus-visible:ring-2 focus-visible:ring-soc-accent/60"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-soc-accent to-soc-blue text-[10px] font-bold text-soc-accent-contrast">
                  {initials(user.name)}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-[8rem] truncate text-[11px] font-medium text-soc-fg">
                    {user.name}
                  </span>
                  <span className="block max-w-[8rem] truncate text-[9px] text-soc-faint">
                    {user.roleLabel}
                  </span>
                </span>
                <ChevronDownIcon size={13} className="text-soc-faint" />
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl border border-soc-border bg-soc-elevated-2 shadow-2xl"
                >
                  <div className="border-b border-soc-border px-4 py-3">
                    <p className="truncate text-xs font-semibold text-soc-fg">
                      {user.name}
                    </p>
                    <p className="truncate text-[10px] text-soc-muted">
                      {user.email}
                    </p>
                    <p className="mt-2 inline-flex rounded-full bg-soc-accent-soft px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-soc-accent">
                      {user.roleLabel}
                    </p>
                  </div>
                  <div className="p-1.5">
                    <Link
                      href="/profile"
                      role="menuitem"
                      className="block rounded-lg px-3 py-2 text-xs text-soc-muted transition hover:bg-soc-hover hover:text-soc-fg"
                    >
                      Profile
                    </Link>
                    <Link
                      href="/settings"
                      role="menuitem"
                      className="block rounded-lg px-3 py-2 text-xs text-soc-muted transition hover:bg-soc-hover hover:text-soc-fg"
                    >
                      Account settings
                    </Link>
                    <Link
                      href="/settings/security"
                      role="menuitem"
                      className="block rounded-lg px-3 py-2 text-xs text-soc-muted transition hover:bg-soc-hover hover:text-soc-fg"
                    >
                      Security &amp; two-factor
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-soc-critical transition hover:bg-soc-critical-soft disabled:opacity-50"
                    >
                      <LogOutIcon size={14} />
                      {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </header>

          <main
            id="soc-main"
            className="mx-auto w-full max-w-[1680px] flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8"
          >
            {children}
          </main>
        </div>
      </div>

      {commandOpen ? (
        <CommandPalette open onClose={() => setCommandOpen(false)} />
      ) : null}
    </div>
  );
}

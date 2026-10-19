import Link from "next/link";
import { ShieldCheckIcon } from "@/components/ui/icons";

/**
 * Shared chrome for every unauthenticated screen: layered neon background,
 * vignette grid, and a centred glass panel. Visual language matches the
 * existing portal so the transition from the old login is seamless.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Base gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#050816] via-[#0b1224] to-[#02040c]" />

      {/* Neon blooms */}
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-cyan-500/20 blur-[130px]" />
      <div className="pointer-events-none absolute -right-32 top-1/4 h-[26rem] w-[26rem] rounded-full bg-fuchsia-600/15 blur-[150px]" />
      <div className="pointer-events-none absolute bottom-[-10rem] left-1/2 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[130px]" />

      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(circle at 50% 40%, black 0%, transparent 75%)",
        }}
      />

      <div className={`relative w-full ${wide ? "max-w-xl" : "max-w-md"}`}>
        <div className="mb-6 flex flex-col items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950 shadow-[0_0_28px_-6px_rgba(34,211,238,0.9)]">
              <ShieldCheckIcon size={22} />
            </span>
            <span className="text-lg font-semibold tracking-tight text-white">
              1<span className="text-cyan-400">Security</span>
            </span>
          </Link>
        </div>

        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-7 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_30px_60px_-30px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
          <div className="mb-6">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>
            ) : null}
          </div>

          {children}
        </div>

        {footer ? (
          <div className="mt-5 text-center text-xs text-slate-500">{footer}</div>
        ) : null}

        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.35em] text-cyan-500/40">
          Zero Trust · Encrypted · Audited
        </p>
      </div>
    </main>
  );
}

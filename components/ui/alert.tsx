import { cn } from "@/lib/utils";
import { AlertIcon, CheckIcon, ShieldIcon, XIcon } from "./icons";

type AlertTone = "error" | "success" | "warning" | "info";

const tones: Record<AlertTone, { wrap: string; icon: React.ReactNode }> = {
  error: {
    wrap: "border-red-500/25 bg-red-500/[0.08] text-red-200",
    icon: <XIcon size={15} />,
  },
  success: {
    wrap: "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-200",
    icon: <CheckIcon size={15} />,
  },
  warning: {
    wrap: "border-amber-500/25 bg-amber-500/[0.08] text-amber-200",
    icon: <AlertIcon size={15} />,
  },
  info: {
    wrap: "border-cyan-500/25 bg-cyan-500/[0.08] text-cyan-200",
    icon: <ShieldIcon size={15} />,
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-xs leading-relaxed",
        tones[tone].wrap,
        className,
      )}
    >
      <span className="mt-0.5 shrink-0">{tones[tone].icon}</span>
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5" : ""}>{children}</div> : null}
      </div>
    </div>
  );
}

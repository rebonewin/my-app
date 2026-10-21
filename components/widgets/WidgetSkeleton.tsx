import { SocCard, SocSkeleton } from "@/components/ui/soc";
import { cn } from "@/lib/utils";

export function WidgetSkeleton({ className }: { className?: string }) {
  return (
    <SocCard className={cn("flex min-h-[178px] flex-col p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <SocSkeleton className="h-8 w-8 rounded-lg" />
          <SocSkeleton className="h-2.5 w-24" />
        </div>
        <SocSkeleton className="h-3.5 w-3.5 rounded" />
      </div>
      <div className="mt-5 flex flex-1 flex-col gap-3">
        <SocSkeleton className="h-8 w-28" />
        <SocSkeleton className="h-2.5 w-3/4" />
        <SocSkeleton className="mt-auto h-1.5 w-full" />
      </div>
    </SocCard>
  );
}

export function WidgetGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Loading dashboard metrics"
      aria-busy="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <WidgetSkeleton key={index} />
      ))}
    </div>
  );
}

import { SocCard, SocSkeleton } from "@/components/ui/soc";

function ChartSkeletonCard({
  className,
  height = 220,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <SocCard className={className}>
      <div className="flex items-center justify-between border-b border-soc-border px-5 py-4">
        <div className="space-y-2">
          <SocSkeleton className="h-3 w-32" />
          <SocSkeleton className="h-2 w-48" />
        </div>
        <SocSkeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="p-5">
        <SocSkeleton className="w-full rounded-xl" style={{ height }} />
      </div>
    </SocCard>
  );
}

export function ChartGridSkeleton() {
  return (
    <div
      className="grid gap-4 xl:grid-cols-2"
      aria-label="Loading dashboard charts"
      aria-busy="true"
    >
      <ChartSkeletonCard className="xl:col-span-2" height={240} />
      <ChartSkeletonCard height={200} />
      <ChartSkeletonCard height={200} />
      <ChartSkeletonCard height={200} />
      <ChartSkeletonCard height={200} />
    </div>
  );
}

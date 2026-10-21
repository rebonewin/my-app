import { ChartGridSkeleton } from "@/components/charts/ChartSkeleton";
import { WidgetGridSkeleton } from "@/components/widgets/WidgetSkeleton";
import { SocCard, SocSkeleton } from "@/components/ui/soc";

export function DashboardSkeleton() {
  return (
    <div
      className="space-y-5 sm:space-y-6"
      aria-label="Loading security operations dashboard"
      aria-busy="true"
    >
      <SocCard className="p-5 sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:justify-between">
          <div className="w-full max-w-2xl space-y-3">
            <SocSkeleton className="h-2.5 w-36" />
            <SocSkeleton className="h-9 w-full max-w-xl" />
            <SocSkeleton className="h-3 w-full max-w-lg" />
            <SocSkeleton className="h-3 w-4/5" />
            <div className="flex gap-2 pt-2">
              <SocSkeleton className="h-10 w-32 rounded-xl" />
              <SocSkeleton className="h-10 w-32 rounded-xl" />
            </div>
          </div>
          <div className="grid w-full shrink-0 grid-cols-3 gap-2.5 xl:w-[320px]">
            {Array.from({ length: 3 }, (_, index) => (
              <SocSkeleton key={index} className="h-[86px] rounded-xl" />
            ))}
            <SocSkeleton className="col-span-3 h-10 rounded-xl" />
          </div>
        </div>
      </SocCard>

      <div>
        <SocSkeleton className="mb-3 h-3 w-28" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <SocSkeleton key={index} className="h-[92px] rounded-2xl" />
          ))}
        </div>
      </div>

      <WidgetGridSkeleton />

      <div>
        <SocSkeleton className="mb-3 h-3 w-28" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <SocSkeleton key={index} className="h-[116px] rounded-2xl" />
          ))}
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_332px]">
        <ChartGridSkeleton />
        <div className="hidden space-y-3.5 xl:block">
          <SocSkeleton className="h-[270px] rounded-2xl" />
          <SocSkeleton className="h-[420px] rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

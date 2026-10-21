"use client";

import dynamic from "next/dynamic";

import { ChartGridSkeleton } from "./ChartSkeleton";
import type { DashboardChartsData } from "@/types/dashboard";

const DashboardCharts = dynamic(
  () => import("./DashboardCharts").then((module) => module.DashboardCharts),
  {
    ssr: false,
    loading: () => <ChartGridSkeleton />,
  },
);

export function LazyDashboardCharts({ data }: { data: DashboardChartsData }) {
  return <DashboardCharts data={data} />;
}

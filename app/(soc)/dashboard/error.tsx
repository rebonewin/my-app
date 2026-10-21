"use client";

import { SocErrorState } from "@/components/dashboard/SocErrorState";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SocErrorState
      title="Dashboard unavailable"
      description="The security operations data service did not respond. Your session and platform data are unaffected."
      digest={error.digest}
      reset={reset}
    />
  );
}

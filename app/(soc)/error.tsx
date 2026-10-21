"use client";

import { SocErrorState } from "@/components/dashboard/SocErrorState";

export default function SocError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SocErrorState
      title="Module unavailable"
      description="This SOC module could not render. The shell and your authenticated session are still intact."
      digest={error.digest}
      reset={reset}
    />
  );
}

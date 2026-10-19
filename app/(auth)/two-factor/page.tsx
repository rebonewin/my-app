import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { TwoFactorChallenge } from "@/components/auth/TwoFactorChallenge";

export const metadata: Metadata = {
  title: "Two-factor verification · 1Security",
};

export default function TwoFactorPage() {
  return (
    <AuthShell
      title="Two-factor verification"
      subtitle="Confirm the second factor to finish signing in."
    >
      <TwoFactorChallenge />
    </AuthShell>
  );
}

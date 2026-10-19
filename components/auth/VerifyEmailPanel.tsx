"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/input";

/**
 * Email verification landing page.
 *
 * Better Auth handles the actual token exchange at
 * `/api/auth/verify-email`, so this screen covers the two states a user can
 * land in: arrived from a successful verification, or needing a new email.
 */
export function VerifyEmailPanel({
  initialEmail,
  justVerified,
}: {
  initialEmail?: string;
  justVerified?: boolean;
}) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleResend(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: sendError } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/dashboard",
    });

    setLoading(false);

    if (sendError) {
      setError(sendError.message ?? "Could not send the verification email.");
      return;
    }

    setSent(true);
  }

  if (justVerified) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Email verified">
          Your address is confirmed. You now have full access to your account.
        </Alert>
        <Button className="w-full" onClick={() => router.push("/dashboard")}>
          Go to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {sent ? (
        <Alert tone="success" title="Verification email sent">
          Check your inbox for the confirmation link.
        </Alert>
      ) : (
        <Alert tone="info" title="Confirm your email">
          Open the link we emailed you to activate the account. Links expire
          after one hour.
        </Alert>
      )}

      <form onSubmit={handleResend} className="space-y-4">
        <Field label="Email address" htmlFor="verify-email" required>
          <Input
            id="verify-email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          Resend verification email
        </Button>
      </form>

      <p className="text-center text-xs text-slate-500">
        Already confirmed?{" "}
        <Link href="/sign-in" className="text-cyan-400 hover:text-cyan-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}

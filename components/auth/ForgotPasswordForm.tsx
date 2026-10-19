"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/input";

export function ForgotPasswordForm({ emailConfigured }: { emailConfigured: boolean }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!emailConfigured) {
    return (
      <Alert tone="warning" title="Email delivery is not configured">
        A platform administrator must set <code>RESEND_API_KEY</code> or the
        SMTP variables before password reset can send mail. Ask an
        administrator to reset your password from the admin console instead.
      </Alert>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: resetError } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message ?? "Could not start the reset. Try again.");
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Check your email">
          If an account exists for <strong>{email}</strong>, a reset link is on
          its way. The link expires in one hour.
        </Alert>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => setSent(false)}
        >
          Use a different email
        </Button>
        <p className="text-center text-xs text-slate-500">
          <Link href="/sign-in" className="text-cyan-400 hover:text-cyan-300">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Field
        label="Email address"
        htmlFor="forgot-email"
        required
        hint="We never reveal whether an account exists"
      >
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" loading={loading}>
        Send reset link
      </Button>

      <p className="text-center text-xs text-slate-500">
        <Link href="/sign-in" className="text-cyan-400 hover:text-cyan-300">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

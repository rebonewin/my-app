"use client";

import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  emailOTPClient,
  lastLoginMethodClient,
  magicLinkClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { apiKeyClient } from "@better-auth/api-key/client";
import { passkeyClient } from "@better-auth/passkey/client";

/**
 * Browser auth client.
 *
 * `onTwoFactorRedirect` sends the user to the challenge page as soon as a
 * sign-in returns `twoFactorRedirect`, so no caller has to remember to check.
 */
export const authClient = createAuthClient({
  baseURL:
    typeof window === "undefined"
      ? process.env.NEXT_PUBLIC_SITE_URL
      : window.location.origin,
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        // This callback lives outside React, so no router is in scope.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/two-factor";
      },
    }),
    passkeyClient(),
    emailOTPClient(),
    magicLinkClient(),
    organizationClient(),
    adminClient(),
    apiKeyClient(),
    lastLoginMethodClient(),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;

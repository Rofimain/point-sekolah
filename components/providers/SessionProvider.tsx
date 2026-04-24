"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

type Props = {
  children: React.ReactNode;
  /** When set from a Server Component, avoids an extra round-trip to /api/auth/session on first paint. */
  session?: Session | null;
};

export function SessionProvider({ children, session }: Props) {
  return (
    <NextAuthSessionProvider
      session={session ?? undefined}
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
      {children}
    </NextAuthSessionProvider>
  );
}

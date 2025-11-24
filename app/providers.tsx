"use client";

import { SessionProvider } from "next-auth/react";
import { CacheProvider } from "@/lib/cache/context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CacheProvider>{children}</CacheProvider>
    </SessionProvider>
  );
}


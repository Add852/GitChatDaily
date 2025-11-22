"use client";

import { useSession } from "next-auth/react";

export function MobileBottomPadding() {
  const { data: session } = useSession();
  
  // Add bottom padding equivalent to navbar height (h-16 = 64px = 16rem) on mobile when logged in
  if (!session) return null;
  
  return <div className="md:hidden h-16" />;
}


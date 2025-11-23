"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useEffect, useState, useRef } from "react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Prevent body scrolling
    const preventScroll = () => {
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.height = "100%";
      document.documentElement.style.position = "fixed";
      document.documentElement.style.width = "100%";
      document.body.style.overflow = "hidden";
      document.body.style.height = "100%";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      window.scrollTo(0, 0);
    };

    const updateViewportHeight = () => {
      // Use Visual Viewport API if available (most accurate for mobile browsers)
      if (window.visualViewport) {
        const height = window.visualViewport.height;
        setViewportHeight(height);
      } else {
        // Fallback for browsers without Visual Viewport API
        const height = window.innerHeight;
        setViewportHeight(height);
      }
      preventScroll();
    };

    // Set initial height and prevent scrolling
    preventScroll();
    updateViewportHeight();

    // Use Visual Viewport API if available
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewportHeight);
      window.visualViewport.addEventListener("scroll", preventScroll);

      return () => {
        window.visualViewport?.removeEventListener("resize", updateViewportHeight);
        window.visualViewport?.removeEventListener("scroll", preventScroll);
        // Restore scrolling on unmount
        document.documentElement.style.overflow = "";
        document.documentElement.style.height = "";
        document.documentElement.style.position = "";
        document.documentElement.style.width = "";
        document.body.style.overflow = "";
        document.body.style.height = "";
        document.body.style.position = "";
        document.body.style.width = "";
      };
    } else {
      // Fallback for browsers without Visual Viewport API
      window.addEventListener("resize", updateViewportHeight);
      window.addEventListener("orientationchange", updateViewportHeight);

      return () => {
        window.removeEventListener("resize", updateViewportHeight);
        window.removeEventListener("orientationchange", updateViewportHeight);
        // Restore scrolling on unmount
        document.documentElement.style.overflow = "";
        document.documentElement.style.height = "";
        document.documentElement.style.position = "";
        document.documentElement.style.width = "";
        document.body.style.overflow = "";
        document.body.style.height = "";
        document.body.style.position = "";
        document.body.style.width = "";
      };
    }
  }, []);

  return (
    <div 
      ref={containerRef}
      className="flex flex-col bg-github-dark overflow-hidden"
      style={{
        height: viewportHeight ? `${viewportHeight}px` : "100vh",
        maxHeight: viewportHeight ? `${viewportHeight}px` : "100vh",
      }}
    >
      {/* Desktop Top Navbar */}
      <div className="hidden md:block flex-shrink-0">
        <Navbar />
      </div>

      {/* Content Area - Scrollable (except journal page which handles its own scrolling) */}
      <div className={`flex-1 min-h-0 ${pathname === "/journal" ? "overflow-hidden" : "overflow-y-auto"}`}>
        {children}
      </div>

      {/* Mobile Floating Add Button - Hidden on journal page */}
      {session && pathname !== "/journal" && (
        <Link
          href="/journal"
          className="md:hidden fixed bottom-20 right-4 z-[55] w-14 h-14 bg-github-green hover:bg-github-green-hover text-white rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        </Link>
      )}

      {/* Mobile Bottom Navbar */}
      <div className="md:hidden flex-shrink-0">
        <Navbar />
      </div>
    </div>
  );
}


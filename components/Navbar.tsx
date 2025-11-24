"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useBackButtonHandler } from "@/hooks/useBackButtonHandler";

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const desktopProfileDropdownRef = useRef<HTMLDivElement>(null);
  const mobileProfileDropdownRef = useRef<HTMLDivElement>(null);

  // Handle browser back button for profile dropdown
  useBackButtonHandler(isProfileDropdownOpen, () => setIsProfileDropdownOpen(false));

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const isOutsideDesktop = desktopProfileDropdownRef.current && 
        !desktopProfileDropdownRef.current.contains(target);
      const isOutsideMobile = mobileProfileDropdownRef.current && 
        !mobileProfileDropdownRef.current.contains(target);
      
      if (isProfileDropdownOpen && isOutsideDesktop && isOutsideMobile) {
        setIsProfileDropdownOpen(false);
      }
    };

    if (isProfileDropdownOpen) {
      // Use capture phase to prevent event from reaching other elements
      document.addEventListener("mousedown", handleClickOutside, true);
      document.addEventListener("touchstart", handleClickOutside, true);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, [isProfileDropdownOpen]);

  const handleSignOut = () => {
    signOut();
    setIsProfileDropdownOpen(false);
  };

  const handleVisitGitHub = () => {
    if (session?.user) {
      window.open(
        `https://github.com/${(session.user as any)?.username || session.user?.name || ""}`,
        "_blank",
        "noopener,noreferrer"
      );
      setIsProfileDropdownOpen(false);
    }
  };

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* Desktop Top Navbar */}
      <nav className="hidden md:block bg-github-dark border-b border-github-dark-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center min-w-0 flex-1">
              <Link href="/" className="flex items-center space-x-2 min-w-0">
                <Image
                  src="/icons/app-icon.svg"
                  alt="GitChat Journal logo"
                  width={40}
                  height={40}
                  className="w-8 h-8 lg:w-10 lg:h-10 flex-shrink-0"
                />
                <span className="text-base lg:text-xl font-semibold truncate">
                  GitChat Journal
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="flex items-center space-x-3 lg:space-x-4 flex-shrink-0">
              {session ? (
                <>
                  <Link
                    href="/dashboard"
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive("/dashboard")
                        ? "bg-github-dark-hover text-white"
                        : "text-gray-300 hover:bg-github-dark-hover hover:text-white"
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                    Dashboard
                  </Link>
                  <Link
                    href="/journal"
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive("/journal")
                        ? "bg-github-dark-hover text-white"
                        : "text-gray-300 hover:bg-github-dark-hover hover:text-white"
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
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
                    New Entry
                  </Link>
                  <Link
                    href="/entries"
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive("/entries")
                        ? "bg-github-dark-hover text-white"
                        : "text-gray-300 hover:bg-github-dark-hover hover:text-white"
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Entries
                  </Link>
                  <Link
                    href="/chatbots"
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive("/chatbots")
                        ? "bg-github-dark-hover text-white"
                        : "text-gray-300 hover:bg-github-dark-hover hover:text-white"
                    }`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                    Chatbots
                  </Link>
                  <div className="relative" ref={desktopProfileDropdownRef}>
                    <button
                      onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                      className="flex items-center focus:outline-none"
                    >
                      <Image
                        src={session.user?.image || "/icons/app-icon.png"}
                        alt={session.user?.name || "User"}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full cursor-pointer hover:ring-2 hover:ring-github-green transition-all"
                        title="Profile menu"
                      />
                    </button>
                    {isProfileDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-github-dark border border-github-dark-border rounded-lg shadow-lg z-50 overflow-hidden">
                        <button
                          onClick={handleVisitGitHub}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-github-dark-hover hover:text-white transition-colors flex items-center gap-2"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                          Visit GitHub Profile
                        </button>
                        <div className="border-t border-github-dark-border"></div>
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-github-dark-hover hover:text-white transition-colors flex items-center gap-2"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                            />
                          </svg>
                          Log out
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                pathname !== "/" && (
                  <button
                    onClick={() => signIn("github")}
                    className="px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-md text-sm font-medium transition-colors"
                  >
                    Sign in with GitHub
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navbar */}
      {session && (
        <nav className="md:hidden bg-github-dark border-t border-github-dark-border safe-area-inset-bottom flex-shrink-0">
          <div className="flex items-center justify-around h-16 px-2">
            <Link
              href="/dashboard"
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 px-2 transition-colors ${
                isActive("/dashboard")
                  ? "text-github-green"
                  : "text-gray-400 active:text-white"
              }`}
            >
              <svg
                className="w-6 h-6 mb-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span className="text-[10px] font-medium">Dashboard</span>
            </Link>
            <Link
              href="/entries"
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 px-2 transition-colors ${
                isActive("/entries")
                  ? "text-github-green"
                  : "text-gray-400 active:text-white"
              }`}
            >
              <svg
                className="w-6 h-6 mb-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="text-[10px] font-medium">Entries</span>
            </Link>
            <Link
              href="/chatbots"
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-0 px-2 transition-colors ${
                isActive("/chatbots")
                  ? "text-github-green"
                  : "text-gray-400 active:text-white"
              }`}
            >
              <svg
                className="w-6 h-6 mb-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              <span className="text-[10px] font-medium">Chatbots</span>
            </Link>
            <div className="relative flex flex-col items-center justify-center flex-1 h-full min-w-0 px-2" ref={mobileProfileDropdownRef}>
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex flex-col items-center justify-center"
              >
                <Image
                  src={session.user?.image || "/icons/app-icon.png"}
                  alt={session.user?.name || "User"}
                  width={24}
                  height={24}
                  className={`w-6 h-6 rounded-full mb-1 transition-all ${
                    isProfileDropdownOpen ? "ring-2 ring-github-green" : ""
                  }`}
                />
                <span className="text-[10px] font-medium text-gray-400">Profile</span>
              </button>
              {isProfileDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 bg-black/50 z-[60]"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsProfileDropdownOpen(false);
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsProfileDropdownOpen(false);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  />
                  <div 
                    className="absolute bottom-full right-4 mb-2 w-[calc(100vw-2rem)] max-w-48 bg-github-dark border border-github-dark-border rounded-lg shadow-lg z-[65] overflow-hidden"
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleVisitGitHub();
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleVisitGitHub();
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-github-dark-hover active:bg-github-dark-hover hover:text-white transition-colors flex items-center gap-2 touch-manipulation"
                    >
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                      <span className="truncate">Visit GitHub Profile</span>
                    </button>
                    <div className="border-t border-github-dark-border"></div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSignOut();
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSignOut();
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-github-dark-hover active:bg-github-dark-hover hover:text-white transition-colors flex items-center gap-2 touch-manipulation"
                    >
                      <svg
                        className="w-4 h-4 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                      <span className="truncate">Log out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </nav>
      )}

    </>
  );
}

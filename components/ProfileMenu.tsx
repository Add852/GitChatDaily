"use client";

import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";

interface ProfileMenuProps {
  className?: string;
}

export function ProfileMenu({ className = "" }: ProfileMenuProps) {
  const { data: session } = useSession();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
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

  if (!session) return null;

  return (
    <div className={`relative ${className}`} ref={profileDropdownRef}>
      <button
        onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
        className="flex items-center focus:outline-none"
        aria-label="Profile menu"
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
        <>
          {/* Overlay - prevents clicks from reaching elements behind */}
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
          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-48 bg-github-dark border border-github-dark-border rounded-lg shadow-lg z-[65] overflow-hidden">
            <button
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
              className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-github-dark-hover hover:text-white transition-colors flex items-center gap-2 touch-manipulation"
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
              className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-github-dark-hover hover:text-white transition-colors flex items-center gap-2 touch-manipulation"
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
        </>
      )}
    </div>
  );
}


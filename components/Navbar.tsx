"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <nav className="bg-github-dark border-b border-github-dark-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/icons/app-icon.svg" alt="GitChat Journal logo" className="w-10 h-10" />
              <span className="text-xl font-semibold">GitChat Journal</span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            {session ? (
              <>
                <Link
                  href="/dashboard"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === "/dashboard"
                      ? "bg-github-dark-hover text-white"
                      : "text-gray-300 hover:bg-github-dark-hover hover:text-white"
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/journal"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === "/journal"
                      ? "bg-github-dark-hover text-white"
                      : "text-gray-300 hover:bg-github-dark-hover hover:text-white"
                  }`}
                >
                  New Entry
                </Link>
                <Link
                  href="/entries"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === "/entries"
                      ? "bg-github-dark-hover text-white"
                      : "text-gray-300 hover:bg-github-dark-hover hover:text-white"
                  }`}
                >
                  Entries
                </Link>
                <Link
                  href="/profiles"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    pathname === "/profiles"
                      ? "bg-github-dark-hover text-white"
                      : "text-gray-300 hover:bg-github-dark-hover hover:text-white"
                  }`}
                >
                  Profiles
                </Link>
                <div className="flex items-center space-x-3">
                  <a
                    href={`https://github.com/${(session.user as any)?.username || session.user?.name || ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <img
                      src={session.user?.image || ""}
                      alt={session.user?.name || ""}
                      className="w-8 h-8 rounded-full cursor-pointer"
                      title={`View ${(session.user as any)?.username || session.user?.name}'s GitHub profile`}
                    />
                  </a>
                  <button
                    onClick={() => signOut()}
                    className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-github-dark-hover hover:text-white"
                  >
                    Sign Out
                  </button>
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
  );
}


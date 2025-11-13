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
              <svg
                className="w-8 h-8"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
                  clipRule="evenodd"
                />
              </svg>
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
                  <img
                    src={session.user?.image || ""}
                    alt={session.user?.name || ""}
                    className="w-8 h-8 rounded-full"
                  />
                  <button
                    onClick={() => signOut()}
                    className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-github-dark-hover hover:text-white"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => signIn("github")}
                className="px-4 py-2 bg-github-green hover:bg-github-green-hover text-white rounded-md text-sm font-medium transition-colors"
              >
                Sign in with GitHub
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}


"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();
  
  // Only show footer on dashboard
  if (pathname !== "/dashboard") {
    return null;
  }

  return (
    <footer className="bg-github-dark border-t border-github-dark-border mt-12">
      <div className="max-w-7xl mx-auto px-4 py-6 md:px-4 md:py-6 pr-20 md:pr-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-sm text-gray-500">
        <p>© {new Date().getFullYear()} GitChat Journal. Built with focus and empathy.</p>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">
          <span className="text-gray-400">Submitted for HackNode 2025</span>
          <a
            href="https://github.com/Add852/GitChatDaily"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Source
          </a>
          <Link
            href="/contact"
            className="hover:text-white transition-colors"
          >
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}


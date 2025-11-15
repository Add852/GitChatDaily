"use client";

export function Footer() {
  return (
    <footer className="bg-github-dark border-t border-github-dark-border mt-12">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-gray-500">
        <p>© {new Date().getFullYear()} GitChat Journal. Built with focus and empathy.</p>
        <div className="flex items-center gap-4">
          <span className="text-gray-400">Submitted for HackNode 2025</span>
          <a
            href="https://github.com/Add852/GitChatDaily"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Source
          </a>
          <a
            href="https://github.com/Add852"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}


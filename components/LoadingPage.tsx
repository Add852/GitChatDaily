"use client";

export function LoadingPage() {
  return (
    <div className="fixed inset-0 bg-github-dark flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-6">
        {/* Animated Logo */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24">
          <div className="absolute inset-0 rounded-full border-4 border-github-green border-t-transparent animate-spin" />
          <div className="absolute inset-2 rounded-full border-4 border-github-green/50 border-b-transparent animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-10 h-10 sm:w-12 sm:h-12 text-github-green"
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
          </div>
        </div>

        {/* Loading Text */}
        <div className="text-center space-y-2">
          <h2 className="text-xl sm:text-2xl font-semibold text-white">
            Loading GitChat Journal
          </h2>
          <p className="text-sm sm:text-base text-gray-400 animate-pulse">
            Syncing your data...
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-64 sm:w-80 h-1 bg-github-dark-hover rounded-full overflow-hidden">
          <div className="h-full bg-github-green rounded-full animate-progress-bar" />
        </div>
      </div>
    </div>
  );
}


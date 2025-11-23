export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-github-dark-hover rounded ${className}`} />
  );
}

export function ContributionGraphSkeleton() {
  return (
    <div className="bg-github-dark border border-github-dark-border rounded-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4">
        <Skeleton className="h-6 sm:h-7 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-end gap-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1">
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton key={j} className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 sm:mt-4 flex items-center justify-between">
        <Skeleton className="h-4 w-8" />
        <div className="flex gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm" />
          ))}
        </div>
        <Skeleton className="h-4 w-8" />
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-github-dark-hover border border-github-dark-border rounded-lg p-4 sm:p-6 space-y-3">
      <Skeleton className="h-5 sm:h-6 w-32" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export function EntryCardSkeleton() {
  return (
    <div className="bg-github-dark border border-github-dark-border rounded-lg p-4 sm:p-6">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full mt-2" />
      <Skeleton className="h-4 w-2/3 mt-2" />
    </div>
  );
}

export function ChatbotInterfaceSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row h-full gap-4">
      <div className="flex flex-col flex-1 h-full bg-github-dark border border-github-dark-border rounded-lg">
        <div className="p-3 sm:p-4 border-b border-github-dark-border">
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex-1 p-4 flex items-center justify-center">
          <div className="text-gray-400">Loading...</div>
        </div>
        {/* Input area is static, no skeleton needed */}
      </div>
    </div>
  );
}


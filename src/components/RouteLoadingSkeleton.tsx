export function RouteLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="space-y-4"
    >
      <div className="coach-surface grid overflow-hidden lg:grid-cols-[minmax(22rem,0.95fr)_repeat(3,minmax(0,1fr))]">
        <div className="space-y-4 bg-[#f5f8fb] p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 animate-pulse rounded-lg bg-slate-200" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
              <div className="h-8 w-4/5 animate-pulse rounded bg-slate-200" />
              <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
            </div>
          </div>
          <div className="h-5 w-11/12 animate-pulse rounded bg-slate-200" />
          <div className="h-11 w-full animate-pulse rounded bg-slate-200" />
        </div>
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="space-y-5 border-t border-[#d8e2ea] bg-white p-4 sm:p-5 lg:border-l lg:border-t-0"
          >
            <div className="h-12 w-12 animate-pulse rounded-lg bg-slate-200" />
            <div className="space-y-3">
              <div className="h-7 w-4/5 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

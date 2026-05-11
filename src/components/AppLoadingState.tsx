function LoadingCard({ wide = false }: { wide?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-[#d8e2ea] bg-white p-3 shadow-sm ${
        wide ? "md:col-span-2" : ""
      }`}
    >
      <div className="h-3 w-28 rounded-full bg-slate-200" />
      <div className="mt-4 h-8 w-20 rounded-md bg-slate-200" />
      <div className="mt-4 space-y-2">
        <div className="h-3 rounded-full bg-slate-100" />
        <div className="h-3 w-4/5 rounded-full bg-slate-100" />
        <div className="h-3 w-2/3 rounded-full bg-slate-100" />
      </div>
    </div>
  );
}

export function AppLoadingState() {
  return (
    <div className="animate-pulse">
      <div className="mb-3 border-b border-[#d8e2ea] pb-4">
        <div className="h-7 w-64 max-w-full rounded-md bg-slate-200" />
        <div className="mt-3 h-3 w-[34rem] max-w-full rounded-full bg-slate-100" />
      </div>

      <section className="mb-4 overflow-hidden rounded-lg border border-[#d8e2ea] bg-white shadow-sm">
        <div className="border-b border-[#d8e2ea] p-4">
          <div className="h-4 w-36 rounded-full bg-slate-200" />
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="h-16 rounded-lg border border-slate-100 bg-slate-50" />
            <div className="h-16 rounded-lg border border-slate-100 bg-slate-50" />
            <div className="h-16 rounded-lg border border-slate-100 bg-slate-50" />
            <div className="h-16 rounded-lg border border-slate-100 bg-slate-50" />
          </div>
        </div>
        <div className="grid gap-3 p-3 xl:grid-cols-[0.9fr_1.1fr]">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard wide />
        </div>
      </section>
    </div>
  );
}

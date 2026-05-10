export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="coach-surface rounded-2xl p-3 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 max-w-4xl">
          <div className="coach-kicker mb-2">State-week command</div>
          <h1 className="text-[1.65rem] font-semibold leading-[1.05] tracking-normal text-[#08111f] sm:text-[2rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-[0.95rem] sm:leading-7">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="grid w-full grid-cols-2 gap-2 xl:flex xl:w-[min(58rem,58vw)] xl:flex-wrap xl:justify-end">
            {actions}
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}

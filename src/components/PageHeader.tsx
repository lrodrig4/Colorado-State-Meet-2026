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
    <div className="mb-3">
      <div className="app-page-header">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-4xl">
            <h1 className="text-[1.45rem] font-semibold leading-tight tracking-normal text-[#08111f] sm:text-[1.9rem]">
              {title}
            </h1>
            {description ? (
              <p className="mt-1.5 max-w-3xl text-base leading-7 text-slate-600">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="app-page-actions">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}

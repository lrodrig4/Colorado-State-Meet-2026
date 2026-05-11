import type { ReactNode } from "react";

type ClassValue = string | false | null | undefined;

type SimpleStep = {
  title: string;
  detail: string;
};

export function cn(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}

export function AppPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("app-panel", className)}>{children}</section>;
}

export function AppPanelHeader({
  label,
  title,
  description,
  actions,
  className,
}: {
  label?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("app-panel-header", className)}>
      <div className="min-w-0">
        {label ? <div className="coach-kicker">{label}</div> : null}
        <h2 className="mt-1 text-base font-semibold tracking-normal text-slate-950">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="app-panel-actions">{actions}</div> : null}
    </div>
  );
}

export function AppToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("app-toolbar", className)}>{children}</div>;
}

export function FieldShell({
  icon,
  label,
  children,
  className,
}: {
  icon?: ReactNode;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("app-field", className)}>
      <div className="app-field-label">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

export function SimpleSteps({
  title = "Do this",
  steps,
  className,
}: {
  title?: string;
  steps: SimpleStep[];
  className?: string;
}) {
  return (
    <section className={cn("app-panel mb-4 border-l-4 border-l-[#0f8a5f] p-3", className)}>
      <div className="grid gap-3 lg:grid-cols-[8rem_minmax(0,1fr)] lg:items-center">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <ol className="grid gap-2 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={`${step.title}-${index}`}
              className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2 rounded-md bg-[#f6faf8] p-2"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#08233f] text-base font-semibold tabular-nums text-white">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-base font-semibold text-slate-950">
                  {step.title}
                </span>
                <span className="mt-0.5 block text-sm leading-5 text-slate-600">
                  {step.detail}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

import { CloudSun, ExternalLink } from "lucide-react";
import { weekendWeatherOutlooks } from "@/lib/data/weekendWeather";

function biasClass(trackBias: "favorable" | "watch" | "caution") {
  if (trackBias === "favorable") return "bg-emerald-50 text-emerald-800";
  if (trackBias === "watch") return "bg-amber-50 text-amber-900";
  return "bg-rose-50 text-rose-800";
}

export function WeekendWeatherPanel() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
              <CloudSun size={18} className="text-[#16324f]" />
              Weekend weather bias
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              These conditions are used as a planning modifier, not as a
              guarantee. Refresh this before entries lock if the forecast moves.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            NWS pull May 3
          </span>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-2">
        {weekendWeatherOutlooks.map((outlook) => (
          <div
            key={outlook.meetName}
            className="border-b border-slate-200 p-5 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  {outlook.meetName}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {outlook.dateLabel} · {outlook.venueLabel}
                </p>
              </div>
              <a
                href={outlook.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#2f6f5e]"
              >
                NWS hourly <ExternalLink size={13} />
              </a>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {outlook.summary}
            </p>
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-950">
              {outlook.coachBias}
            </div>

            <div className="mt-4 grid gap-2">
              {outlook.windows.map((window) => (
                <div
                  key={`${outlook.meetName}-${window.label}`}
                  className="rounded-md border border-slate-200 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-950">
                      {window.label}
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${biasClass(
                        window.trackBias,
                      )}`}
                    >
                      {window.trackBias}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                    <span>{window.timeRange}</span>
                    <span>{window.temperatureLabel}</span>
                    <span>
                      {window.windLabel}, rain {window.precipLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    {window.note}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

import { CalendarClock, ListChecks, Target } from "lucide-react";
import type {
  WeekendMeetEventForecast,
  WeekendMeetForecastTone,
} from "@/lib/services/weekendStrategy";

function toneClass(tone: WeekendMeetForecastTone) {
  if (tone === "green") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (tone === "amber") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (tone === "rose") return "bg-rose-50 text-rose-800 ring-rose-200";
  if (tone === "sky") return "bg-sky-50 text-sky-800 ring-sky-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export function HokaEventForecastPanel({
  forecasts,
  focusTeam,
}: {
  forecasts: WeekendMeetEventForecast[];
  focusTeam: string;
}) {
  const likelyCount = forecasts.reduce(
    (sum, forecast) => sum + forecast.expectedCount,
    0,
  );
  const watchCount = forecasts.reduce(
    (sum, forecast) => sum + forecast.watchCount,
    0,
  );
  const eventCount = forecasts.length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
              <CalendarClock size={18} className="text-[#16324f]" />
              Predicted HOKA St. Vrain fields
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Team-attendance projection only: this uses the HOKA registered
              team list, current top-18/bubble data, hold odds, improve odds,
              and event load. It is not a confirmed entry list.
            </p>
          </div>
          <span className="rounded-full bg-[#f0faf6] px-3 py-1 text-xs font-semibold text-[#2f6f5e]">
            {focusTeam} highlighted
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Events modeled
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
              {eventCount}
            </div>
          </div>
          <div className="rounded-lg bg-rose-50 p-3">
            <div className="text-xs font-semibold uppercase text-rose-700">
              Likely run calls
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
              {likelyCount}
            </div>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <div className="text-xs font-semibold uppercase text-amber-700">
              Watch / coach calls
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
              {watchCount}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-2">
        {forecasts.map((forecast) => (
          <details
            key={forecast.id}
            className="group rounded-lg border border-slate-200 bg-white"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-3 sm:p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-950">
                    {forecast.eventLabel}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {forecast.confidenceLabel}
                  </span>
                </div>
                <div className="mt-1 flex items-start gap-2 text-xs leading-5 text-slate-600">
                  <CalendarClock size={14} className="mt-0.5 shrink-0" />
                  <span>{forecast.slotLabel}</span>
                </div>
              </div>
              <div className="shrink-0 rounded-md bg-slate-50 px-2.5 py-1 text-right">
                <div className="text-lg font-semibold tabular-nums text-slate-950">
                  {forecast.expectedCount}
                </div>
                <div className="text-[11px] font-semibold uppercase text-slate-500">
                  likely
                </div>
              </div>
            </summary>

            <div className="border-t border-slate-100 px-3 pb-3 sm:px-4 sm:pb-4">
              <div className="mt-3 flex items-start gap-2 rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                <ListChecks size={16} className="mt-1 shrink-0 text-[#2f6f5e]" />
                {forecast.summary}
              </div>

              <div className="mt-3 space-y-2">
                {forecast.entries.slice(0, 6).map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-lg border p-3 ${
                      entry.isFocusTeam
                        ? "border-[#2f6f5e] bg-[#f0faf6]"
                        : "border-slate-100 bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-950">
                          {entry.athleteOrRelay}
                        </div>
                        <div className="mt-0.5 text-sm text-slate-600">
                          {entry.school}
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <div className="text-sm font-semibold tabular-nums text-slate-950">
                          {entry.markRaw}
                        </div>
                        <div className="text-xs text-slate-500">
                          {entry.rankLabel}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${toneClass(
                          entry.tone,
                        )}`}
                      >
                        {entry.callLabel}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        <Target size={13} />
                        {entry.probabilityLabel} run guess
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">
                      {entry.reason}
                    </p>
                  </div>
                ))}
                {forecast.entries.length > 6 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-3 text-xs font-semibold text-slate-500">
                    {forecast.entries.length - 6} more projected HOKA field
                    calls are hidden in this phone preview.
                  </div>
                ) : null}

                {!forecast.entries.length ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm leading-6 text-slate-600">
                    No athlete or relay from a HOKA-attending team has a strong
                    top-50 state-relevant signal in this selected division yet.
                  </div>
                ) : null}
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

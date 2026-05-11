import Link from "next/link";
import { CalendarDays, ExternalLink, ListChecks } from "lucide-react";
import type { WeekendMeetFieldSummary } from "@/lib/services/weekendStrategy";

function groupByMeet(summaries: WeekendMeetFieldSummary[]) {
  const grouped = new Map<string, WeekendMeetFieldSummary[]>();

  for (const summary of summaries) {
    grouped.set(summary.meetName, [...(grouped.get(summary.meetName) ?? []), summary]);
  }

  return [...grouped.entries()].map(([meetName, meetSummaries]) => ({
    meetName,
    meetDate: meetSummaries[0]?.meetDate ?? "",
    sourceUrl: meetSummaries[0]?.sourceUrl ?? "",
    summaries: meetSummaries,
  }));
}

function shortDate(value: string) {
  if (value === "2026-05-09") return "Saturday";
  if (value === "2026-05-08") return "Friday";
  return value;
}

export function WeekendEntryMeetPanel({
  summaries,
  focusTeam,
}: {
  summaries: WeekendMeetFieldSummary[];
  focusTeam: string;
}) {
  const meets = groupByMeet(summaries);
  const fieldCount = summaries.reduce((sum, summary) => sum + summary.entryCount, 0);
  const focusCount = summaries.reduce(
    (sum, summary) => sum + summary.focusEntryCount,
    0,
  );
  const stateRelevantCount = summaries.reduce(
    (sum, summary) => sum + summary.stateRelevantCount,
    0,
  );

  if (!summaries.length) return null;

  return (
    <section className="coach-surface rounded-lg">
      <div className="border-b border-slate-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
              <ListChecks size={18} className="text-[#16324f]" />
              Weekend entries
            </div>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600">
              These are public weekend entries. They help planning, but they do
              not change official rankings until results post.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {focusTeam}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Entries
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
              {fieldCount}
            </div>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <div className="text-xs font-semibold uppercase text-emerald-700">
              Team
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
              {focusCount}
            </div>
          </div>
          <div className="rounded-xl bg-rose-50 p-3">
            <div className="text-xs font-semibold uppercase text-rose-700">
              State watch
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
              {stateRelevantCount}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-3 sm:p-4 xl:grid-cols-3">
        {meets.map((meet) => (
          <details
            key={meet.meetName}
            className="group rounded-xl border border-slate-200 bg-white"
          >
            <summary className="cursor-pointer list-none p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-base font-semibold text-slate-950">
                    <CalendarDays size={17} className="text-[#2f6f5e]" />
                    {meet.meetName}
                  </div>
                  <p className="mt-1 text-xs font-semibold uppercase text-slate-500">
                    {shortDate(meet.meetDate)} · {meet.summaries.length} events
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  Tap
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {meet.summaries
                  .slice(0, 2)
                  .map((summary) => `${summary.eventLabel}: ${summary.fieldStrengthLabel}`)
                  .join("; ")}
                {meet.summaries.length > 2 ? "." : ""}
              </p>
            </summary>

            <div className="space-y-3 border-t border-slate-100 p-3">
              {meet.sourceUrl ? (
                <Link
                  href={meet.sourceUrl}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#2f6f5e]"
                  target="_blank"
                >
                  Open entries <ExternalLink size={13} />
                </Link>
              ) : null}

              {meet.summaries.slice(0, 18).map((summary) => (
                <details
                  key={summary.id}
                  className="rounded-lg border border-slate-200 bg-slate-50"
                >
                  <summary className="cursor-pointer list-none p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">
                          {summary.eventLabel}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {summary.entryCount} entries · {summary.fieldStrengthLabel}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                        {summary.focusEntryCount
                          ? `${summary.focusEntryCount} team`
                          : `${summary.stateRelevantCount} watch`}
                      </span>
                    </div>
                  </summary>

                  <div className="border-t border-slate-200 p-3">
                    <p className="text-xs leading-5 text-slate-600">
                      {summary.summary}
                    </p>
                    <div className="mt-3 grid gap-2">
                      {summary.entries.slice(0, 8).map((entry) => (
                        <div
                          key={entry.id}
                          className={`rounded-md p-2 text-xs leading-5 ring-1 ${
                            entry.isFocusTeam
                              ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                              : "bg-white text-slate-700 ring-slate-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-950">
                                {entry.athleteOrRelay}
                              </div>
                              <div>{entry.school}</div>
                            </div>
                            <div className="shrink-0 text-right font-semibold tabular-nums text-slate-950">
                              {entry.seedMarkRaw ?? "No seed"}
                            </div>
                          </div>
                          <div className="mt-1 text-slate-600">
                            {entry.weekendChanceLabel
                              ? `${entry.weekendChanceLabel} state-mark chance. `
                              : ""}
                            {entry.reason}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

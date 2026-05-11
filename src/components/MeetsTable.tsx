import type { Meet } from "@/types/domain";

function formatMeetDate(meet: Meet) {
  if (meet.startDate && meet.endDate && meet.startDate !== meet.endDate) {
    return `${meet.startDate} - ${meet.endDate}`;
  }

  return meet.startDate ?? meet.date;
}

export function MeetsTable({ meets }: { meets: Meet[] }) {
  return (
    <section className="app-panel">
      <div className="grid gap-3 p-3 lg:hidden">
        {meets.map((meet) => (
          <article key={`${meet.id}-card`} className="rounded-lg border border-slate-200 p-3">
            <div className="text-base font-semibold text-slate-950">
              {meet.name}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {formatMeetDate(meet)} · {meet.location}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                {meet.eligibilityStatus ?? "eligible"}
              </span>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                {meet.discoveryStatus.replace("_", " ")}
              </span>
            </div>
            {meet.primaryResultsUrl ? (
              <a
                href={meet.primaryResultsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block break-words text-sm font-medium text-[#2f6f5e] hover:underline"
              >
                Results
              </a>
            ) : null}
          </article>
        ))}
      </div>
      <div className="hidden lg:block">
        <table className="app-data-table table-fixed">
          <colgroup>
            <col className="w-[21%]" />
            <col className="w-[13%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[17%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[5%]" />
          </colgroup>
          <thead>
            <tr>
              <th>Meet</th>
              <th>Date</th>
              <th>Location</th>
              <th>Counts?</th>
              <th>Results link</th>
              <th>Timing</th>
              <th>Found?</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {meets.map((meet) => (
              <tr key={meet.id} className="border-t border-slate-100">
                <td className="break-words">
                  <div className="font-medium text-slate-950">{meet.name}</div>
                  {meet.mileSplitUrl ? (
                    <a
                      href={meet.mileSplitUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-[#2f6f5e] hover:underline"
                    >
                      MileSplit page
                    </a>
                  ) : null}
                </td>
                <td className="tabular-nums">
                  <div>{formatMeetDate(meet)}</div>
                  {meet.rawDate ? (
                    <div className="text-xs text-slate-500">{meet.rawDate}</div>
                  ) : null}
                </td>
                <td className="break-words">{meet.location}</td>
                <td>
                  <div className="flex flex-col gap-1">
                    <span className="w-fit rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      {meet.eligibilityStatus ?? "eligible"}
                    </span>
                    {meet.statusLabel ? (
                      <span className="text-xs text-slate-500">
                        {meet.statusLabel}
                      </span>
                    ) : null}
                    {meet.registrationStatus ? (
                      <span className="text-xs text-slate-500">
                        {meet.registrationStatus}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="break-words">
                  {meet.primaryResultsUrl ? (
                    <a
                      href={meet.primaryResultsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all font-medium text-[#2f6f5e] hover:underline"
                    >
                      {meet.primaryResultsUrl}
                    </a>
                  ) : (
                    <span className="text-slate-500">
                      {meet.sourceUrlStatus === "pending_discovery"
                        ? "Pending discovery"
                        : "Not selected"}
                    </span>
                  )}
                </td>
                <td className="break-words">{meet.timingCompany ?? "Unknown"}</td>
                <td>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold">
                    {meet.discoveryStatus.replace("_", " ")}
                  </span>
                </td>
                <td className="break-words text-xs leading-5 text-slate-600">
                  {meet.notes ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

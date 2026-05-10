import type { Meet } from "@/types/domain";

function formatMeetDate(meet: Meet) {
  if (meet.startDate && meet.endDate && meet.startDate !== meet.endDate) {
    return `${meet.startDate} - ${meet.endDate}`;
  }

  return meet.startDate ?? meet.date;
}

export function MeetsTable({ meets }: { meets: Meet[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
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
        <table className="w-full table-fixed text-left text-sm">
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
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3">Meet</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Location</th>
              <th className="px-3 py-3">Eligibility</th>
              <th className="px-3 py-3">Primary results</th>
              <th className="px-3 py-3">Timing</th>
              <th className="px-3 py-3">Discovery</th>
              <th className="px-3 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {meets.map((meet) => (
              <tr key={meet.id} className="border-t border-slate-100">
                <td className="break-words px-3 py-3">
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
                <td className="px-3 py-3 tabular-nums">
                  <div>{formatMeetDate(meet)}</div>
                  {meet.rawDate ? (
                    <div className="text-xs text-slate-500">{meet.rawDate}</div>
                  ) : null}
                </td>
                <td className="break-words px-3 py-3">{meet.location}</td>
                <td className="px-3 py-3">
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
                <td className="break-words px-3 py-3">
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
                <td className="break-words px-3 py-3">{meet.timingCompany ?? "Unknown"}</td>
                <td className="px-3 py-3">
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold">
                    {meet.discoveryStatus.replace("_", " ")}
                  </span>
                </td>
                <td className="break-words px-3 py-3 text-xs leading-5 text-slate-600">
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

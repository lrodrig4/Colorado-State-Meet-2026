"use client";

import { useState } from "react";
import type {
  Performance,
  ReviewFlag,
  VerificationStatus,
} from "@/types/domain";
import { StatusBadge } from "@/components/StatusBadge";

export function ReviewTable({
  queue,
}: {
  queue: Array<{ performance: Performance; flags: ReviewFlag[] }>;
}) {
  const [decisions, setDecisions] = useState<Record<string, VerificationStatus>>(
    {},
  );

  function decide(id: string, status: VerificationStatus) {
    setDecisions((current) => ({ ...current, [id]: status }));
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-hidden">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[10%]" />
            <col className="w-[18%]" />
            <col className="w-[12%]" />
            <col className="w-[16%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3">Performance</th>
              <th className="px-3 py-3">School / class</th>
              <th className="px-3 py-3">Mark</th>
              <th className="px-3 py-3">Meet</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Flags</th>
              <th className="px-3 py-3">Decision</th>
            </tr>
          </thead>
          <tbody>
            {queue.map(({ performance, flags }) => {
              const status =
                decisions[performance.id] ?? performance.verificationStatus;

              return (
                <tr key={performance.id} className="border-t border-slate-100">
                  <td className="break-words px-3 py-3">
                    <div className="font-medium text-slate-950">
                      {performance.athleteName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {performance.gender} {performance.event}
                    </div>
                  </td>
                  <td className="break-words px-3 py-3">
                    <div>{performance.school}</div>
                    <div className="text-xs text-slate-500">
                      {performance.classification ?? "Unknown"} -{" "}
                      {performance.classificationVerified
                        ? "verified"
                        : "unverified"}
                    </div>
                  </td>
                  <td className="break-words px-3 py-3">
                    <div className="font-semibold tabular-nums">
                      {performance.markRaw}
                    </div>
                    <div className="text-xs text-slate-500">
                      {performance.timingType}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div>{performance.meetName}</div>
                    <div className="text-xs text-slate-500">
                      {performance.meetDate}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={status} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex max-w-xl flex-wrap gap-2">
                      {flags.map((flag) => (
                        <span
                          key={flag.id}
                          className={`rounded-md border px-2 py-1 text-xs font-medium ${
                            flag.severity === "high"
                              ? "border-red-200 bg-red-50 text-red-700"
                              : flag.severity === "medium"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-slate-200 bg-slate-50 text-slate-700"
                          }`}
                        >
                          {flag.reason}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => decide(performance.id, "manual_approved")}
                        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(performance.id, "rejected")}
                        className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

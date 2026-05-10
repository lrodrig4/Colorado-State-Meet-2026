"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, Clipboard, Download, Search } from "lucide-react";
import type { RankingRow } from "@/types/domain";
import { getEventDefinition } from "@/lib/data/events";
import { toCsv } from "@/lib/utils/csv";
import { comparePerformanceMarks } from "@/lib/utils/time";
import { StatusBadge } from "@/components/StatusBadge";

type SortKey = "rank" | "athleteName" | "school" | "markValue" | "meetDate";

const columns = [
  { key: "rank", header: "Rank" },
  { key: "athleteName", header: "Athlete" },
  { key: "grade", header: "Grade" },
  { key: "school", header: "School" },
  { key: "classification", header: "Classification" },
  { key: "markRaw", header: "Mark" },
  { key: "meetName", header: "Meet" },
  { key: "meetDate", header: "Date" },
  { key: "source", header: "Source" },
  { key: "verificationStatus", header: "Verification" },
  { key: "notes", header: "Notes" },
] as const;

function sortRows(rows: RankingRow[], key: SortKey, direction: "asc" | "desc") {
  return [...rows].sort((a, b) => {
    if (key === "markValue") {
      const numeric = comparePerformanceMarks(a.event, a.markValue, b.markValue);
      return direction === "asc" ? numeric : numeric * -1;
    }

    const aValue = a[key];
    const bValue = b[key];
    const numeric =
      typeof aValue === "number" && typeof bValue === "number"
        ? aValue - bValue
        : String(aValue ?? "").localeCompare(String(bValue ?? ""));

    return direction === "asc" ? numeric : numeric * -1;
  });
}

function rowsToCsv(rows: RankingRow[]) {
  return toCsv(
    rows.map((row) => ({
      rank: row.rank,
      athleteName: row.athleteName,
      grade: row.grade ?? "",
      school: row.school,
      classification: row.classification ?? "",
      markRaw: row.markRaw,
      meetName: row.meetName,
      meetDate: row.meetDate,
      source: row.source,
      verificationStatus: row.verificationStatus,
      notes: row.notes ?? "",
    })),
    columns,
  );
}

export function RankingTable({
  title,
  rows,
  bubbleRows = [],
}: {
  title: string;
  rows: RankingRow[];
  bubbleRows?: RankingRow[];
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [copied, setCopied] = useState(false);
  const allRows = useMemo(() => [...rows, ...bubbleRows], [rows, bubbleRows]);

  const visibleRows = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    const filtered = normalized
      ? allRows.filter((row) =>
          [
            row.athleteName,
            row.school,
            row.meetName,
            row.markRaw,
            row.verificationStatus,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalized),
        )
      : allRows;

    return sortRows(filtered, sortKey, direction);
  }, [allRows, direction, query, sortKey]);

  const csv = rowsToCsv(visibleRows);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setDirection("asc");
  }

  function downloadCsv() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyCsv() {
    await navigator.clipboard.writeText(csv);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="coach-surface overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            Top 18 plus next {bubbleRows.length} bubble, season-best per athlete
            or relay team.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter table"
              className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#2f6f5e] focus:ring-2 focus:ring-[#2f6f5e]/15 sm:w-56"
            />
          </label>
          <button
            type="button"
            onClick={copyCsv}
            className="coach-action inline-flex items-center justify-center gap-2 border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Clipboard size={16} />
            {copied ? "Copied" : "Copy CSV"}
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="coach-action inline-flex items-center justify-center gap-2 bg-[#102b47] px-3 text-sm text-white hover:bg-[#204365]"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      <div className="grid gap-3 p-3 lg:hidden">
        {visibleRows.map((row) => (
          <article
            key={`${row.id}-card`}
            className={`rounded-2xl border border-slate-200 p-3 shadow-sm ${
              row.isBubble ? "bg-amber-50/60" : "bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase text-slate-500">
                  {row.isBubble ? `Bubble ${row.rank - 18}` : `Rank ${row.rank}`}
                </div>
                <div className="mt-1 break-words text-base font-semibold text-slate-950">
                  {row.athleteName}
                </div>
                <div className="mt-1 break-words text-sm text-slate-600">
                  {row.school}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {getEventDefinition(row.event).relay
                    ? "Relay team"
                    : row.grade
                      ? `Grade ${row.grade}`
                      : "Grade unknown"}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xl font-semibold tabular-nums text-slate-950">
                  {row.markRaw}
                </div>
                <div className="text-xs text-slate-500">{row.meetDate}</div>
              </div>
            </div>
            <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <div>
                <span className="font-semibold text-slate-950">Meet:</span>{" "}
                <span className="break-words">{row.meetName}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-950">Source:</span>
                {row.sourceUrl ? (
                  <a
                    href={row.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[#2f6f5e] hover:underline"
                  >
                    {row.source.replace("_", " ")}
                  </a>
                ) : (
                  row.source.replace("_", " ")
                )}
                <StatusBadge status={row.verificationStatus} />
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden lg:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[7%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            <col className="w-[20%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
          </colgroup>
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {[
                ["rank", "Rank"],
                ["athleteName", "Athlete"],
                ["school", "School"],
                ["markValue", "Mark"],
                ["meetDate", "Date"],
              ].map(([key, label]) => (
                <th key={key} className="px-3 py-3 font-semibold">
                  <button
                    type="button"
                    onClick={() => handleSort(key as SortKey)}
                    className="inline-flex items-center gap-2"
                  >
                    {label}
                    <ArrowDownUp size={13} />
                  </button>
                </th>
              ))}
              <th className="px-3 py-3 font-semibold">Meet</th>
              <th className="px-3 py-3 font-semibold">Source</th>
              <th className="px-3 py-3 font-semibold">Verification</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.id}
                className={`border-t border-slate-100 ${
                  row.isBubble ? "bg-amber-50/50" : "bg-white"
                }`}
              >
                <td className="px-3 py-3 font-semibold text-slate-950">
                  {row.isBubble ? `B${row.rank - 18}` : row.rank}
                </td>
                <td className="break-words px-3 py-3">
                  <div className="font-medium text-slate-950">
                    {row.athleteName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {getEventDefinition(row.event).relay
                      ? "Relay team"
                      : row.grade
                        ? `Grade ${row.grade}`
                        : "Grade unknown"}
                  </div>
                </td>
                <td className="break-words px-3 py-3">
                  <div>{row.school}</div>
                  <div className="text-xs text-slate-500">
                    {row.classification ?? "Unknown"} classification
                  </div>
                </td>
                <td className="px-3 py-3 font-semibold tabular-nums">
                  {row.markRaw}
                </td>
                <td className="px-3 py-3 tabular-nums">{row.meetDate}</td>
                <td className="break-words px-3 py-3">{row.meetName}</td>
                <td className="px-3 py-3">
                  {row.sourceUrl ? (
                    <a
                      href={row.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-[#2f6f5e] hover:underline"
                    >
                      {row.source.replace("_", " ")}
                    </a>
                  ) : (
                    row.source.replace("_", " ")
                  )}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={row.verificationStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

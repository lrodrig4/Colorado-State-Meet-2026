"use client";

import { Fragment, useMemo, useState } from "react";
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
    <section className="app-panel">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            The state field, plus the next {bubbleRows.length} marks just outside.
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
              placeholder="Search name or school"
            className="app-input h-11 pl-9 sm:h-10 sm:w-56"
            />
          </label>
          <button
            type="button"
            onClick={copyCsv}
            className="coach-action app-button-secondary inline-flex items-center justify-center gap-2 px-3 text-sm"
          >
            <Clipboard size={16} />
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="coach-action app-button-navy inline-flex items-center justify-center gap-2 px-3 text-sm"
          >
            <Download size={16} />
            Download
          </button>
        </div>
      </div>

      <div className="lg:hidden">
        <div className="grid grid-cols-[3.35rem_minmax(0,1fr)_5.7rem] border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-normal text-slate-500">
          <div>Rank</div>
          <div>Athlete / school</div>
          <div className="text-right">Mark</div>
        </div>
        <div className="divide-y divide-slate-100">
          {visibleRows.map((row) => (
            <Fragment key={`${row.id}-mobile`}>
              <article
                className={`grid grid-cols-[3.35rem_minmax(0,1fr)_5.7rem] gap-2 px-3 py-3 ${
                  row.isBubble ? "bg-amber-50/58" : "bg-white"
                }`}
              >
                <div>
                  <div
                    className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold tabular-nums ${
                      row.isBubble
                        ? "bg-amber-100 text-amber-900"
                        : row.rank <= 9
                          ? "bg-[#0d2742] text-white"
                          : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {row.isBubble ? `B${row.rank - 18}` : row.rank}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-950">
                    {row.athleteName}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-600">
                    {row.school}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                    <span>
                      {getEventDefinition(row.event).relay
                        ? "Relay"
                        : row.grade
                          ? `Grade ${row.grade}`
                          : "Grade unknown"}
                    </span>
                    <span aria-hidden="true">/</span>
                    <span>{row.meetDate}</span>
                    <StatusBadge status={row.verificationStatus} />
                  </div>
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-base font-semibold tabular-nums text-slate-950">
                    {row.markRaw}
                  </div>
                  <div className="mt-1 truncate text-[11px] font-medium text-slate-500">
                    {row.meetName}
                  </div>
                </div>
              </article>
              {row.rank === 18 && !row.isBubble ? (
                <div className="border-y border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-normal text-amber-900">
                  Last state spot
                </div>
              ) : null}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="hidden lg:block">
        <table className="app-data-table table-fixed">
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
          <thead>
            <tr>
              {[
                ["rank", "Rank"],
                ["athleteName", "Athlete"],
                ["school", "School"],
                ["markValue", "Mark"],
                ["meetDate", "Date"],
              ].map(([key, label]) => (
                  <th key={key}>
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
              <th>Meet</th>
              <th>Source</th>
              <th>Verification</th>
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
                <td className="font-semibold text-slate-950">
                  {row.isBubble ? `B${row.rank - 18}` : row.rank}
                </td>
                <td className="break-words">
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
                <td className="break-words">
                  <div>{row.school}</div>
                  <div className="text-xs text-slate-500">
                    {row.classification ?? "Unknown"} classification
                  </div>
                </td>
                <td className="font-semibold tabular-nums">
                  {row.markRaw}
                </td>
                <td className="tabular-nums">{row.meetDate}</td>
                <td className="break-words">{row.meetName}</td>
                <td>
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
                <td>
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

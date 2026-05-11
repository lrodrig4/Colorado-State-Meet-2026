"use client";

import { useState } from "react";
import { LinkIcon, Loader2, PlusCircle, Search } from "lucide-react";
import type { Performance, SourceDiscoveryResult } from "@/types/domain";
import { StatusBadge } from "@/components/StatusBadge";

const samplePaste = `Boys 1600m
1 Logan Reid Niwot 4:12.84 FAT
2 Owen Morales Cheyenne Mountain 4:15.32 FAT

Girls 3200m
1 Nora Bennett - Niwot - 10:36.22 FAT

Boys 4x100m Relay
1 Niwot 42.12 FAT

Girls Long Jump
1 Amaya Lee - Longmont - 18-04.75`;

export function ImportTools() {
  const [text, setText] = useState(samplePaste);
  const [meetName, setMeetName] = useState("Manual imported meet");
  const [meetDate, setMeetDate] = useState("2026-04-25");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualResult, setManualResult] = useState<Performance[]>([]);
  const [manualError, setManualError] = useState("");
  const [discoveryUrl, setDiscoveryUrl] = useState("");
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discovery, setDiscovery] = useState<SourceDiscoveryResult | null>(null);
  const [discoveryError, setDiscoveryError] = useState("");

  async function parseManual() {
    setManualLoading(true);
    setManualError("");

    try {
      const response = await fetch("/api/import/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, meetName, meetDate }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Manual parse failed.");
      }
      setManualResult(payload.performances);
    } catch (error) {
      setManualError(error instanceof Error ? error.message : "Parse failed.");
    } finally {
      setManualLoading(false);
    }
  }

  async function discoverSources() {
    setDiscoveryLoading(true);
    setDiscoveryError("");
    setDiscovery(null);

    try {
      const response = await fetch("/api/discovery/source", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: discoveryUrl }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not find result links.");
      }
      setDiscovery(payload);
    } catch (error) {
      setDiscoveryError(
        error instanceof Error ? error.message : "Could not find result links.",
      );
    } finally {
      setDiscoveryLoading(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <section className="app-panel">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-base font-semibold">Paste results</h2>
          <p className="mt-1 text-sm text-slate-600">
            Paste copied meet results. The app turns them into rows to check.
          </p>
        </div>
        <div className="grid gap-4 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Meet name
              <input
                value={meetName}
                onChange={(event) => setMeetName(event.target.value)}
                className="app-input h-10"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Meet date
              <input
                type="date"
                value={meetDate}
                onChange={(event) => setMeetDate(event.target.value)}
                className="app-input h-10"
              />
            </label>
          </div>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={12}
            className="w-full rounded-md border border-slate-300 p-3 font-mono text-sm leading-6 outline-none focus:border-[#2f6f5e] focus:ring-2 focus:ring-[#2f6f5e]/15"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={parseManual}
              disabled={manualLoading}
              className="coach-action app-button-navy inline-flex h-10 items-center gap-2 px-4 text-sm disabled:opacity-60"
            >
              {manualLoading ? <Loader2 className="animate-spin" size={16} /> : <PlusCircle size={16} />}
              Read pasted results
            </button>
            {manualError ? (
              <span className="text-sm font-medium text-red-700">{manualError}</span>
            ) : null}
          </div>
          {manualResult.length > 0 ? (
            <div className="overflow-hidden rounded-md border border-slate-200">
                <table className="app-data-table table-fixed">
                <colgroup>
                  <col className="w-[22%]" />
                  <col className="w-[24%]" />
                  <col className="w-[17%]" />
                  <col className="w-[13%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Athlete</th>
                    <th>School</th>
                    <th>Event</th>
                    <th>Mark</th>
                    <th>Timing</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {manualResult.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="break-words font-medium">{row.athleteName}</td>
                      <td className="break-words">{row.school}</td>
                      <td className="break-words">{row.event}</td>
                      <td className="font-semibold tabular-nums">{row.markRaw}</td>
                      <td>{row.timingType}</td>
                      <td>
                        <StatusBadge status={row.verificationStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>

      <section className="app-panel">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-base font-semibold">Find result link</h2>
          <p className="mt-1 text-sm text-slate-600">
            Paste a meet page link. The app looks for the real results page.
          </p>
        </div>
        <div className="grid gap-4 p-4">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            MileSplit or meet page URL
            <div className="relative">
              <LinkIcon
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                value={discoveryUrl}
                onChange={(event) => setDiscoveryUrl(event.target.value)}
                placeholder="https://co.milesplit.com/meets/..."
                className="app-input h-10 pl-9"
              />
            </div>
          </label>
          <button
            type="button"
            onClick={discoverSources}
            disabled={!discoveryUrl || discoveryLoading}
            className="coach-action app-button-primary inline-flex h-10 items-center justify-center gap-2 px-4 text-sm disabled:opacity-60"
          >
            {discoveryLoading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
            Find results
          </button>
          {discoveryError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {discoveryError}
            </div>
          ) : null}
          {discovery ? (
            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="font-semibold">Best result link</div>
                <div className="mt-1 break-all text-slate-700">
                  {discovery.primaryResultsUrl ?? "No primary source found"}
                </div>
              </div>
              <div className="space-y-2">
                {discovery.discoveredSourceUrls.map((source) => (
                  <div
                    key={source.url}
                    className="rounded-md border border-slate-200 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{source.source.replace("_", " ")}</span>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold">
                        {source.score}
                      </span>
                    </div>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block break-all text-[#2f6f5e] hover:underline"
                    >
                      {source.url}
                    </a>
                    <div className="mt-2 text-xs text-slate-500">{source.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

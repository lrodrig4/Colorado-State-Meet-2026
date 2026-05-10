"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { AutoUpdatePolicy, IngestionRun } from "@/types/domain";

export function AutoUpdatePanel({ policy }: { policy: AutoUpdatePolicy }) {
  const [run, setRun] = useState<IngestionRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runNow() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ingestion/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Ingestion run failed.");
      }
      setRun(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ingestion failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Auto-update pipeline</h2>
          <p className="mt-1 text-sm text-slate-600">
            Vercel Cron checks sources every 30 minutes and rechecks after meet windows.
          </p>
        </div>
        <button
          type="button"
          onClick={runNow}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#2f6f5e] px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          Run dry check
        </button>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-3">
        {policy.providers.map((provider) => (
          <div key={provider.id} className="rounded-md border border-slate-200 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{provider.name}</div>
                <a
                  href={provider.coloradoScopeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block break-all text-xs font-medium text-[#2f6f5e] hover:underline"
                >
                  Colorado source
                </a>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold">
                {provider.refreshCadenceMinutes}m
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">
              {provider.notes}
            </p>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
        {policy.verificationRule}
      </div>
      {error ? (
        <div className="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {run ? (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <div className="font-semibold text-slate-950">
            Last run: {run.status} at {run.finishedAt}
          </div>
          <div className="mt-2 grid gap-2 text-slate-600 sm:grid-cols-4">
            <span>Meets: {run.meetsDiscovered}</span>
            <span>Sources: {run.sourceUrlsDiscovered}</span>
            <span>Candidates: {run.candidatePerformances}</span>
            <span>Flagged: {run.flaggedCandidates}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

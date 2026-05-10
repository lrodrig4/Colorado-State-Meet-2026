"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Users } from "lucide-react";
import { TeamDepthChartManager } from "@/components/TeamDepthChartManager";
import { shortSchoolName } from "@/lib/utils/focusTeam";
import { CLASSIFICATION_QUERY_PARAM } from "@/lib/utils/classificationScope";
import type { Classification } from "@/types/domain";
import type { TeamDepthChart } from "@/lib/services/depthChart";

export function DeferredTeamDepthChart({
  school,
  classification,
  athleteCount,
  eventCount,
  initialDepthChart,
}: {
  school: string;
  classification: Classification;
  athleteCount: number;
  eventCount: number;
  initialDepthChart?: TeamDepthChart;
}) {
  const [open, setOpen] = useState(false);
  const [fetchedDepthChart, setFetchedDepthChart] = useState<
    { school: string; chart: TeamDepthChart } | undefined
  >();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const depthChart =
    initialDepthChart ??
    (fetchedDepthChart?.school === school ? fetchedDepthChart.chart : undefined);

  useEffect(() => {
    if (window.location.hash === "#depth-chart") {
      const timer = window.setTimeout(() => setOpen(true), 0);
      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, []);

  useEffect(() => {
    if (!open || depthChart || loading) return;

    let cancelled = false;

    async function loadDepthChart() {
      setLoading(true);
      setError(undefined);

      try {
        const response = await fetch(
          `/api/team-depth-chart?team=${encodeURIComponent(
            school,
          )}&${CLASSIFICATION_QUERY_PARAM}=${classification}`,
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load team depth chart.");
        }

        if (!cancelled) {
          setFetchedDepthChart({
            school,
            chart: payload as TeamDepthChart,
          });
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load team depth chart.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDepthChart();

    return () => {
      cancelled = true;
    };
  }, [classification, depthChart, loading, open, school]);

  return (
    <details
      id="depth-chart"
      open={open}
      className="group scroll-mt-5 rounded-lg border border-slate-200 bg-white [contain-intrinsic-size:260px] [content-visibility:auto]"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#2f6f5e]">
            <Users size={18} />
            Depth chart and relay pools
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-normal text-slate-950">
            Load {shortSchoolName(school)} relay pools and editable event depth.
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Kept collapsed for speed. Opens {eventCount} event charts and top
            relay candidates for {athleteCount} athletes in CHSAA {classification}.
          </p>
        </div>
        <ChevronDown
          size={20}
          className="shrink-0 text-slate-500 transition group-open:rotate-180"
        />
      </summary>

      <div className="border-t border-slate-200">
        {error ? (
          <div className="p-5 text-sm font-semibold text-rose-700">{error}</div>
        ) : depthChart ? (
          <TeamDepthChartManager
            key={`${classification}-${school}`}
            depthChart={depthChart}
            embedded
          />
        ) : loading ? (
          <div className="flex items-center gap-2 p-5 text-sm font-semibold text-slate-600">
            <Loader2 className="animate-spin text-[#2f6f5e]" size={16} />
            Loading relay pools and depth charts...
          </div>
        ) : (
          <div className="p-5 text-sm text-slate-600">
            Open this panel when you need to edit missing athletes or check relay
            alternates.
          </div>
        )}
      </div>
    </details>
  );
}

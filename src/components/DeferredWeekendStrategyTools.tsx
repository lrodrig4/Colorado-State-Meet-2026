"use client";

import { useEffect, useState } from "react";
import { ChevronDown, GitBranch, Loader2 } from "lucide-react";
import { CoachScenarioAdvisor } from "@/components/CoachScenarioAdvisor";
import { IndividualDecisionFlowchart } from "@/components/IndividualDecisionFlowchart";
import { WeekendScenarioBracket } from "@/components/WeekendScenarioBracket";
import { CLASSIFICATION_QUERY_PARAM } from "@/lib/utils/classificationScope";
import type { WeekendStrategy } from "@/lib/services/weekendStrategy";
import type { Classification } from "@/types/domain";

export function DeferredWeekendStrategyTools({
  school,
  classification,
  athleteCount,
  relayCount,
  scenarioCount,
}: {
  school: string;
  classification: Classification;
  athleteCount: number;
  relayCount: number;
  scenarioCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [strategy, setStrategy] = useState<WeekendStrategy | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!open || strategy || loading) return;

    let cancelled = false;

    async function loadStrategy() {
      setLoading(true);
      setError(undefined);

      try {
        const response = await fetch(
          `/api/weekend-strategy?team=${encodeURIComponent(
            school,
          )}&${CLASSIFICATION_QUERY_PARAM}=${classification}`,
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load weekend planner.");
        }

        if (!cancelled) {
          setStrategy(payload as WeekendStrategy);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load weekend planner.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadStrategy();

    return () => {
      cancelled = true;
    };
  }, [classification, loading, open, school, strategy]);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="app-panel group [contain-intrinsic-size:280px] [content-visibility:auto]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
            <GitBranch size={18} className="text-[#16324f]" />
            Detailed decisions
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-normal text-slate-950">
            Open detailed plans only when you need them.
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Kept closed for speed. Opens {scenarioCount} plans, {athleteCount}{" "}
            athlete choices, and {relayCount} relay choices for {school}.
          </p>
        </div>
        <ChevronDown
          size={20}
          className="shrink-0 text-slate-500 transition group-open:rotate-180"
        />
      </summary>

      <div className="space-y-5 border-t border-slate-200 p-3 sm:p-4">
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : strategy ? (
          <>
            <WeekendScenarioBracket strategy={strategy} />
            <IndividualDecisionFlowchart
              athletePlans={strategy.athletePlans}
              relayPlans={strategy.relayPlans}
              focusTeam={strategy.focusTeam}
            />
            <CoachScenarioAdvisor
              key={strategy.focusTeam}
              strategy={strategy}
            />
          </>
        ) : loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
            <Loader2 className="animate-spin text-[#2f6f5e]" size={16} />
            Loading detailed plans...
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm leading-6 text-slate-600">
            Open this panel when you need more than the simple weekend summary.
          </div>
        )}
      </div>
    </details>
  );
}

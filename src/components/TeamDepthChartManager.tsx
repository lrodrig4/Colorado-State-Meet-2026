"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import { eventDefinitions } from "@/lib/data/events";
import {
  buildRelayProjectionsFromEventCharts,
  type DepthChartEntry,
  type EventDepthChart,
  type RelayDepthCandidate,
  type TeamDepthChart,
} from "@/lib/services/depthChart";
import { shortSchoolName } from "@/lib/utils/focusTeam";
import {
  comparePerformanceMarks,
  formatPerformanceValue,
  parsePerformanceMark,
} from "@/lib/utils/time";
import type { EventKey, Gender } from "@/types/domain";

type SavedEntry = DepthChartEntry & { manual: true };

const storagePrefix = "co.trackTeamDepthChart.v2";

const eventOptions = eventDefinitions.filter((definition) => !definition.relay);

function firstEventForGender(gender: Gender) {
  return eventOptions.find((definition) => definition.genders.includes(gender))
    ?.event ?? "100m";
}

function validEventForGender(event: EventKey, gender: Gender) {
  return Boolean(
    eventOptions.find(
      (definition) =>
        definition.event === event && definition.genders.includes(gender),
    ),
  );
}

function storageKey(classification: string, team: string) {
  return `${storagePrefix}:${classification}:${team}`;
}

function readSavedEntries(classification: string, team: string): SavedEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey(classification, team));
    return raw ? (JSON.parse(raw) as SavedEntry[]) : [];
  } catch {
    return [];
  }
}

function sourceBadgeClass(label: string) {
  if (/Direct/.test(label)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (/move up/i.test(label)) {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }

  if (/move down/i.test(label)) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function entryInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function mergeManualEntries(
  baseCharts: EventDepthChart[],
  savedEntries: SavedEntry[],
) {
  return baseCharts.map((chart) => {
    const matchingSaved = savedEntries.filter(
      (entry) => entry.gender === chart.gender && entry.event === chart.event,
    );
    const entries = [...chart.entries, ...matchingSaved]
      .sort((a, b) => comparePerformanceMarks(chart.event, a.markValue, b.markValue))
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    return {
      ...chart,
      entries,
    };
  });
}

function RelayCandidateRow({ candidate }: { candidate: RelayDepthCandidate }) {
  return (
    <div className="grid gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0f2a47] text-xs font-semibold text-white">
            {entryInitials(candidate.athleteName)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-950">
              {candidate.athleteName}
            </div>
            <div className="text-xs text-slate-500">
              {candidate.sourceEventLabel} · #{candidate.rank} · {candidate.markRaw}
              {candidate.manual ? " · saved" : ""}
            </div>
          </div>
        </div>
      </div>
      <span
        className={`w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${sourceBadgeClass(
          candidate.fitLabel,
        )}`}
      >
        {candidate.fitLabel}
      </span>
    </div>
  );
}

function EventDepthRows({
  chart,
  savedEntries,
  onRemoveSaved,
}: {
  chart: EventDepthChart;
  savedEntries: SavedEntry[];
  onRemoveSaved: (id: string) => void;
}) {
  const savedIds = new Set(savedEntries.map((entry) => entry.id));

  return (
    <div className="divide-y divide-slate-100">
      {chart.entries.map((entry) => (
        <div
          key={entry.id}
          className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-[44px_1fr_auto] sm:items-center"
        >
          <div className="text-lg font-semibold tabular-nums text-slate-950">
            {entry.rank}
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-950">
              {entry.athleteName}
            </div>
            <div className="text-xs text-slate-500">
              {entry.grade ? `${entry.grade} · ` : ""}
              {entry.meetName ?? "Saved on dashboard"}
              {entry.manual ? " · manual depth mark" : ""}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:justify-end">
            <div className="text-base font-semibold tabular-nums text-slate-950">
              {entry.markRaw}
            </div>
            {savedIds.has(entry.id) ? (
              <button
                type="button"
                onClick={() => onRemoveSaved(entry.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                aria-label={`Remove ${entry.athleteName}`}
              >
                <Trash2 size={14} />
              </button>
            ) : null}
          </div>
        </div>
      ))}
      {!chart.entries.length ? (
        <div className="px-4 py-4 text-sm text-slate-500">
          No verified or saved marks yet.
        </div>
      ) : null}
    </div>
  );
}

export function TeamDepthChartManager({
  depthChart,
  embedded = false,
}: {
  depthChart: TeamDepthChart;
  embedded?: boolean;
}) {
  const [selectedGender, setSelectedGender] = useState<Gender>("Boys");
  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>(() =>
    readSavedEntries(depthChart.classification, depthChart.school),
  );
  const [draftEntries, setDraftEntries] = useState<SavedEntry[]>(() =>
    readSavedEntries(depthChart.classification, depthChart.school),
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [openEventKeys, setOpenEventKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [form, setForm] = useState({
    gender: "Boys" as Gender,
    event: "800m" as EventKey,
    athleteName: "",
    markRaw: "",
    note: "",
  });
  const dirty = JSON.stringify(savedEntries) !== JSON.stringify(draftEntries);

  const mergedCharts = useMemo(
    () => mergeManualEntries(depthChart.eventCharts, draftEntries),
    [depthChart.eventCharts, draftEntries],
  );
  const relayProjections = useMemo(
    () => buildRelayProjectionsFromEventCharts(mergedCharts),
    [mergedCharts],
  );
  const chartsForGender = mergedCharts.filter(
    (chart) => chart.gender === selectedGender,
  );
  const relaysForGender = relayProjections.filter(
    (projection) => projection.gender === selectedGender,
  );
  const availableAthletes = useMemo(() => {
    const names = new Set<string>();
    for (const chart of chartsForGender) {
      for (const entry of chart.entries) {
        names.add(entry.athleteName);
      }
    }
    return names.size;
  }, [chartsForGender]);

  function addDraftEntry() {
    setError(undefined);
    const athleteName = form.athleteName.trim();
    const markRaw = form.markRaw.trim();
    const definition = eventDefinitions.find(
      (item) => item.event === form.event,
    );

    if (!athleteName) {
      setError("Add the athlete name first.");
      return;
    }

    if (!markRaw) {
      setError("Add the mark first.");
      return;
    }

    const markValue = parsePerformanceMark(form.event, markRaw);
    if (markValue === undefined) {
      setError(`That mark does not look valid for ${definition?.displayName}.`);
      return;
    }

    const entry: SavedEntry = {
      id: `saved-${Date.now()}-${athleteName}-${form.event}`.replaceAll(
        /[^a-zA-Z0-9_-]/g,
        "-",
      ),
      athleteName,
      school: depthChart.school,
      gender: form.gender,
      event: form.event,
      eventLabel: definition?.displayName ?? form.event,
      markRaw: formatPerformanceValue(form.event, markValue),
      markValue,
      rank: 999,
      fitLabel: "Saved mark",
      fitDetail:
        form.note.trim() ||
        "Coach-added depth mark saved locally on this dashboard.",
      meetName: form.note.trim() || "Saved on dashboard",
      manual: true,
    };

    setDraftEntries((entries) => [...entries, entry]);
    setForm((current) => ({
      ...current,
      athleteName: "",
      markRaw: "",
      note: "",
    }));
    setSaved(false);
  }

  function saveDepthChart() {
    window.localStorage.setItem(
      storageKey(depthChart.classification, depthChart.school),
      JSON.stringify(draftEntries),
    );
    setSavedEntries(draftEntries);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  function resetDraft() {
    setDraftEntries(savedEntries);
    setSaved(false);
    setError(undefined);
  }

  function removeSaved(id: string) {
    setDraftEntries((entries) => entries.filter((entry) => entry.id !== id));
    setSaved(false);
  }

  function setEventRowsOpen(key: string, nextOpen: boolean) {
    setOpenEventKeys((current) => {
      const next = new Set(current);
      if (nextOpen) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  return (
    <section
      className={
        embedded ? "bg-white" : "mt-5 rounded-lg border border-slate-200 bg-white"
      }
    >
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#2f6f5e]">
              <Users size={18} />
              Team depth chart
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-normal text-slate-950">
              Build the likely relay pool from verified marks, then add missing
              athletes without leaving the dashboard.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Relay pools use direct event marks first. They also flag athletes
              who could move up or down based on their strongest nearby event.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[420px]">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">
                Focus team
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-950">
                {shortSchoolName(depthChart.school)}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">
                Team athletes
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-slate-950">
                {availableAthletes}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">
                Saved adds
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-slate-950">
                {draftEntries.length}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(["Boys", "Girls"] as const).map((gender) => (
            <button
              key={gender}
              type="button"
              onClick={() => {
                setSelectedGender(gender);
                setForm((current) => ({
                  ...current,
                  gender,
                  event: validEventForGender(current.event, gender)
                    ? current.event
                    : firstEventForGender(gender),
                }));
              }}
              className={`inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-semibold transition ${
                selectedGender === gender
                  ? "border-[#0f2a47] bg-[#0f2a47] text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {gender}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="border-b border-slate-200 p-5 xl:border-b-0 xl:border-r">
          <h3 className="text-base font-semibold text-slate-950">
            Add a missing mark
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              Gender
              <select
                value={form.gender}
                onChange={(event) =>
                  setForm((current) => {
                    const gender = event.target.value as Gender;
                    return {
                      ...current,
                      gender,
                      event: validEventForGender(current.event, gender)
                        ? current.event
                        : firstEventForGender(gender),
                    };
                  })
                }
                className="app-select mt-1 h-11"
              >
                <option value="Boys">Boys</option>
                <option value="Girls">Girls</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Event
              <select
                value={form.event}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    event: event.target.value as EventKey,
                  }))
                }
                className="app-select mt-1 h-11"
              >
                {eventOptions
                  .filter((definition) => definition.genders.includes(form.gender))
                  .map((definition) => (
                    <option key={definition.event} value={definition.event}>
                      {definition.displayName}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Athlete
              <input
                value={form.athleteName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    athleteName: event.target.value,
                  }))
                }
                placeholder="Add athlete name"
                className="app-input mt-1 h-11"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Mark
              <input
                value={form.markRaw}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    markRaw: event.target.value,
                  }))
                }
                placeholder="2:21.40 or 17-6"
                className="app-input mt-1 h-11"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
              Note
              <input
                value={form.note}
                onChange={(event) =>
                  setForm((current) => ({ ...current, note: event.target.value }))
                }
                placeholder="Optional: relay split, meet, or coach note"
                className="app-input mt-1 h-11"
              />
            </label>
          </div>
          {error ? (
            <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addDraftEntry}
              className="coach-action app-button-navy inline-flex h-10 items-center gap-2 px-4 text-sm"
            >
              <Plus size={16} />
              Add to chart
            </button>
            <button
              type="button"
              onClick={saveDepthChart}
              className={`coach-action inline-flex h-10 items-center gap-2 px-4 text-sm transition ${
                saved && !dirty
                  ? "bg-emerald-50 text-emerald-800"
                  : "app-button-primary"
              }`}
            >
              {saved && !dirty ? <Check size={16} /> : <Save size={16} />}
              {saved && !dirty ? "Saved" : "Save depth chart"}
            </button>
            {dirty ? (
              <button
                type="button"
                onClick={resetDraft}
                className="coach-action app-button-secondary inline-flex h-10 items-center gap-2 px-4 text-sm"
              >
                <RotateCcw size={15} />
                Undo unsaved
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Saved marks stay on this browser for {shortSchoolName(depthChart.school)}.
            They improve this dashboard’s depth chart and relay projection immediately.
          </p>
        </div>

        <div className="p-5">
          <h3 className="text-base font-semibold text-slate-950">
            {selectedGender} relay pool
          </h3>
          <div className="mt-4 grid gap-3">
            {relaysForGender.map((projection) => (
              <details
                key={`${projection.gender}-${projection.relay}`}
                className="group rounded-lg border border-slate-200 bg-slate-50"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">
                      {projection.relayLabel}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {projection.projectedQualityLabel} · {projection.note}
                    </div>
                  </div>
                  <ChevronDown
                    size={18}
                    className="shrink-0 text-slate-500 transition group-open:rotate-180"
                  />
                </summary>
                <div className="border-t border-slate-200 p-4">
                  <div className="grid gap-2">
                    {projection.candidates.map((candidate) => (
                      <RelayCandidateRow
                        key={`${candidate.id}-${candidate.sourceEvent}`}
                        candidate={candidate}
                      />
                    ))}
                  </div>
                  {projection.alternates.length ? (
                    <div className="mt-4">
                      <div className="mb-2 text-xs font-semibold uppercase text-slate-500">
                        Alternates
                      </div>
                      <div className="grid gap-2">
                        {projection.alternates.slice(0, 4).map((candidate) => (
                          <RelayCandidateRow
                            key={`${candidate.id}-${candidate.sourceEvent}`}
                            candidate={candidate}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 p-5">
        <h3 className="text-base font-semibold text-slate-950">
          {selectedGender} event depth
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          These panels show the full verified team list for each event, not just
          the state-watch rows. Open Boys Discus here to see every Palmer Ridge
          thrower, including Cayman Davel and Xandr Warren.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {chartsForGender.map((chart) => (
            <details
              key={`${chart.gender}-${chart.event}`}
              className="group rounded-lg border border-slate-200 bg-white"
              onToggle={(event) =>
                setEventRowsOpen(
                  `${chart.gender}-${chart.event}`,
                  event.currentTarget.open,
                )
              }
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-sm font-semibold text-slate-950">
                    {chart.eventLabel}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {chart.entries.length
                      ? `${chart.entries.length} athlete${chart.entries.length === 1 ? "" : "s"} · top ${chart.entries[0].athleteName} ${chart.entries[0].markRaw}`
                      : "No team marks yet"}
                  </div>
                </div>
                <ChevronDown
                  size={18}
                  className="shrink-0 text-slate-500 transition group-open:rotate-180"
                />
              </summary>
              {openEventKeys.has(`${chart.gender}-${chart.event}`) ? (
                <EventDepthRows
                  chart={chart}
                  savedEntries={draftEntries}
                  onRemoveSaved={removeSaved}
                />
              ) : (
                <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
                  Open to render the full {chart.eventLabel} team list.
                </div>
              )}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

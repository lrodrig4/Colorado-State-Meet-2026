"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Layers3, Users } from "lucide-react";
import type { EventDefinition, EventSquadScope, Gender } from "@/types/domain";
import { eventDefinitions } from "@/lib/data/events";

const individualEvents = eventDefinitions.filter((definition) => !definition.relay);
const scopeOptions: EventSquadScope[] = ["All", "1A", "2A", "3A", "4A", "5A"];

function genderButtonClass(active: boolean) {
  return `inline-flex h-9 min-w-[4.75rem] items-center justify-center rounded-md px-3 text-sm font-semibold transition ${
    active
      ? "bg-[#08233f] text-white shadow-sm"
      : "text-slate-700 hover:bg-slate-50"
  }`;
}

function eventForGender(currentEvent: EventDefinition, targetGender: Gender) {
  if (currentEvent.genders.includes(targetGender)) {
    return currentEvent;
  }

  if (currentEvent.event === "100m Hurdles" && targetGender === "Boys") {
    return individualEvents.find(
      (definition) => definition.event === "110m Hurdles",
    );
  }

  if (currentEvent.event === "110m Hurdles" && targetGender === "Girls") {
    return individualEvents.find(
      (definition) => definition.event === "100m Hurdles",
    );
  }

  return individualEvents.find((definition) =>
    definition.genders.includes(targetGender),
  );
}

export function EventSquadSelector({
  currentGender,
  currentEvent,
  currentScope,
}: {
  currentGender: Gender;
  currentEvent: EventDefinition;
  currentScope: EventSquadScope;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingSelection, setPendingSelection] = useState<{
    gender: Gender;
    event: EventDefinition;
    scope: EventSquadScope;
  } | null>(null);
  const visibleGender = pendingSelection?.gender ?? currentGender;
  const visibleEvent = pendingSelection?.event ?? currentEvent;
  const visibleScope = pendingSelection?.scope ?? currentScope;

  useEffect(() => {
    const timeout = window.setTimeout(() => setPendingSelection(null), 0);
    return () => window.clearTimeout(timeout);
  }, [currentGender, currentEvent, currentScope]);

  const eventOptions = useMemo(
    () =>
      individualEvents.filter((definition) =>
        definition.genders.includes(visibleGender),
      ),
    [visibleGender],
  );
  const currentIndex = eventOptions.findIndex(
    (definition) => definition.event === visibleEvent.event,
  );
  const previous = eventOptions.at(
    currentIndex <= 0 ? eventOptions.length - 1 : currentIndex - 1,
  );
  const next = eventOptions.at((currentIndex + 1) % eventOptions.length);

  function goTo(
    gender: Gender,
    event: EventDefinition | undefined,
    scope: EventSquadScope = visibleScope,
  ) {
    if (!event) return;

    const params = new URLSearchParams(window.location.search);
    params.set("gender", gender.toLowerCase());
    params.set("event", event.slug);
    params.set("scope", scope.toLowerCase());
    if (scope === "All") {
      params.delete("class");
    } else {
      params.set("class", scope);
    }
    setPendingSelection({ gender, event, scope });
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="app-toolbar w-full" aria-busy={isPending}>
      <div className="grid gap-2">
        <div className="grid gap-2 lg:grid-cols-[7rem_1fr] lg:items-center">
          <div className="flex shrink-0 items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-normal text-slate-500">
            <Layers3 size={14} className="text-[#0f2a47]" />
            Division
          </div>

          <div className="grid min-w-0 grid-cols-3 gap-1 rounded-lg border border-[#d8e2ea] bg-[#eef4f2] p-1 sm:grid-cols-6">
            {scopeOptions.map((scope) => {
              const active = visibleScope === scope;

              return (
                <button
                  key={scope}
                  type="button"
                  aria-pressed={active}
                  onClick={() => goTo(visibleGender, visibleEvent, scope)}
                  className={`h-9 min-w-0 rounded-md px-2 text-sm font-semibold transition ${
                    active
                      ? "bg-[#08233f] text-white shadow-sm"
                      : "text-slate-700 hover:bg-white/70"
                  } ${isPending && active ? "ring-2 ring-emerald-300/60" : ""}`}
                >
                  {scope === "All" ? "All" : scope}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-[7rem_minmax(9.75rem,auto)_minmax(16rem,1fr)] lg:items-center">
          <div className="flex shrink-0 items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-normal text-slate-500">
            <Users size={14} className="text-[#0f2a47]" />
            Choose
          </div>

          <div className="inline-flex w-full rounded-lg border border-[#d8e2ea] bg-[#eef4f2] p-1 sm:w-max">
            <button
              type="button"
              onClick={() => goTo("Boys", eventForGender(visibleEvent, "Boys"))}
              className={genderButtonClass(visibleGender === "Boys")}
            >
              Boys
            </button>
            <button
              type="button"
              onClick={() => goTo("Girls", eventForGender(visibleEvent, "Girls"))}
              className={genderButtonClass(visibleGender === "Girls")}
            >
              Girls
            </button>
          </div>

          <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] gap-2">
            <button
              type="button"
              aria-label="Previous event"
              onClick={() => goTo(visibleGender, previous)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d8e2ea] bg-white text-slate-700 hover:bg-slate-50"
            >
              <ChevronLeft size={18} />
            </button>

            <select
              aria-label="Event"
              value={visibleEvent.slug}
              onChange={(event) => {
                const selected = eventOptions.find(
                  (definition) => definition.slug === event.target.value,
                );
                goTo(visibleGender, selected);
              }}
              className="app-select"
            >
              {eventOptions.map((definition) => (
                <option key={definition.slug} value={definition.slug}>
                  {definition.displayName}
                </option>
              ))}
            </select>

            <button
              type="button"
              aria-label="Next event"
              onClick={() => goTo(visibleGender, next)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d8e2ea] bg-white text-slate-700 hover:bg-slate-50"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Classification, EventDefinition, Gender } from "@/types/domain";
import { eventDefinitions } from "@/lib/data/events";
import { focusTeamHref } from "@/lib/utils/focusTeam";
import { withClassificationHref } from "@/lib/utils/classificationScope";
import { rankingPath } from "@/lib/utils/rankingRoutes";

function oppositeGender(gender: Gender): Gender {
  return gender === "Boys" ? "Girls" : "Boys";
}

function genderEvent(current: EventDefinition, targetGender: Gender) {
  if (current.genders.includes(targetGender)) {
    return current;
  }

  if (current.event === "100m Hurdles" && targetGender === "Boys") {
    return eventDefinitions.find((definition) => definition.event === "110m Hurdles");
  }

  if (current.event === "110m Hurdles" && targetGender === "Girls") {
    return eventDefinitions.find((definition) => definition.event === "100m Hurdles");
  }

  return undefined;
}

function genderButtonClass(active: boolean) {
  return `inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-semibold transition ${
    active
      ? "bg-[#0f2a47] text-white shadow-sm"
      : "text-slate-700 hover:bg-slate-50"
  }`;
}

export function RankingEventSwitcher({
  currentGender,
  currentEvent,
  focusTeam,
  classification,
}: {
  currentGender: Gender;
  currentEvent: EventDefinition;
  focusTeam?: string;
  classification?: Classification;
}) {
  const router = useRouter();
  const eventOptions = useMemo(
    () =>
      eventDefinitions.filter((definition) =>
        definition.genders.includes(currentGender),
      ),
    [currentGender],
  );
  const currentIndex = eventOptions.findIndex(
    (definition) => definition.event === currentEvent.event,
  );
  const previous = eventOptions.at(
    currentIndex <= 0 ? eventOptions.length - 1 : currentIndex - 1,
  );
  const next = eventOptions.at((currentIndex + 1) % eventOptions.length);
  const otherGender = oppositeGender(currentGender);
  const otherGenderEvent = genderEvent(currentEvent, otherGender);

  function goTo(gender: Gender, event: EventDefinition | undefined) {
    if (!event) return;
    const path = rankingPath(gender, event.slug);
    router.push(
      focusTeam
        ? focusTeamHref(path, focusTeam, classification)
        : classification
          ? withClassificationHref(path, classification)
          : path,
    );
  }

  return (
    <div className="col-span-2 w-full rounded-xl border border-[#d8e2ea] bg-white p-2 shadow-sm xl:col-span-1 xl:w-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="inline-flex rounded-lg border border-[#d8e2ea] bg-[#eef4f2] p-1">
        <button
          type="button"
          onClick={() => goTo("Boys", genderEvent(currentEvent, "Boys"))}
          className={genderButtonClass(currentGender === "Boys")}
        >
          Boys
        </button>
        <button
          type="button"
          onClick={() => goTo("Girls", genderEvent(currentEvent, "Girls"))}
          className={genderButtonClass(currentGender === "Girls")}
        >
          Girls
        </button>
      </div>

      <div className="grid grid-cols-[40px_1fr_40px] gap-2 sm:flex sm:items-center">
      <button
        type="button"
        aria-label="Previous event"
        onClick={() => goTo(currentGender, previous)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#d8e2ea] bg-white text-slate-700 hover:bg-slate-50"
      >
        <ChevronLeft size={18} />
      </button>

      <select
        aria-label="Event"
        value={currentEvent.slug}
        onChange={(event) => {
          const selected = eventOptions.find(
            (definition) => definition.slug === event.target.value,
          );
          goTo(currentGender, selected);
        }}
        className="h-10 min-w-0 rounded-xl border border-[#d8e2ea] bg-white px-3 text-sm font-semibold text-slate-800 sm:min-w-56"
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
        onClick={() => goTo(currentGender, next)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#d8e2ea] bg-white text-slate-700 hover:bg-slate-50"
      >
        <ChevronRight size={18} />
      </button>
      </div>

      {otherGenderEvent ? (
        <button
          type="button"
          onClick={() => goTo(otherGender, otherGenderEvent)}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d8e2ea] bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {otherGender} {otherGenderEvent.displayName}
        </button>
      ) : null}
      </div>
    </div>
  );
}

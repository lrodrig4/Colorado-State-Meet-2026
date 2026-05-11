"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Classification, EventDefinition, Gender } from "@/types/domain";
import { eventDefinitions } from "@/lib/data/events";
import { focusTeamHref } from "@/lib/utils/focusTeam";
import { withClassificationHref } from "@/lib/utils/classificationScope";
import { rankingPath } from "@/lib/utils/rankingRoutes";

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
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const eventOptions = eventDefinitions.flatMap((definition) =>
    definition.genders.map((gender) => ({
      key: `${gender}|${definition.slug}`,
      gender,
      event: definition,
      label: `${gender} ${definition.displayName}`,
    })),
  );
  const selectedKey = `${currentGender}|${currentEvent.slug}`;
  const visibleKey = pendingKey ?? selectedKey;

  useEffect(() => {
    const timeout = window.setTimeout(() => setPendingKey(null), 0);
    return () => window.clearTimeout(timeout);
  }, [selectedKey]);

  function goTo(gender: Gender, event: EventDefinition | undefined) {
    if (!event) return;
    const path = rankingPath(gender, event.slug);
    setPendingKey(`${gender}|${event.slug}`);
    startTransition(() => {
      router.push(
        focusTeam
          ? focusTeamHref(path, focusTeam, classification)
          : classification
            ? withClassificationHref(path, classification)
            : path,
      );
    });
  }

  return (
    <div
      className="col-span-2 w-full rounded-lg border border-[#d8e2ea] bg-white p-1.5 shadow-sm xl:col-span-1 xl:w-auto"
      aria-busy={isPending}
    >
      <select
        aria-label="Event ranking board"
        value={visibleKey}
        onChange={(event) => {
          const selected = eventOptions.find(
            (option) => option.key === event.target.value,
          );
          goTo(selected?.gender ?? currentGender, selected?.event);
        }}
        className="app-select xl:min-w-64"
      >
        {eventOptions.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

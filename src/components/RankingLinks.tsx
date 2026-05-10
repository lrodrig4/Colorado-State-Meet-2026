import Link from "next/link";
import type { Classification, RankingResult } from "@/types/domain";
import { eventDefinitions, getEventDefinition } from "@/lib/data/events";
import { focusTeamHref, shortSchoolName } from "@/lib/utils/focusTeam";
import { withClassificationHref } from "@/lib/utils/classificationScope";
import { rankingPath } from "@/lib/utils/rankingRoutes";

const groupLabels = {
  sprint: "Sprints",
  hurdle: "Hurdles",
  distance: "Distance",
  relay: "Relays",
  jump: "Jumps",
  throw: "Throws",
} as const;

const groupOrder = ["sprint", "hurdle", "distance", "relay", "jump", "throw"] as const;

export function RankingLinks({
  rankings,
  focusTeam,
  classification,
}: {
  rankings: RankingResult[];
  focusTeam?: string;
  classification?: Classification;
}) {
  const hrefFor = (ranking: RankingResult) =>
    focusTeam
      ? focusTeamHref(
          rankingPath(ranking.gender, getEventDefinition(ranking.event).slug),
          focusTeam,
          classification,
      )
      : classification
        ? withClassificationHref(
            rankingPath(ranking.gender, getEventDefinition(ranking.event).slug),
            classification,
          )
        : rankingPath(ranking.gender, getEventDefinition(ranking.event).slug);
  const rankingByGenderEvent = new Map(
    rankings.map((ranking) => [`${ranking.gender}|${ranking.event}`, ranking]),
  );
  const focusShortName = focusTeam ? shortSchoolName(focusTeam) : undefined;
  const groups = groupOrder
    .map((discipline) => ({
      discipline,
      label: groupLabels[discipline],
      events: eventDefinitions.filter((event) => event.discipline === discipline),
    }))
    .filter((group) => group.events.length);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#d8e2ea] bg-[#08111f] p-4 text-white shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pick an event</h2>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-300">
              Each row shows the current #18 mark and first bubble mark. Open
              one event for odds, scratch pull-ins, and last-chance calls.
            </p>
          </div>
          {focusShortName ? (
            <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm">
              Saved view: <span className="font-semibold">{focusShortName}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map((group) => (
          <section
            key={group.discipline}
            className="rounded-xl border border-[#d8e2ea] bg-white shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-base font-semibold text-slate-950">
                {group.label}
              </h3>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                #18 / bubble
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {group.events.map((event) => (
                <div
                  key={event.event}
                  className="grid gap-2 px-4 py-3 sm:grid-cols-[132px_1fr]"
                >
                  <div className="text-sm font-semibold text-slate-950">
                    {event.displayName}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {event.genders.map((gender) => {
                      const ranking = rankingByGenderEvent.get(
                        `${gender}|${event.event}`,
                      );
                      if (!ranking) return null;

                      const cutoff = ranking.top18.at(-1);
                      const firstBubble = ranking.bubble[0];
                      const focusRows = focusTeam
                        ? [...ranking.top18, ...ranking.bubble].filter(
                            (row) => row.school === focusTeam,
                          )
                        : [];

                      return (
                        <Link
                          key={gender}
                          href={hrefFor(ranking)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-[#2f6f5e] hover:bg-white hover:shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-slate-950">
                              {gender}
                            </span>
                            <span className="text-xs font-semibold uppercase text-[#2f6f5e]">
                              Open
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-slate-600">
                            <span>
                              #18{" "}
                              <strong className="font-semibold text-slate-950">
                                {cutoff?.markRaw ?? "none"}
                              </strong>
                            </span>
                            <span>
                              B1{" "}
                              <strong className="font-semibold text-slate-950">
                                {firstBubble?.markRaw ?? "none"}
                              </strong>
                            </span>
                          </div>
                          {focusRows.length ? (
                            <div className="mt-1 text-xs font-semibold text-[#0f2a47]">
                              {focusShortName}:{" "}
                              {focusRows
                                .slice(0, 2)
                                .map((row) => `${row.rank <= 18 ? "#" : "B"}${row.rank <= 18 ? row.rank : row.rank - 18}`)
                                .join(", ")}
                            </div>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

import { cookies } from "next/headers";
import { SimpleSteps } from "@/components/AppPrimitives";
import { EventSquadGraphic } from "@/components/EventSquadGraphic";
import { EventSquadSelector } from "@/components/EventSquadSelector";
import { EventSquadTable } from "@/components/EventSquadTable";
import { FocusTeamSelector } from "@/components/FocusTeamSelector";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { eventDefinitions, eventDefinitionsBySlug } from "@/lib/data/events";
import {
  getEventSquadRankingForSelection,
  getSchoolOptionsForEventSquadScope,
} from "@/lib/services/appData";
import { resolveClassification } from "@/lib/utils/classificationScope";
import {
  DEFAULT_FOCUS_TEAM,
  decodeFocusTeamCookie,
  focusTeamCookieName,
  resolveFocusTeam,
  shortSchoolName,
} from "@/lib/utils/focusTeam";
import type { EventDefinition, EventSquadScope, Gender } from "@/types/domain";

const individualEvents = eventDefinitions.filter((definition) => !definition.relay);
const defaultEvent =
  individualEvents.find((definition) => definition.event === "Discus") ??
  individualEvents[0];
const eventSquadScopes: EventSquadScope[] = ["All", "1A", "2A", "3A", "4A", "5A"];

function resolveGender(value: string | string[] | undefined): Gender {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.toLowerCase() === "girls" ? "Girls" : "Boys";
}

function resolveEventSquadScope(
  value: string | string[] | undefined,
): EventSquadScope {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = raw?.toUpperCase();

  if (!normalized || normalized === "ALL") {
    return "All";
  }

  return eventSquadScopes.includes(normalized as EventSquadScope)
    ? (normalized as EventSquadScope)
    : "All";
}

function scopeLabel(scope: EventSquadScope) {
  return scope === "All" ? "all divisions" : `CHSAA ${scope}`;
}

function resolveEvent(
  value: string | string[] | undefined,
  gender: Gender,
): EventDefinition {
  const raw = Array.isArray(value) ? value[0] : value;
  const requested = raw ? eventDefinitionsBySlug.get(raw) : undefined;

  if (requested && !requested.relay && requested.genders.includes(gender)) {
    return requested;
  }

  if (defaultEvent?.genders.includes(gender)) {
    return defaultEvent;
  }

  return (
    individualEvents.find((definition) => definition.genders.includes(gender)) ??
    individualEvents[0]
  );
}

export default async function EventSquadsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const cookieStore = await cookies();
  const shellClassification = resolveClassification(resolvedSearchParams.class);
  const classification = resolveEventSquadScope(resolvedSearchParams.scope);
  const gender = resolveGender(resolvedSearchParams.gender);
  const eventDefinition = resolveEvent(resolvedSearchParams.event, gender);
  const schoolOptions = await getSchoolOptionsForEventSquadScope(classification);
  const focusTeamClassification =
    classification === "All" ? shellClassification : classification;
  const savedFocusTeam = decodeFocusTeamCookie(
    cookieStore.get(focusTeamCookieName(focusTeamClassification))?.value,
  );
  const focusTeam = resolveFocusTeam(
    resolvedSearchParams.team ?? savedFocusTeam,
    schoolOptions,
    DEFAULT_FOCUS_TEAM,
  );
  const ranking = await getEventSquadRankingForSelection({
    classification,
    event: eventDefinition.event,
    gender,
  });
  const focusSquad = ranking.squads.find((squad) => squad.school === focusTeam);
  const topSquad = ranking.squads[0];
  const eventTitle = eventDefinition.displayName;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Make Picture"
        description="Choose boys or girls and an event. The preview shows the four best teams by verified marks."
        actions={
          <FocusTeamSelector
            schools={schoolOptions}
            currentTeam={focusTeam}
            classification={focusTeamClassification}
            label="Team"
          />
        }
      />

      <SimpleSteps
        steps={[
          {
            title: "Choose the event",
            detail: "Use the controls under this box.",
          },
          {
            title: "Check picture",
            detail: "Make sure the top four look right.",
          },
          {
            title: "Open picture",
            detail: "Use the image button when ready.",
          },
        ]}
      />

      <EventSquadSelector
        currentGender={gender}
        currentEvent={eventDefinition}
        currentScope={classification}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Teams with 4 marks"
          value={ranking.squads.length}
          detail={`${ranking.eligibleAthleteCount} eligible ${gender.toLowerCase()} marks in ${eventTitle}, ${scopeLabel(classification)}`}
          tone="navy"
        />
        <MetricCard
          label="#1 team"
          value={topSquad ? shortSchoolName(topSquad.school) : "None"}
          detail={topSquad ? `${topSquad.averageRaw} average` : "Needs four marks"}
        />
        <MetricCard
          label="Your team"
          value={focusSquad ? `#${focusSquad.rank}` : "No full squad"}
          detail={
            focusSquad
              ? `${shortSchoolName(focusTeam)} averages ${focusSquad.averageRaw}`
              : `${shortSchoolName(focusTeam)} has fewer than four marks`
          }
          tone={focusSquad ? "green" : "default"}
        />
        <MetricCard
          label="Image uses"
          value="4 teams"
          detail="Only the top four teams appear in the image."
          tone="default"
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <EventSquadGraphic
          ranking={ranking}
          eventTitle={eventTitle}
          scopeLabel={scopeLabel(classification)}
          focusTeam={focusTeam}
        />
        <aside className="space-y-3">
          <section className="app-panel p-3">
            <div className="coach-kicker">Image</div>
            <div className="mt-3 grid gap-2">
              <a
                href={`/api/event-squad-graphic?${new URLSearchParams({
                  gender: ranking.gender.toLowerCase(),
                  event: eventDefinition.slug,
                  scope: ranking.classification.toLowerCase(),
                }).toString()}`}
                target="_blank"
                rel="noreferrer"
                className="coach-action app-button-primary inline-flex items-center justify-center px-3 text-sm"
              >
                Open picture
              </a>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                The image shows the four best teams. This event has{" "}
                {ranking.eligibleAthleteCount} eligible marks.
              </div>
            </div>
          </section>
          <section className="app-panel p-3">
            <div className="coach-kicker">Colors</div>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#0f8a5f]" />
                Your saved team
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#173b67]" />
                Team shown in image
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#6f2c91]" />
                Rank band
              </div>
            </div>
          </section>
        </aside>
      </div>
      <EventSquadTable
        squads={ranking.squads}
        incompleteSquads={ranking.incompleteSquads}
        focusTeam={focusTeam}
      />
    </div>
  );
}

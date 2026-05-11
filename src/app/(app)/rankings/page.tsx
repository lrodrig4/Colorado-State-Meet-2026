import { cookies } from "next/headers";
import { ClassificationSelector } from "@/components/ClassificationSelector";
import { FocusTeamSelector } from "@/components/FocusTeamSelector";
import { SimpleSteps } from "@/components/AppPrimitives";
import { PageHeader } from "@/components/PageHeader";
import { RankingLinks } from "@/components/RankingLinks";
import {
  getLatestVerifiedMeetDateForClassification,
  getLastChanceDashboardForTeam,
  getRankingsForClassification,
  getSchoolOptionsForClassification,
} from "@/lib/services/appData";
import {
  currentAthleticLiveLastChanceMetadata,
  currentMileSplitSeedMetadata,
  maxPrepsMetadataByClassification,
} from "@/lib/data/rankingSourceMetadata";
import {
  DEFAULT_FOCUS_TEAM,
  decodeFocusTeamCookie,
  focusTeamCookieName,
  resolveFocusTeam,
} from "@/lib/utils/focusTeam";
import { resolveClassification } from "@/lib/utils/classificationScope";

function formatDenverDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00-06:00`));
}

function latestTimestamp(values: Array<string | undefined>) {
  const timestamps = values.filter((value): value is string => Boolean(value));
  return (
    timestamps.sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    )[0] ?? new Date(0).toISOString()
  );
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const cookieStore = await cookies();
  const classification = resolveClassification(resolvedSearchParams.class);
  const savedFocusTeam = decodeFocusTeamCookie(
    cookieStore.get(focusTeamCookieName(classification))?.value,
  );
  const [latestMeetDate, schoolOptions, rankings] = await Promise.all([
    getLatestVerifiedMeetDateForClassification(classification),
    getSchoolOptionsForClassification(classification),
    getRankingsForClassification(classification),
  ]);
  const focusTeam = resolveFocusTeam(
    resolvedSearchParams.team ?? savedFocusTeam,
    schoolOptions,
    DEFAULT_FOCUS_TEAM,
  );
  const dashboard = await getLastChanceDashboardForTeam(classification, focusTeam);
  const maxPrepsMetadata = maxPrepsMetadataByClassification[classification];
  const latestRefresh = latestTimestamp([
    currentMileSplitSeedMetadata.generatedAt,
    currentAthleticLiveLastChanceMetadata.generatedAt,
    maxPrepsMetadata?.generatedAt,
  ]);
  const sourceErrorCount =
    currentMileSplitSeedMetadata.sourceErrors.length +
    currentAthleticLiveLastChanceMetadata.sourceErrors.length +
    (maxPrepsMetadata?.sourceErrors.length ?? 0);
  return (
    <div>
      <PageHeader
        title="Who Is In?"
        description={`Pick an event to see who is in, who is just outside, and where ${focusTeam} stands.`}
        actions={
          <>
            <ClassificationSelector currentClassification={classification} />
            <FocusTeamSelector
              schools={schoolOptions}
              currentTeam={focusTeam}
              classification={classification}
              label="Team"
            />
          </>
        }
      />
      <SimpleSteps
        steps={[
          {
            title: "Pick an event",
            detail: "Use the event list below.",
          },
          {
            title: "Find your team",
            detail: "The saved team row shows your marks.",
          },
          {
            title: "Open details",
            detail: "Use the main button for the full list.",
          },
        ]}
      />
      <section className="mb-4 grid gap-3 rounded-lg border border-[#d8e2ea] bg-white p-3 shadow-sm md:grid-cols-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
            Last update
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-950">
            {formatDenverDateTime(latestRefresh)} MT
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
            Newest meet
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-950">
            {latestMeetDate ? formatDate(latestMeetDate) : "No verified marks"}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
            Data check
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-950">
            {sourceErrorCount
              ? `${sourceErrorCount} source flags`
              : "No source errors"}
          </div>
        </div>
      </section>
      <RankingLinks
        rankings={rankings}
        focusTeam={focusTeam}
        classification={classification}
        scratchPredictions={dashboard.scratchPredictions}
      />
    </div>
  );
}

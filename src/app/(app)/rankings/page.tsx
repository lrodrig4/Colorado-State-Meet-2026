import { cookies } from "next/headers";
import { ClassificationSelector } from "@/components/ClassificationSelector";
import { FocusTeamSelector } from "@/components/FocusTeamSelector";
import { PageHeader } from "@/components/PageHeader";
import { RankingLinks } from "@/components/RankingLinks";
import { currentMileSplitSeedMetadata } from "@/lib/data/currentPerformances.generated";
import {
  getPerformancesForClassification,
  getRankingsForClassification,
  getSchoolOptionsForClassification,
} from "@/lib/services/appData";
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
  const scopedPerformances = getPerformancesForClassification(classification);
  const schoolOptions = getSchoolOptionsForClassification(classification);
  const focusTeam = resolveFocusTeam(
    resolvedSearchParams.team ?? savedFocusTeam,
    schoolOptions,
    DEFAULT_FOCUS_TEAM,
  );
  const rankings = getRankingsForClassification(classification);
  const latestMeetDate =
    scopedPerformances
      .filter(
        (performance) =>
          performance.verificationStatus === "verified",
      )
      .reduce<string | undefined>(
        (latest, performance) =>
          !latest || performance.meetDate > latest ? performance.meetDate : latest,
        undefined,
      ) ?? "";

  return (
    <div>
      <PageHeader
        title="Top 18 Cutoff Board"
        description={`Open one ${classification} event, check the top 18, then move to the next event without losing the saved school view.`}
        actions={
          <>
            <ClassificationSelector currentClassification={classification} />
            <FocusTeamSelector
              schools={schoolOptions}
              currentTeam={focusTeam}
              classification={classification}
              label={`${classification} team`}
            />
          </>
        }
      />
      <section className="mb-4 grid gap-3 rounded-xl border border-[#d8e2ea] bg-white p-3 shadow-sm md:grid-cols-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Data refresh
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-950">
            {formatDenverDateTime(currentMileSplitSeedMetadata.generatedAt)} MT
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Latest verified meet date
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-950">
            {latestMeetDate ? formatDate(latestMeetDate) : "No verified marks"}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Public-source check
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-950">
            {currentMileSplitSeedMetadata.sourceErrors.length
              ? `${currentMileSplitSeedMetadata.sourceErrors.length} source flags`
              : "No source errors"}
          </div>
        </div>
      </section>
      <RankingLinks
        rankings={rankings}
        focusTeam={focusTeam}
        classification={classification}
      />
    </div>
  );
}

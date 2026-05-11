import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { SimpleSteps } from "@/components/AppPrimitives";
import { ClassificationSelector } from "@/components/ClassificationSelector";
import { FocusTeamSelector } from "@/components/FocusTeamSelector";
import { LastChancePanel } from "@/components/LastChancePanel";
import { PageHeader } from "@/components/PageHeader";
import { RankingEventSwitcher } from "@/components/RankingEventSwitcher";
import { RankingTable } from "@/components/RankingTable";
import {
  buildEventRecommendations,
  buildPuebloMeetMarks,
} from "@/lib/services/lastChance";
import {
  getClassifiedPerformances,
  getLastChanceDashboardForTeam,
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
import { allRankingParams, parseRankingSlug } from "@/lib/utils/rankingRoutes";
import type { LastChanceRecommendation } from "@/lib/services/lastChance";

function athleteContextKey(row: LastChanceRecommendation) {
  return `${row.gender}|${row.school}|${row.athleteName}`.toLowerCase();
}

function visibleAthleteContextRows(
  recommendations: LastChanceRecommendation[],
  visibleRows: LastChanceRecommendation[],
) {
  const visibleKeys = new Set(
    visibleRows
      .filter((row) => !row.eventLabel.includes("Relay"))
      .map(athleteContextKey),
  );

  return recommendations.filter((row) => visibleKeys.has(athleteContextKey(row)));
}

export function generateStaticParams() {
  return allRankingParams();
}

export default async function EventRankingPage({
  params,
  searchParams,
}: {
  params: Promise<{ rankingSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { rankingSlug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const cookieStore = await cookies();
  const classification = resolveClassification(resolvedSearchParams.class);
  const savedFocusTeam = decodeFocusTeamCookie(
    cookieStore.get(focusTeamCookieName(classification))?.value,
  );
  const parsed = parseRankingSlug(rankingSlug);

  if (!parsed) {
    notFound();
  }

  const schoolOptions = await getSchoolOptionsForClassification(classification);
  const focusTeam = resolveFocusTeam(
    resolvedSearchParams.team ?? savedFocusTeam,
    schoolOptions,
    DEFAULT_FOCUS_TEAM,
  );
  const [rankingsWithBubble, rankings] = await Promise.all([
    getRankingsForClassification(classification, { bubbleLimit: 24 }),
    getRankingsForClassification(classification),
  ]);
  const ranking =
    rankingsWithBubble.find(
      (result) =>
        result.gender === parsed.gender &&
        result.event === parsed.eventDefinition.event,
    ) ??
    rankings.find(
      (result) =>
        result.gender === parsed.gender &&
        result.event === parsed.eventDefinition.event,
    );

  if (!ranking) {
    notFound();
  }

  const title = `${parsed.gender} ${parsed.eventDefinition.displayName}`;
  const eventAnalysis = buildEventRecommendations(ranking, focusTeam);
  const [dashboard, classifiedPerformances] = await Promise.all([
    getLastChanceDashboardForTeam(classification, focusTeam),
    getClassifiedPerformances(),
  ]);
  const eventRecommendations = dashboard.recommendations.filter(
    (row) =>
      row.gender === parsed.gender && row.event === parsed.eventDefinition.event,
  );
  const focusRows = dashboard.recommendations
    .filter(
      (row) =>
        row.isFocusTeam &&
        (row.status === "Must race" ||
          row.status === "At risk" ||
          row.status === "Monitor" ||
          row.scratchProbability >= 35),
    )
    .slice(0, 30);
  const allRows = dashboard.recommendations
    .filter(
      (row) =>
        row.status !== "Likely safe" ||
        row.scratchProbability >= 20 ||
        row.expectedScratchOpenings >= 0.25,
    )
    .slice(0, 60);
  const coachSummaryRows = focusRows.slice(0, 18);
  const athleteContextRows = visibleAthleteContextRows(
    dashboard.recommendations,
    [...eventRecommendations, ...focusRows, ...allRows],
  );
  const puebloMarks = buildPuebloMeetMarks(classifiedPerformances, ranking);

  return (
    <div>
      <PageHeader
        title={title}
        description={`See who is in the state field, who is just outside, and what ${focusTeam} should watch in CHSAA ${classification}.`}
        actions={
          <>
            <ClassificationSelector currentClassification={classification} />
            <FocusTeamSelector
              schools={schoolOptions}
              currentTeam={focusTeam}
              classification={classification}
              label="Team"
            />
            <RankingEventSwitcher
              currentGender={parsed.gender}
              currentEvent={parsed.eventDefinition}
              focusTeam={focusTeam}
              classification={classification}
            />
          </>
        }
      />
      <SimpleSteps
        steps={[
          {
            title: "Read the callout",
            detail: "It tells you the main risk first.",
          },
          {
            title: "Check your team",
            detail: "Saved-team rows are highlighted.",
          },
          {
            title: "Use the table",
            detail: "Search, copy, or download the event list.",
          },
        ]}
      />
      <LastChancePanel
        focusTeam={focusTeam}
        classification={classification}
        eventTitle={title}
        prediction={eventAnalysis.prediction}
        eventRecommendations={eventRecommendations}
        focusRows={focusRows}
        allRows={allRows}
        athleteContextRows={athleteContextRows}
        coachSummaryRows={coachSummaryRows}
        puebloMarks={puebloMarks}
        scratchPredictions={dashboard.scratchPredictions}
      />
      <RankingTable
        title={`${title} list`}
        rows={ranking.top18}
        bubbleRows={ranking.bubble}
      />
    </div>
  );
}

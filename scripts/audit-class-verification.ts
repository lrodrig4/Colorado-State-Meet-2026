import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Classification, EventKey, Performance, RankingRow } from "@/types/domain";
import { current3ABrowserRankingPerformances } from "@/lib/data/current3ABrowserRankings.generated";
import { current3AMaxPrepsRankingPerformances } from "@/lib/data/current3AMaxPrepsRankings.generated";
import { current5ABrowserRankingPerformances } from "@/lib/data/current5ABrowserRankings.generated";
import { current5AMaxPrepsRankingPerformances } from "@/lib/data/current5AMaxPrepsRankings.generated";
import { getEventDefinition } from "@/lib/data/events";
import { meets } from "@/lib/data/meets";
import { milesplitGapMeetSources } from "@/lib/data/milesplitGapMeetSources";
import { performances } from "@/lib/data/performances";
import { findSchoolByNameOrAlias, normalizeSchoolLookupKey } from "@/lib/data/schools";
import { getAllRankingResults } from "@/lib/services/ranking";
import { comparePerformanceMarks } from "@/lib/utils/time";

const CLASSIFICATION = (process.env.AUDIT_CLASSIFICATION ?? "3A") as Classification;
const TOP_LIMIT = Number(process.env.AUDIT_TOP_LIMIT ?? 18);
const BUBBLE_LIMIT = Number(process.env.AUDIT_BUBBLE_LIMIT ?? 7);
const REPORT_OUTPUT =
  process.env.AUDIT_REPORT_OUTPUT ??
  `reports/${CLASSIFICATION.toLowerCase()}-top18-source-verification-report.json`;

type AuditedRow = {
  gender: RankingRow["gender"];
  event: EventKey;
  rank: number;
  athleteName: string;
  school: string;
  grade: number | null;
  markRaw: string;
  meetName: string;
  meetDate: string;
  source: RankingRow["source"];
  sourceUrl: string | null;
  verificationStatus?: string;
  maxPrepsExact?: boolean;
  mileSplitExact?: boolean;
  [key: string]: unknown;
};

const sourceRowsByClassification: Record<
  string,
  { milesplit: Performance[]; maxpreps: Performance[] }
> = {
  "3A": {
    milesplit: current3ABrowserRankingPerformances,
    maxpreps: current3AMaxPrepsRankingPerformances,
  },
  "5A": {
    milesplit: current5ABrowserRankingPerformances,
    maxpreps: current5AMaxPrepsRankingPerformances,
  },
};

function athleteKey(value: string | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function schoolKey(performance: Pick<Performance, "school" | "gender">) {
  return (
    findSchoolByNameOrAlias(performance.school, performance.gender)?.id ??
    normalizeSchoolLookupKey(performance.school).replace(/\s+/g, "")
  );
}

function rowKey(performance: Pick<Performance, "school" | "gender" | "event" | "athleteName">) {
  const definition = getEventDefinition(performance.event);
  return [
    performance.gender,
    performance.event,
    schoolKey(performance),
    definition.relay ? "relay" : athleteKey(performance.athleteName),
  ].join("|");
}

function sameMarkTolerance(event: EventKey) {
  return getEventDefinition(event).markType === "distance" ? 0.51 : 0.03;
}

function sameMark(row: Performance, source: Performance) {
  return Math.abs(row.markValue - source.markValue) <= sameMarkTolerance(row.event);
}

function bestMark(event: EventKey, rows: Performance[]) {
  return [...rows].sort((a, b) => comparePerformanceMarks(event, a.markValue, b.markValue))[0];
}

function normalizeMeetName(value: string | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(invite|invitational|championships|championship|meet|track|field|2026)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meetNameMatches(a: string | undefined, b: string | undefined) {
  const left = normalizeMeetName(a);
  const right = normalizeMeetName(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function dateInRecentWeekend(date: string | undefined) {
  return Boolean(date && date >= "2026-05-01" && date <= "2026-05-03");
}

function sourceIndex(rows: Performance[]) {
  const byKey = new Map<string, Performance[]>();
  for (const row of rows) {
    const key = rowKey(row);
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  return byKey;
}

function sourceMatch(
  row: Performance,
  index: Map<string, Performance[]>,
) {
  const matches = index.get(rowKey(row)) ?? [];
  const exact = matches.filter((candidate) => sameMark(row, candidate));
  return {
    exact,
    sameEntity: matches,
    best: bestMark(row.event, matches),
  };
}

function reportRow(row: RankingRow, extras: Record<string, unknown> = {}): AuditedRow {
  return {
    gender: row.gender,
    event: row.event,
    rank: row.rank,
    athleteName: row.athleteName,
    school: row.school,
    grade: row.grade ?? null,
    markRaw: row.markRaw,
    meetName: row.meetName,
    meetDate: row.meetDate,
    source: row.source,
    sourceUrl: row.sourceUrl ?? null,
    ...extras,
  };
}

function sourceLabel(row: Performance) {
  return {
    markRaw: row.markRaw,
    meetName: row.meetName,
    meetDate: row.meetDate,
    sourceUrl: row.sourceUrl ?? null,
  };
}

function legalSourceLabel(row: RankingRow) {
  if (row.source === "milesplit") {
    if (row.sourceUrl?.includes("accuracy=legal")) {
      return "Colorado MileSplit legal rankings";
    }

    return "Colorado MileSplit legal meet results";
  }

  if (row.source === "maxpreps") return "MaxPreps legal leaderboard";
  if (row.source === "athletic_net") return "Athletic.net result";
  if (row.source === "official_timing") return "official timing result";
  if (row.source === "manual" && row.verificationStatus === "manual_approved") {
    return "manual-approved result";
  }

  return undefined;
}

function hasUsableLegalSource(row: RankingRow) {
  return (
    row.verificationStatus === "verified" ||
    row.verificationStatus === "manual_approved"
  ) && Boolean(legalSourceLabel(row));
}

function verificationStatusFor(row: RankingRow, maxPreps: ReturnType<typeof sourceMatch>, mileSplit: ReturnType<typeof sourceMatch>) {
  const hasMaxPreps = maxPreps.exact.length > 0;
  const hasMileSplit = mileSplit.exact.length > 0;
  if (hasMaxPreps && hasMileSplit) return "maxpreps_and_milesplit";
  if (hasMaxPreps) return "maxpreps_only";
  if (hasUsableLegalSource(row) && maxPreps.sameEntity.length > 0) {
    return "legal_source_maxpreps_lag";
  }
  if (hasUsableLegalSource(row) && hasMileSplit) {
    return "legal_source_missing_from_maxpreps";
  }
  if (hasUsableLegalSource(row)) return "legal_source_only";
  if (hasMileSplit && maxPreps.sameEntity.length > 0) return "source_conflict_needs_review";
  if (hasMileSplit) return "missing_from_maxpreps";
  if (maxPreps.sameEntity.length > 0) return "source_conflict_needs_review";
  return "no_direct_source_match";
}

function needsManualSourceReview(row: AuditedRow) {
  return ["source_conflict_needs_review", "missing_from_maxpreps", "no_direct_source_match"].includes(
    String(row.verificationStatus),
  );
}

function maxPrepsLagStatus(row: AuditedRow) {
  return ["legal_source_maxpreps_lag", "legal_source_missing_from_maxpreps", "legal_source_only"].includes(
    String(row.verificationStatus),
  );
}

function athleticNetSearchUrl(meetName: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`site:athletic.net TrackAndField ${meetName} 2026 Colorado`)}`;
}

async function main() {
  const sources = sourceRowsByClassification[CLASSIFICATION];
  if (!sources) {
    throw new Error(`No source rows configured for ${CLASSIFICATION}`);
  }

  const mileSplitIndex = sourceIndex(sources.milesplit);
  const maxPrepsIndex = sourceIndex(sources.maxpreps);
  const rankings = getAllRankingResults(performances, CLASSIFICATION, {
    bubbleLimit: BUBBLE_LIMIT,
  });

  const auditedRows = rankings.flatMap((ranking) =>
    [...ranking.top18, ...ranking.bubble].map((row) => {
      const maxPreps = sourceMatch(row, maxPrepsIndex);
      const mileSplit = sourceMatch(row, mileSplitIndex);
      const status = verificationStatusFor(row, maxPreps, mileSplit);
      const gapSource = milesplitGapMeetSources.find((source) =>
        meetNameMatches(row.meetName, source.meetName),
      );

      return reportRow(row, {
        verificationStatus: status,
        trustedLegalSource: legalSourceLabel(row) ?? null,
        maxPrepsExact: maxPreps.exact.length > 0,
        mileSplitExact: mileSplit.exact.length > 0,
        maxPrepsBest: maxPreps.best ? sourceLabel(maxPreps.best) : null,
        mileSplitBest: mileSplit.best ? sourceLabel(mileSplit.best) : null,
        recentWeekendMeet: dateInRecentWeekend(row.meetDate),
        listedGapSource: gapSource
          ? {
              meetName: gapSource.meetName,
              priority: gapSource.priority,
              resultsUrl: gapSource.resultsUrl,
            }
          : null,
        action:
          maxPrepsLagStatus({ verificationStatus: status } as AuditedRow)
            ? "Use this mark if the source row is legal. MaxPreps appears behind or missing; no manual review needed unless a coach disputes the mark."
            : status === "no_direct_source_match" || status === "source_conflict_needs_review"
              ? "Manual source check required before treating this as fully verified."
              : "No immediate source action.",
        athleticNetSearchUrl: athleticNetSearchUrl(row.meetName),
      });
    }),
  );

  const top18Rows = auditedRows.filter((row) => Number(row.rank) <= TOP_LIMIT);
  const top25Rows = auditedRows.filter((row) => Number(row.rank) <= TOP_LIMIT + BUBBLE_LIMIT);
  const countByStatus = (rows: typeof auditedRows) =>
    rows.reduce<Record<string, number>>((counts, row) => {
      const status = String(row.verificationStatus);
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {});

  const eventAudits = rankings.map((ranking) => {
    const rows = auditedRows.filter(
      (row) => row.gender === ranking.gender && row.event === ranking.event,
    );
    const top18 = rows.filter((row) => Number(row.rank) <= TOP_LIMIT);
    const maxPrepsProblemRows = top18.filter((row) =>
      needsManualSourceReview(row),
    );
    const maxPrepsLagRows = top18.filter((row) =>
      maxPrepsLagStatus(row),
    );
    return {
      gender: ranking.gender,
      event: ranking.event,
      current18th: ranking.top18[TOP_LIMIT - 1]?.markRaw ?? null,
      top18Rows: ranking.top18.length,
      maxPrepsVerifiedTop18: top18.filter((row) => Boolean(row.maxPrepsExact)).length,
      bothSourcesTop18: top18.filter(
        (row) => row.verificationStatus === "maxpreps_and_milesplit",
      ).length,
      maxPrepsProblemRows: maxPrepsProblemRows.length,
      legalSourceMaxPrepsLagRows: maxPrepsLagRows.length,
      status:
        maxPrepsProblemRows.length === 0
          ? maxPrepsLagRows.length === 0
            ? "MaxPreps-backed top 18"
            : "Legal-source top 18; MaxPreps lag only"
          : maxPrepsProblemRows.length <= 2
            ? "Spot-check source rows"
            : "Needs source audit",
    };
  });

  const recentGapSources = milesplitGapMeetSources.filter((source) =>
    dateInRecentWeekend(source.meetDate),
  );
  const recentMeetAudit = recentGapSources.map((source) => {
    const rows = auditedRows.filter((row) => meetNameMatches(row.meetName, source.meetName));
    const top18 = rows.filter((row) => Number(row.rank) <= TOP_LIMIT);
    const top25 = rows.filter((row) => Number(row.rank) <= TOP_LIMIT + BUBBLE_LIMIT);
    const maxPrepsRows = sources.maxpreps.filter((row) =>
      meetNameMatches(row.meetName, source.meetName),
    );
    const mileSplitRows = sources.milesplit.filter((row) =>
      meetNameMatches(row.meetName, source.meetName),
    );
    const manualReviewRows = top25.filter(needsManualSourceReview);
    const lagRows = top25.filter(maxPrepsLagStatus);
    return {
      meetName: source.meetName,
      meetDate: source.meetDate,
      priority: source.priority,
      mileSplitResultsUrl: source.resultsUrl,
      maxPrepsTop50RowsFromMeet: maxPrepsRows.length,
      mileSplitTop50RowsFromMeet: mileSplitRows.length,
      currentTop18ImpactRows: top18.length,
      currentTop25ImpactRows: top25.length,
      top25ManualReviewRows: manualReviewRows.length,
      top25LegalSourceMaxPrepsLagRows: lagRows.length,
      status:
        top25.length === 0
          ? "No top-25 impact found; okay unless a coach knows a missing mark."
          : manualReviewRows.length === 0
            ? lagRows.length === 0
              ? "Top-25 impact is MaxPreps-backed."
              : "Top-25 impact has legal source rows; MaxPreps lag only."
            : "Top-25 impact has source rows needing review.",
      athleticNetSearchUrl: athleticNetSearchUrl(source.meetName),
      rowsToCheck: manualReviewRows.slice(0, 12),
      maxPrepsLagRows: lagRows.slice(0, 12),
    };
  });

  const parsedMeetNames = new Set([
    ...sources.maxpreps.map((row) => normalizeMeetName(row.meetName)),
    ...sources.milesplit.map((row) => normalizeMeetName(row.meetName)),
  ]);
  const recentCalendarAudit = meets
    .filter((meet) => meet.endDate && meet.endDate >= "2026-05-01" && meet.startDate && meet.startDate <= "2026-05-03")
    .filter((meet) => !meet.statusLabel)
    .map((meet) => {
      const maxPrepsRows = sources.maxpreps.filter((row) =>
        meetNameMatches(row.meetName, meet.name),
      );
      const mileSplitRows = sources.milesplit.filter((row) =>
        meetNameMatches(row.meetName, meet.name),
      );
      const gapSource = milesplitGapMeetSources.find((source) =>
        meetNameMatches(source.meetName, meet.name),
      );
      const hasTop50Rows =
        parsedMeetNames.has(normalizeMeetName(meet.name)) ||
        maxPrepsRows.length > 0 ||
        mileSplitRows.length > 0 ||
        Boolean(gapSource);

      return {
        date: meet.rawDate ?? meet.date,
        name: meet.name,
        location: meet.location,
        maxPrepsTop50Rows: maxPrepsRows.length,
        mileSplitTop50Rows: mileSplitRows.length,
        importedGapSource: Boolean(gapSource),
        status: hasTop50Rows
          ? "Covered by current top-50/ranking sources."
          : "No top-50 impact found in MaxPreps or MileSplit; likely fine unless this was a known 3A bubble meet.",
        athleticNetSearchUrl: athleticNetSearchUrl(meet.name),
      };
    });

  const report = {
    generatedAt: new Date().toISOString(),
    classification: CLASSIFICATION,
    policy:
      "Legal-wind marks from trusted public results/rankings are usable even when MaxPreps is lagging. Review is reserved for illegal/unknown wind, implausible field marks, classification issues, parser anomalies, or rows with no direct legal source.",
    summary: {
      totalTop18: top18Rows.length,
      totalTop25: top25Rows.length,
      top18StatusCounts: countByStatus(top18Rows),
      top25StatusCounts: countByStatus(top25Rows),
      maxPrepsBackedTop18: top18Rows.filter((row) => Boolean(row.maxPrepsExact)).length,
      bothSourcesTop18: top18Rows.filter(
        (row) => row.verificationStatus === "maxpreps_and_milesplit",
      ).length,
      needsMaxPrepsOrManualTop18: top18Rows.filter((row) =>
        needsManualSourceReview(row),
      ).length,
      legalSourceMaxPrepsLagTop18: top18Rows.filter(maxPrepsLagStatus).length,
      athleticNetAutomated: false,
      athleticNetNote:
        "No credentials or private cookies were used. Athletic.net verification is represented as public search links/manual follow-up until a public export or local-only import is added.",
    },
    eventAudits,
    weakEvents: eventAudits.filter((event) => event.maxPrepsProblemRows > 0),
    top18RowsNeedingMaxPrepsOrManualCheck: top18Rows.filter(needsManualSourceReview),
    top18LegalSourceMaxPrepsLagRows: top18Rows.filter(maxPrepsLagStatus),
    recentMeetAudit,
    recentCalendarAudit,
  };

  await mkdir(path.dirname(REPORT_OUTPUT), { recursive: true });
  await writeFile(REPORT_OUTPUT, JSON.stringify(report, null, 2));
  console.log(`Wrote ${REPORT_OUTPUT}`);
  console.log(JSON.stringify(report.summary, null, 2));
  const weak = report.weakEvents.map((event) => ({
    gender: event.gender,
    event: event.event,
    problems: event.maxPrepsProblemRows,
    status: event.status,
  }));
  console.log(JSON.stringify({ weakEvents: weak }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

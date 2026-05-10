import type { Performance, ReviewFlag } from "@/types/domain";
import { getEventDefinition } from "@/lib/data/events";
import { findSchool } from "@/lib/services/classification";
import { isDepthOnlyPerformance } from "@/lib/services/nonQualifying";

const unreliableSources = new Set(["manual", "generic"]);

export function buildReviewFlags(performance: Performance): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  const school = findSchool(performance.school, performance.gender);
  const eventDefinition = getEventDefinition(performance.event);
  const requiresFat = eventDefinition.markType === "time";

  if (!performance.classification || !performance.classificationVerified) {
    flags.push({
      id: `${performance.id}-classification`,
      performanceId: performance.id,
      severity: "high",
      reason: "Classification is unknown or unverified.",
      field: "classification",
    });
  }

  if (!school?.chsaaMember) {
    flags.push({
      id: `${performance.id}-school`,
      performanceId: performance.id,
      severity: "high",
      reason: "School is not currently verified as a Colorado CHSAA member.",
      field: "school",
    });
  }

  if (requiresFat && performance.timingType === "Unknown") {
    flags.push({
      id: `${performance.id}-timing-unknown`,
      performanceId: performance.id,
      severity: "medium",
      reason: "Timing type is unknown.",
      field: "timingType",
    });
  }

  if (requiresFat && !performance.isFAT) {
    flags.push({
      id: `${performance.id}-not-fat`,
      performanceId: performance.id,
      severity: "high",
      reason: "Performance is not marked as FAT.",
      field: "isFAT",
    });
  }

  if (unreliableSources.has(performance.source)) {
    flags.push({
      id: `${performance.id}-source`,
      performanceId: performance.id,
      severity: performance.source === "manual" ? "medium" : "low",
      reason: "Source requires human review before rankings inclusion.",
      field: "source",
    });
  }

  if (performance.verificationStatus === "needs_review") {
    flags.push({
      id: `${performance.id}-review-status`,
      performanceId: performance.id,
      severity: "medium",
      reason: "Performance is queued for manual approval.",
      field: "verificationStatus",
    });
  }

  return flags;
}

export function buildReviewQueue(performances: Performance[]) {
  return performances
    .map((performance) => ({
      performance,
      flags: buildReviewFlags(performance),
    }))
    .filter((item) => item.flags.length > 0);
}

export function isRankingEligible(performance: Performance): boolean {
  if (isDepthOnlyPerformance(performance)) {
    return false;
  }

  const statusEligible =
    performance.verificationStatus === "verified" ||
    performance.verificationStatus === "manual_approved";
  return statusEligible && hasEligibleTimingAndClassification(performance);
}

export function isDepthChartEligible(performance: Performance): boolean {
  const depthOnly = isDepthOnlyPerformance(performance);
  const statusEligible =
    performance.verificationStatus === "verified" ||
    performance.verificationStatus === "manual_approved" ||
    performance.verificationStatus === "depth_only" ||
    (performance.verificationStatus === "needs_review" && depthOnly);

  return (
    statusEligible &&
    hasEligibleTimingAndClassification(performance, {
      allowUnknownTime: depthOnly,
    })
  );
}

function hasEligibleTimingAndClassification(
  performance: Performance,
  options: { allowUnknownTime?: boolean } = {},
): boolean {
  const eventDefinition = getEventDefinition(performance.event);
  const timingEligible =
    eventDefinition.markType === "distance" ||
    (performance.isFAT && performance.timingType === "FAT") ||
    Boolean(options.allowUnknownTime && performance.timingType === "Unknown");

  return (
    timingEligible &&
    performance.classificationVerified &&
    Boolean(performance.classification)
  );
}

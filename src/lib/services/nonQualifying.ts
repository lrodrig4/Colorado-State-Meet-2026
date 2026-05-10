import type { Performance } from "@/types/domain";

const nonQualifyingMeetPatterns = [
  /\bJV\b/i,
  /\bjunior\s+varsity\b/i,
  /\bfrosh\b/i,
  /\bfreshman\b/i,
  /\bsophomore\b/i,
  /\bmiddle\s+school\b/i,
  /\bJH\b/i,
];

const nonQualifyingNotePatterns = [
  /\bdepth[-\s]?only\b/i,
  /\bnon[-\s]?qualifying\b/i,
  /\bdoes\s+not\s+count\b/i,
  /\bdo\s+not\s+count\b/i,
  /\bexcluded\s+from\s+CHSAA\s+qualifying\b/i,
];

export function isNonQualifyingMeetName(meetName: string): boolean {
  return nonQualifyingMeetPatterns.some((pattern) => pattern.test(meetName));
}

export function isDepthOnlyPerformance(performance: Performance): boolean {
  if (performance.verificationStatus === "depth_only") {
    return true;
  }

  if (isNonQualifyingMeetName(performance.meetName)) {
    return true;
  }

  const notes = performance.notes ?? "";
  return nonQualifyingNotePatterns.some((pattern) => pattern.test(notes));
}

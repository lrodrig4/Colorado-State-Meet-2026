import type { Classification } from "@/types/domain";

export type CoachInterestInput = {
  recipient: string;
  coachName: string;
  school: string;
  email?: string;
  classification?: Classification | "";
  interest?: string;
};

export function buildCoachInterestMailto(input: CoachInterestInput) {
  const subject = `Coach Pro interest: ${input.school}`;
  const lines = [
    "I want early access to Coach Pro.",
    "",
    `Coach: ${input.coachName}`,
    `School: ${input.school}`,
    input.email ? `Email: ${input.email}` : undefined,
    input.classification ? `Classification: ${input.classification}` : undefined,
    input.interest ? `What I want: ${input.interest}` : undefined,
  ].filter((line): line is string => Boolean(line));

  return `mailto:${input.recipient}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(lines.join("\r\n"))}`;
}

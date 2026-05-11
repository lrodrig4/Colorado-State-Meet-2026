import { eventDefinitionsBySlug } from "@/lib/data/events";
import { getEventSquadRankingForSelection } from "@/lib/services/appData";
import { apiError } from "@/lib/server/api";
import { shortSchoolName } from "@/lib/utils/focusTeam";
import type {
  EventSquadAthlete,
  EventSquadRankingRow,
  EventSquadScope,
  Gender,
} from "@/types/domain";

export const runtime = "nodejs";

const scopes: EventSquadScope[] = ["All", "1A", "2A", "3A", "4A", "5A"];
const width = 1200;
const height = 1200;

function resolveGender(value: string | null): Gender {
  return value?.toLowerCase() === "girls" ? "Girls" : "Boys";
}

function resolveScope(scope: string | null, fallbackClass: string | null) {
  const raw = scope ?? fallbackClass ?? "All";
  const normalized = raw.toUpperCase();

  if (normalized === "ALL") return "All";
  return scopes.includes(normalized as EventSquadScope)
    ? (normalized as EventSquadScope)
    : "All";
}

function scopeLabel(scope: EventSquadScope) {
  return scope === "All" ? "All Colorado" : `CHSAA ${scope}`;
}

function classYear(grade: number | undefined) {
  return grade ? String(2038 - grade) : "";
}

function athleteName(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts.at(-1)}`;
}

function meetDate(date: string | undefined) {
  if (!date) return "";
  const [, month, day] = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(date) ?? [];
  return month && day ? `${Number(month)}/${Number(day)}` : date;
}

function escapeXml(value: string | number | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function fileName(parts: string[]) {
  return `${parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}.svg`;
}

function athleteRows(athletes: EventSquadAthlete[], x: number, y: number) {
  return athletes
    .map((athlete, index) => {
      const rowY = y + index * 31;
      const fill = index % 2 ? "#ffffff" : "#ececec";
      const year = classYear(athlete.grade) || "-";

      return `
        <rect x="${x}" y="${rowY}" width="700" height="31" fill="${fill}" />
        <text x="${x + 14}" y="${rowY + 21}" class="athlete-name">${escapeXml(truncate(athleteName(athlete.athleteName), 23))}</text>
        <rect x="${x + 185}" y="${rowY + 4}" width="43" height="22" fill="#ccecf4" />
        <text x="${x + 206}" y="${rowY + 20}" class="athlete-year" text-anchor="middle">${escapeXml(year)}</text>
        <rect x="${x + 236}" y="${rowY + 4}" width="86" height="22" fill="#ffd5b8" />
        <text x="${x + 314}" y="${rowY + 20}" class="athlete-mark" text-anchor="end">${escapeXml(athlete.markRaw)}</text>
        <text x="${x + 382}" y="${rowY + 20}" class="athlete-date" text-anchor="end">${escapeXml(meetDate(athlete.meetDate))}</text>
        <text x="${x + 400}" y="${rowY + 20}" class="athlete-meet">${escapeXml(truncate(athlete.meetName, 31))}</text>
      `;
    })
    .join("");
}

function squadBlock(squad: EventSquadRankingRow, index: number) {
  const y = 220 + index * 222;
  const division = squad.athletes[0]?.classification ?? squad.classification;
  const school = truncate(shortSchoolName(squad.school), 24);
  const tableX = 92;

  return `
    <g>
      <rect x="34" y="${y}" width="64" height="66" fill="#6f2c91" />
      <text x="66" y="${y + 39}" class="rank" text-anchor="middle">${escapeXml(squad.rank)}</text>
      <text x="66" y="${y + 58}" class="division-small" text-anchor="middle">${escapeXml(division)}</text>
      <rect x="98" y="${y}" width="520" height="66" fill="#173b67" />
      <text x="118" y="${y + 30}" class="school">${escapeXml(school)}</text>
      <text x="598" y="${y + 30}" class="aggregate" text-anchor="end">${escapeXml(squad.aggregateRaw)}</text>
      <text x="118" y="${y + 54}" class="average">average</text>
      <text x="598" y="${y + 54}" class="average-value" text-anchor="end">${escapeXml(squad.averageRaw)}</text>

      <rect x="${tableX}" y="${y + 66}" width="700" height="24" fill="#dfe7ef" />
      <text x="${tableX + 14}" y="${y + 83}" class="head">Athlete</text>
      <text x="${tableX + 206}" y="${y + 83}" class="head" text-anchor="middle">Yr</text>
      <text x="${tableX + 314}" y="${y + 83}" class="head" text-anchor="end">Mark</text>
      <text x="${tableX + 382}" y="${y + 83}" class="head" text-anchor="end">Date</text>
      <text x="${tableX + 400}" y="${y + 83}" class="head">Meet</text>
      ${athleteRows(squad.athletes, tableX, y + 90)}
    </g>
  `;
}

function buildSvg(options: {
  title: string;
  scope: EventSquadScope;
  topSquads: EventSquadRankingRow[];
  eligibleAthleteCount: number;
}) {
  const rows = options.topSquads.length
    ? options.topSquads.map((squad, index) => squadBlock(squad, index)).join("")
    : `<text x="600" y="650" text-anchor="middle" class="empty">No schools have four eligible marks for this event yet.</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(options.title)} ${escapeXml(scopeLabel(options.scope))} event squad rankings">
  <style>
    .kicker { fill: #111827; font: italic 900 24px Arial, Helvetica, sans-serif; }
    .title { fill: #000000; font: 900 44px Arial, Helvetica, sans-serif; }
    .brand { fill: #d42f55; font: italic 900 28px Arial, Helvetica, sans-serif; }
    .strip { fill: #111827; font: 900 22px Arial, Helvetica, sans-serif; }
    .strip-small { fill: #172554; font: 800 15px Arial, Helvetica, sans-serif; }
    .rank { fill: #ffffff; font: 900 33px Arial, Helvetica, sans-serif; }
    .division-small { fill: #ffffff; font: 900 12px Arial, Helvetica, sans-serif; }
    .school { fill: #ffffff; font: 900 28px Arial, Helvetica, sans-serif; }
    .aggregate { fill: #ffffff; font: 900 24px Arial, Helvetica, sans-serif; }
    .average { fill: #ffffff; font: italic 800 13px Arial, Helvetica, sans-serif; }
    .average-value { fill: #ffffff; font: italic 900 17px Arial, Helvetica, sans-serif; }
    .head { fill: #475569; font: 900 13px Arial, Helvetica, sans-serif; letter-spacing: 0.8px; text-transform: uppercase; }
    .athlete-name { fill: #172554; font: 700 18px Arial, Helvetica, sans-serif; }
    .athlete-year { fill: #0f2a47; font: 900 13px Arial, Helvetica, sans-serif; }
    .athlete-mark { fill: #172554; font: 900 16px Arial, Helvetica, sans-serif; }
    .athlete-date { fill: #111827; font: 800 14px Arial, Helvetica, sans-serif; }
    .athlete-meet { fill: #111827; font: italic 500 14px Arial, Helvetica, sans-serif; }
    .footer { fill: #111827; font: 900 16px Arial, Helvetica, sans-serif; }
    .empty { fill: #64748b; font: 800 28px Arial, Helvetica, sans-serif; }
  </style>

  <rect width="1200" height="1200" fill="#ffffff" />
  <rect x="34" y="34" width="1132" height="5" fill="#223cff" />
  <rect x="34" y="45" width="1132" height="5" fill="#ff1616" />

  <text x="160" y="83" class="kicker">Colorado High School Outdoor Track &amp; Field</text>
  <text x="160" y="124" class="title">#EventSquad Rankings</text>
  <text x="1128" y="82" class="brand" text-anchor="end">Athletic-style</text>
  <text x="1128" y="112" class="brand" text-anchor="end">SquadMark CO</text>

  <rect x="43" y="142" width="1114" height="40" fill="#ffffff" stroke="#6f2c91" stroke-width="5" />
  <text x="600" y="169" class="strip" text-anchor="middle">${escapeXml(options.title)} — ${escapeXml(scopeLabel(options.scope))}</text>
  <text x="1140" y="169" class="strip-small" text-anchor="end">${escapeXml(options.eligibleAthleteCount)} eligible marks</text>

  ${rows}

  <line x1="34" y1="1130" x2="1166" y2="1130" stroke="#cbd5e1" stroke-width="1" />
  <text x="34" y="1155" class="footer">State list</text>
  <text x="600" y="1155" class="footer" text-anchor="middle">SquadMark CO</text>
  <text x="1166" y="1155" class="footer" text-anchor="end">Best four combined</text>
</svg>`;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawEvent = params.get("event") ?? "";
  const rawScope = params.get("scope") ?? params.get("class") ?? "";
  const rawGender = params.get("gender") ?? "";

  if (rawEvent.length > 64 || rawScope.length > 16 || rawGender.length > 16) {
    return apiError("Query parameters are too long.");
  }

  const gender = resolveGender(params.get("gender"));
  const event = eventDefinitionsBySlug.get(rawEvent);
  const scope = resolveScope(params.get("scope"), params.get("class"));

  if (!event || event.relay || !event.genders.includes(gender)) {
    return new Response("Select a valid individual event for a team picture.", {
      status: 400,
    });
  }

  const ranking = await getEventSquadRankingForSelection({
    classification: scope,
    event: event.event,
    gender,
  });
  const svg = buildSvg({
    title: `${gender} ${event.displayName}`,
    scope,
    topSquads: ranking.squads.slice(0, 4),
    eligibleAthleteCount: ranking.eligibleAthleteCount,
  });

  return new Response(svg, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Disposition": `inline; filename="${fileName([
        scope,
        gender,
        event.slug,
        "top-4",
      ])}"`,
      "Content-Type": "image/svg+xml; charset=utf-8",
    },
  });
}

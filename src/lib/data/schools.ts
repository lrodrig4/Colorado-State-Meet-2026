import type { Gender, School } from "@/types/domain";
import {
  trackBulletinAbbreviationRows,
  trackBulletinSchoolRows,
  type TrackBulletinAbbreviationRow,
} from "@/lib/data/trackBulletinSchools.generated";
import { slugify } from "@/lib/utils/text";

const BULLETIN_SOURCE = "chsaa_track_bulletin_2026" as const;
const BULLETIN_FILE = "Track Bulletin.pdf";

const suffixPatterns = [
  /\bjunior-senior\b/gi,
  /\bjunior senior\b/gi,
  /\bjr\.?\/sr\.?\b/gi,
  /\bjr\.?\s*sr\.?\b/gi,
  /\bmiddle\/senior\b/gi,
  /\bmiddle-senior\b/gi,
  /\bmiddle-high\b/gi,
  /\bsenior\b/gi,
  /\bsecondary\b/gi,
  /\bundivided\b/gi,
  /\bcampus\b/gi,
  /\bhigh school\b/gi,
  /\bschools\b/gi,
  /\bschool\b/gi,
  /\bdistrict\b/gi,
  /\bpk-12\b/gi,
  /\bprek-12\b/gi,
  /\bk-12\b/gi,
  /\br-\d+\b/gi,
  /\b\d+jt\b/gi,
];

export function normalizeSchoolLookupKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/&/g, " and ")
    .replace(/\(([a-z]{2})\)/gi, " ")
    .replace(/\bco\./gi, "colorado")
    .replace(/\bcolo\./gi, "colorado")
    .replace(/\(boys?\)|\(girls?\)/gi, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function compactKey(value: string): string {
  return normalizeSchoolLookupKey(value).replace(/\s+/g, "");
}

function withoutGenericSchoolWords(value: string): string {
  return suffixPatterns
    .reduce((current, pattern) => current.replace(pattern, " "), value)
    .replace(/\bthe\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseAlias(value: string): string {
  const small = new Set(["of", "and", "the", "for"]);
  return normalizeSchoolLookupKey(value)
    .split(" ")
    .filter(Boolean)
    .map((part, index) =>
      index > 0 && small.has(part)
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

function unique(values: Array<string | undefined>) {
  const byKey = new Map<string, string>();
  for (const value of values) {
    const clean = value?.replace(/\s+/g, " ").trim();
    if (!clean) continue;
    byKey.set(normalizeSchoolLookupKey(clean), clean);
  }
  return [...byKey.values()];
}

function baseAliases(schoolName: string): string[] {
  const withoutGender = schoolName.replace(/\s+\((Boys|Girls)\)$/i, "");
  const stripped = withoutGenericSchoolWords(withoutGender);
  const withoutLeadingThe = withoutGender.replace(/^The\s+/i, "");
  const strippedWithoutThe = stripped.replace(/^The\s+/i, "");

  return unique([
    schoolName,
    withoutGender,
    withoutLeadingThe,
    stripped,
    strippedWithoutThe,
    titleCaseAlias(stripped),
  ]);
}

const abbreviationRowsByAlias = new Map<string, TrackBulletinAbbreviationRow[]>();
for (const row of trackBulletinAbbreviationRows) {
  const aliases = unique([
    row.name,
    titleCaseAlias(row.name),
    withoutGenericSchoolWords(row.name),
  ]);
  for (const alias of aliases) {
    const key = compactKey(alias);
    abbreviationRowsByAlias.set(key, [
      ...(abbreviationRowsByAlias.get(key) ?? []),
      row,
    ]);
  }
}

const abbreviationNameAliasesBySchool: Record<string, string[]> = {
  "Arickaree/Woodlin Undivided High School": ["ARICKAREE", "WOODLIN"],
  "Bethune Public Schools": ["BETHUNE"],
  "Kim/Branson Undivided High School": ["KIM", "BRANSON"],
  "South Baca Co-op": ["SOUTH BACA (CAMPO/PRITCHETT/VILAS)", "CAMPO", "PRITCHETT", "VILAS"],
  "Springfield Junior/Senior High School": ["SPRINGFIELD"],
  "Cheyenne Wells Junior/High School": ["CHEYENNE WELLS"],
  "Cripple Creek-Victor Junior/Senior High School": ["CRIPPLE CREEK-VICTOR"],
  "Miami-Yoder Middle/High School": ["MIAMI-YODER"],
  "Evangel Christian Academy": ["EVANGELICAL CHRISTIAN"],
  "Flagler Public School": ["FLAGLER"],
  "Atlas Preparatory High School": ["ATLAS PREP"],
  "Bishop Machebeuf Catholic High School": ["MACHEBEUF (BISHOP)"],
  "Sedgwick County Co-Op": ["SEDGWICK COUNTY (JULESBURG/REVERE)"],
  "Liberty Tree Academy": ["LIBERTY TREE"],
  "Swallows Charter Academy": ["SWALLOWS CHARTER ACAD."],
  "Colorado Springs Christian Schools": ["COLO. SPGS. CHRISTIAN"],
  "Crested Butte Secondary School": ["CRESTED BUTTE COMM."],
  "Lotus School for Excellence": ["LOTUS SCHOOL"],
  "Twin Peaks Charter Academy": ["TWIN PEAKS CHARTER"],
  "Del Norte High Jr./Sr. High School": ["DEL NORTE"],
  "Dolores Huerta": ["DOLORES HUERTA PREP"],
  "Peak to Peak Charter School": ["PEAK TO PEAK H.S."],
  "Academy of Charter Schools": ["ACADEMY (THE)"],
  "Alameda International Jr/Sr High School": ["ALAMEDA"],
  "Frontier Charter Academy": ["FRONTIER ACADEMY"],
  "Banning Lewis Ranch Academy": ["BANNING LEWIS"],
  "The Pinnacle Charter School": ["PINNACLE (THE)"],
  "Liberty Common Charter School": ["LIBERTY COMMON"],
  "Grand Junction Central": ["CENTRAL-GRAND JCT."],
  "Fountain-Fort Carson High School": ["FTN. -FORT CARSON"],
  "Regis Jesuit High School": ["REGIS JESUIT (B)"],
  "Liberty High School": ["LIBERTY (CS)"],
  "Vista Peak 9-12 Preparatory": ["VISTA PEAK"],
};

const schoolNameAliasesBySchool: Record<string, string[]> = {
  "Banning Lewis Ranch Academy": [
    "Banning Lewis Academy",
    "Banning Lewis Preparatory Academy",
    "Banning Lewis Prep",
  ],
  "Chatfield High School": ["Chatfield Senior High School"],
  "Conifer Senior High School": ["Conifer High School"],
  "D'Evelyn Jr/Sr High School": ["D'Evelyn High School"],
  "Dakota Ridge Senior High School": ["Dakota Ridge High School"],
  "Discovery Canyon Campus High School": ["Discovery Canyon High School"],
  "Forge Christian Academy": ["Forge Christian High School"],
  "Grand Junction Central": [
    "Central Grand Junction High School",
    "Central Grand Junction",
  ],
  "Pueblo Centennial": ["Pueblo Centennial High School"],
  "Pueblo Central": ["Central High School", "Pueblo Central High School"],
  "Pueblo South": ["Pueblo South High School"],
  "Abraham Lincoln High School": ["Lincoln"],
  "Academy of Charter Schools": ["The Academy", "The Academy of Charter Schools"],
  "James Irwin Charter High School": ["James Irwin"],
  "John F Kennedy High School": ["Kennedy", "John F. Kennedy High School"],
  "Peak to Peak Charter School": ["Peak to Peak"],
  "Ralston Valley Senior High School": ["Ralston Valley High School"],
  "Stargate Charter School": ["Stargate School", "Stargate High School"],
  "The Pinnacle Charter School": ["The Pinnacle"],
  "Timnath Middle-High School": ["Timnath High School"],
  "Vista Peak 9-12 Preparatory": [
    "Vista PEAK Prep",
    "Vista Peak Prep",
    "Vista Peak High School",
  ],
};

function abbreviationRowsForAliases(aliases: string[]) {
  const matches = new Map<string, TrackBulletinAbbreviationRow>();
  for (const alias of aliases) {
    const rows = abbreviationRowsByAlias.get(compactKey(alias));
    for (const row of rows ?? []) {
      matches.set(`${row.name}|${row.abbreviation}`, row);
    }
  }
  return [...matches.values()];
}

function findAbbreviationsForSchool(schoolName: string) {
  const aliases = [
    ...baseAliases(schoolName),
    ...(abbreviationNameAliasesBySchool[schoolName] ?? []),
  ];

  const matches = abbreviationRowsForAliases(aliases);
  if (matches.length) {
    return matches;
  }

  for (const alias of baseAliases(schoolName)) {
    const matches = abbreviationRowsByAlias.get(compactKey(alias));
    if (matches?.length) {
      return [matches[0]];
    }
  }
  return [];
}

const uniqueSchoolRows = [
  ...new Map(
    trackBulletinSchoolRows.map((row) => [
      `${row.schoolName}|${row.classification}`,
      row,
    ]),
  ).values(),
];

export const schools: School[] = uniqueSchoolRows.map((row) => {
  const abbreviations = findAbbreviationsForSchool(row.schoolName);
  const abbreviation = abbreviations[0];
  const aliases = unique([
    ...baseAliases(row.schoolName),
    ...(schoolNameAliasesBySchool[row.schoolName] ?? []),
    ...abbreviations.flatMap((abbreviationRow) => [
      abbreviationRow.name,
      titleCaseAlias(abbreviationRow.name),
      abbreviationRow.abbreviation,
    ]),
  ]);

  return {
    id: slugify(`${row.schoolName}-${row.classification}`),
    schoolName: row.schoolName,
    classification: row.classification,
    abbreviation: abbreviation?.abbreviation,
    aliases,
    city: "",
    state: "CO",
    chsaaMember: true,
    lastVerified: "2026 Track Bulletin",
    source: BULLETIN_SOURCE,
    sourceFile: BULLETIN_FILE,
    sourcePage: row.sourcePage,
    abbreviationSourcePage: abbreviation?.sourcePage,
  };
});

const canonicalByExactName = new Map<string, School[]>();
for (const school of schools) {
  const key = normalizeSchoolLookupKey(school.schoolName);
  const current = canonicalByExactName.get(key) ?? [];
  canonicalByExactName.set(key, [...current, school]);
}

const schoolsByLookupKey = new Map<string, School[]>();
function addLookupKey(key: string, school: School) {
  const current = schoolsByLookupKey.get(key) ?? [];
  if (!current.some((existing) => existing.id === school.id)) {
    schoolsByLookupKey.set(key, [...current, school]);
  }
}

for (const school of schools) {
  for (const alias of [school.schoolName, ...school.aliases]) {
    const key = normalizeSchoolLookupKey(alias);
    const compact = compactKey(alias);
    addLookupKey(key, school);
    addLookupKey(compact, school);
  }
}

function chooseGenderSpecificMatch(matches: School[], gender?: Gender) {
  if (matches.length <= 1) return matches[0];
  if (!gender) return undefined;

  const gendered = matches.filter((school) =>
    school.schoolName.toLowerCase().includes(`(${gender.toLowerCase()})`),
  );
  return gendered.length === 1 ? gendered[0] : undefined;
}

export function findSchoolByNameOrAlias(
  schoolName: string,
  gender?: Gender,
): School | undefined {
  const exact = canonicalByExactName.get(normalizeSchoolLookupKey(schoolName));
  const exactMatch = exact ? chooseGenderSpecificMatch(exact, gender) : undefined;
  if (exactMatch) return exactMatch;

  const candidates = unique([
    schoolName,
    withoutGenericSchoolWords(schoolName),
    titleCaseAlias(withoutGenericSchoolWords(schoolName)),
  ]);

  for (const candidate of candidates) {
    const key = normalizeSchoolLookupKey(candidate);
    const compact = compactKey(candidate);
    const matches = schoolsByLookupKey.get(key) ?? schoolsByLookupKey.get(compact);
    const match = matches ? chooseGenderSpecificMatch(matches, gender) : undefined;
    if (match) return match;
  }

  return undefined;
}

export const schoolsByName = new Map(
  schools.map((school) => [school.schoolName.toLowerCase(), school]),
);

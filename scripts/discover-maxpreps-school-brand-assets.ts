import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { localSchoolBrandAssets } from "@/lib/data/schoolBranding.generated";
import { schools } from "@/lib/data/schools";
import { schoolBrandAssetId } from "@/lib/services/schoolBranding";
import type { Classification } from "@/types/domain";
import type { SchoolBrandAsset } from "@/types/schoolBranding";

type MaxPrepsSchoolInfo = {
  name?: string;
  fullName?: string;
  city?: string;
  mascot?: string;
  color1?: string;
  color2?: string;
  mascotUrl?: string;
  canonicalUrl?: string;
  stateCode?: string;
};

type MaxPrepsPageData = {
  props?: {
    pageProps?: {
      schoolContext?: {
        schoolInfo?: MaxPrepsSchoolInfo;
      };
      groupings?: Array<{
        name?: string;
        canonicalUrl?: string;
        mascotUrl?: string;
        city?: string;
        state?: string;
      }>;
    };
  };
};

type DiscoveryResult = {
  requestedSchoolName: string;
  classification: Classification;
  schoolId: string;
  matched: boolean;
  score: number;
  searchQuery: string;
  sourceUrl?: string;
  asset?: SchoolBrandAsset;
  candidates: Array<{
    url: string;
    name?: string;
    mascot?: string;
    score: number;
  }>;
};

const classifications = new Set(["1A", "2A", "3A", "4A", "5A"]);
const classificationOrder: Classification[] = ["1A", "2A", "3A", "4A", "5A"];
const userAgent =
  "Mozilla/5.0 (compatible; ColoradoDistanceQualifierTracker/1.0; +https://colorado-distance-qualifier-tracker.vercel.app)";
const knownMaxPrepsProfiles: Record<string, string> = {
  "discovery-canyon-campus-high-school-4a":
    "https://www.maxpreps.com/co/colorado-springs/discovery-canyon-thunder/",
  "george-washington-high-school-4a":
    "https://www.maxpreps.com/co/denver/george-washington-patriots/",
  "timnath-middle-high-school-4a":
    "https://www.maxpreps.com/co/timnath/timnath-cubs/",
  "de-beque-pk-12-school-district-49jt-1a":
    "https://www.maxpreps.com/co/de-beque/de-beque-dragons/",
  "arickaree-woodlin-undivided-high-school-1a":
    "https://www.maxpreps.com/co/anton/arickaree-woodlin-indians/",
  "denver-academy-of-torah-1a":
    "https://www.maxpreps.com/co/denver/denver-academy-of-torah-wolves/",
  "flagler-public-school-1a":
    "https://www.maxpreps.com/co/flagler/flagler-panthers/",
  "hi-plains-school-district-r-23-1a":
    "https://www.maxpreps.com/co/seibert/hi-plains-patriots/",
  "kim-branson-undivided-high-school-1a":
    "https://www.maxpreps.com/co/kim/kim-branson-mustangs/",
  "lone-star-undivided-high-school-1a":
    "https://www.maxpreps.com/co/otis/lone-star-longhorns/",
  "mcclave-undivided-high-school-1a":
    "https://www.maxpreps.com/co/mcclave/mcclave-cardinals/",
  "pawnee-school-pk-12-1a":
    "https://www.maxpreps.com/co/grover/pawnee-coyotes/",
  "sangre-de-cristo-undivided-high-school-1a":
    "https://www.maxpreps.com/co/mosca/sangre-de-cristo-thunderbirds/",
  "south-baca-co-op-1a":
    "https://www.maxpreps.com/co/vilas/south-baca-campo-vilas-pritchett-patriots/",
  "calhan-secondary-school-2a":
    "https://www.maxpreps.com/co/calhan/calhan-bulldogs/",
  "dolores-secondary-school-2a":
    "https://www.maxpreps.com/co/dolores/dolores-bears/",
  "gilpin-county-undivided-high-school-2a":
    "https://www.maxpreps.com/co/black-hawk/gilpin-county/",
  "hoehne-schools-2a":
    "https://www.maxpreps.com/co/hoehne/hoehne-farmers/",
  "twin-peaks-charter-academy-2a":
    "https://www.maxpreps.com/co/longmont/twin-peaks-classical-academy-timberwolves/",
  "banning-lewis-ranch-academy-3a":
    "https://www.maxpreps.com/co/colorado-springs/banning-lewis-academy-stallions/",
  "frontier-charter-academy-3a":
    "https://www.maxpreps.com/co/greeley/frontier-academy-wolverines/",
  "james-irwin-charter-high-school-3a":
    "https://www.maxpreps.com/co/colorado-springs/james-irwin-jaguars/",
  "the-pinnacle-charter-school-3a":
    "https://www.maxpreps.com/co/federal-heights/the-pinnacle-timberwolves/",
};
const knownExternalAssets: Record<
  string,
  Omit<SchoolBrandAsset, "schoolId" | "schoolName" | "classification" | "updatedAt">
> = {
  "mountain-range-high-school-5a": {
    mascotName: "Mustangs",
    mascotPublicUrl:
      "https://resources.finalsite.net/images/f_auto,q_auto,t_image_size_1/v1653723980/adams12org/tnqj8sysgbnefzi9noxg/Mustangs_horses_MURAL-ai.png",
    sourceUrl: "https://mountainrange.adams12.org/our-school/about-us",
    sourceLabel: "Official Mountain Range site",
    licenseStatus: "approved",
    dominantColor: "#046dff",
    accentColor: "#222222",
  },
};
let coloradoDirectoryProfiles:
  | Array<{ name?: string; canonicalUrl: string; mascotUrl?: string; city?: string }>
  | undefined;

function getArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function assertClassification(value: string): asserts value is Classification {
  if (!classifications.has(value)) {
    throw new Error(`Invalid --classification=${value}. Use 1A, 2A, 3A, 4A, or 5A.`);
  }
}

function selectedClassifications(value: string): Classification[] {
  if (value.toLowerCase() === "all") {
    return classificationOrder;
  }

  assertClassification(value);
  return [value];
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanSchoolName(value: string) {
  return value
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(campus|junior|senior|middle|high|school|jr|sr)\b/gi, " ")
    .replace(/[./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreKey(value: string | undefined) {
  return cleanSchoolName(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function scoreCandidate(
  targetSchoolName: string,
  info: MaxPrepsSchoolInfo,
  aliases: string[] = [],
) {
  const targets = [targetSchoolName, ...aliases].map(scoreKey).filter(Boolean);
  const names = [info.name, info.fullName].map(scoreKey).filter(Boolean);
  let best = 0;

  for (const target of targets) {
    const compactTarget = target.replace(/\s+/g, "");

    for (const candidate of names) {
      const compactCandidate = candidate.replace(/\s+/g, "");

      if (candidate === target || compactCandidate === compactTarget) {
        best = Math.max(best, 100);
        continue;
      }

      if (candidate.includes(target) || target.includes(candidate)) {
        best = Math.max(best, 82);
      }

      const targetTokens = new Set(target.split(" ").filter(Boolean));
      const candidateTokens = new Set(candidate.split(" ").filter(Boolean));
      const overlap = [...targetTokens].filter((token) => candidateTokens.has(token));
      const overlapScore =
        targetTokens.size > 0 ? (overlap.length / targetTokens.size) * 76 : 0;
      best = Math.max(best, Math.round(overlapScore));
    }
  }

  if (info.stateCode === "CO") best += 8;
  return Math.min(100, best);
}

function parseNextData(html: string): MaxPrepsPageData | undefined {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/,
  );

  if (!match) return undefined;

  try {
    return JSON.parse(match[1]) as MaxPrepsPageData;
  } catch {
    return undefined;
  }
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": userAgent },
  });

  if (!response.ok) {
    throw new Error(`${response.status} while fetching ${url}`);
  }

  return response.text();
}

async function getColoradoDirectoryProfiles() {
  if (coloradoDirectoryProfiles) return coloradoDirectoryProfiles;

  const html = await fetchHtml("https://www.maxpreps.com/co/schools/");
  const data = parseNextData(html);
  coloradoDirectoryProfiles =
    data?.props?.pageProps?.groupings
      ?.filter((profile) => profile.canonicalUrl)
      .map((profile) => ({
        name: profile.name,
        canonicalUrl: profile.canonicalUrl!,
        mascotUrl: profile.mascotUrl,
        city: profile.city,
      })) ?? [];

  return coloradoDirectoryProfiles;
}

async function directoryProfileUrlsForSchool(
  schoolName: string,
  aliases: string[],
) {
  const profiles = await getColoradoDirectoryProfiles();

  return profiles
    .map((profile) => ({
      url: profile.canonicalUrl,
      score: scoreCandidate(
        schoolName,
        {
          name: profile.name,
          fullName: profile.name,
          stateCode: "CO",
        },
        aliases,
      ),
    }))
    .filter((profile) => profile.score >= 80)
    .sort((a, b) => b.score - a.score)
    .map((profile) => profile.url);
}

function extractSchoolProfileUrls(html: string) {
  const urls = new Set<string>();
  const hrefPattern = /href="(\/co\/[^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = hrefPattern.exec(html))) {
    const segments = match[1].split("/").filter(Boolean);
    if (segments.length < 3 || segments[0] !== "co") continue;

    urls.add(`https://www.maxpreps.com/${segments.slice(0, 3).join("/")}/`);
  }

  return [...urls];
}

function pngMascotUrl(mascotUrl: string) {
  const url = new URL(mascotUrl);
  url.searchParams.set("width", "256");
  url.searchParams.set("height", "256");
  url.searchParams.set("format", "png");
  url.searchParams.delete("auto");
  return url.toString();
}

function hexColor(value: string | undefined) {
  const clean = value?.trim();
  return clean && /^[0-9A-Fa-f]{6}$/.test(clean) ? `#${clean.toLowerCase()}` : undefined;
}

async function discoverSchool(
  schoolName: string,
  classification: Classification,
  aliases: string[] = [],
): Promise<DiscoveryResult> {
  const searchQuery = cleanSchoolName(schoolName);
  const searchUrl = `https://www.maxpreps.com/search/?q=${encodeURIComponent(
    searchQuery,
  )}`;
  const schoolId = schoolBrandAssetId(schoolName, classification);
  const externalAsset = knownExternalAssets[schoolId];

  if (externalAsset) {
    return {
      requestedSchoolName: schoolName,
      classification,
      schoolId,
      matched: true,
      score: 100,
      searchQuery,
      sourceUrl: externalAsset.sourceUrl,
      asset: {
        schoolId,
        schoolName,
        classification,
        ...externalAsset,
        updatedAt: new Date().toISOString(),
      },
      candidates: [
        {
          url: externalAsset.sourceUrl ?? "",
          name: schoolName,
          mascot: externalAsset.mascotName,
          score: 100,
        },
      ],
    };
  }

  const knownProfileUrl = knownMaxPrepsProfiles[schoolId];
  const directoryProfileUrls = await directoryProfileUrlsForSchool(
    schoolName,
    aliases,
  );
  const searchHtml = await fetchHtml(searchUrl);
  const profileUrls = [
    ...(knownProfileUrl ? [knownProfileUrl] : []),
    ...directoryProfileUrls,
    ...extractSchoolProfileUrls(searchHtml),
  ].slice(0, 8);
  const candidates: DiscoveryResult["candidates"] = [];
  let best:
    | {
        url: string;
        score: number;
        info: MaxPrepsSchoolInfo;
      }
    | undefined;

  for (const profileUrl of profileUrls) {
    await wait(90);
    let html: string;
    try {
      html = await fetchHtml(profileUrl);
    } catch {
      continue;
    }
    const info = parseNextData(html)?.props?.pageProps?.schoolContext?.schoolInfo;
    if (!info) continue;

    const score = scoreCandidate(schoolName, info, aliases);
    candidates.push({
      url: info.canonicalUrl || profileUrl,
      name: info.name || info.fullName,
      mascot: info.mascot,
      score,
    });

    if (!best || score > best.score) {
      best = { url: info.canonicalUrl || profileUrl, score, info };
    }
  }

  if (!best || best.score < 60 || !best.info.mascotUrl) {
    return {
      requestedSchoolName: schoolName,
      classification,
      schoolId,
      matched: false,
      score: best?.score ?? 0,
      searchQuery,
      candidates,
    };
  }

  const asset: SchoolBrandAsset = {
    schoolId,
    schoolName,
    classification,
    mascotName: best.info.mascot,
    mascotPublicUrl: pngMascotUrl(best.info.mascotUrl),
    sourceUrl: best.url,
    sourceLabel: "MaxPreps school profile",
    licenseStatus: "approved",
    dominantColor: hexColor(best.info.color1),
    accentColor: hexColor(best.info.color2),
    updatedAt: new Date().toISOString(),
  };

  return {
    requestedSchoolName: schoolName,
    classification,
    schoolId,
    matched: true,
    score: best.score,
    searchQuery,
    sourceUrl: best.url,
    asset,
    candidates,
  };
}

function assetToCode(asset: SchoolBrandAsset) {
  const entries = Object.entries(asset).filter(
    ([, value]) => value !== undefined && value !== "",
  );

  return [
    `  ${JSON.stringify(asset.schoolId)}: {`,
    ...entries.map(([key, value]) => `    ${key}: ${JSON.stringify(value)},`),
    "  },",
  ].join("\n");
}

async function writeGeneratedAssets(assets: SchoolBrandAsset[]) {
  const outputPath = path.resolve("src/lib/data/schoolBranding.generated.ts");
  const byId = new Map<string, SchoolBrandAsset>();

  for (const asset of Object.values(localSchoolBrandAssets)) {
    byId.set(asset.schoolId, asset);
  }
  for (const asset of assets) {
    byId.set(asset.schoolId, asset);
  }

  const mergedAssets = [...byId.values()];
  const body = [
    'import type { SchoolBrandAsset } from "@/types/schoolBranding";',
    "",
    "export const localSchoolBrandAssets: Record<string, SchoolBrandAsset> = {",
    ...mergedAssets
      .sort(
        (a, b) =>
          a.classification.localeCompare(b.classification) ||
          a.schoolName.localeCompare(b.schoolName),
      )
      .map(assetToCode),
    "};",
    "",
  ].join("\n");

  await writeFile(outputPath, body, "utf8");
}

async function main() {
  const classificationArg = getArg("classification") || getArg("class") || "all";
  const requestedClassifications = selectedClassifications(classificationArg);
  const reportScope =
    requestedClassifications.length === classificationOrder.length
      ? "all"
      : requestedClassifications[0].toLowerCase();

  const outputPath = path.resolve(
    getArg("out") ||
      `reports/${reportScope}-maxpreps-school-brand-assets.json`,
  );
  const selectedSchools = schools
    .filter((school) => requestedClassifications.includes(school.classification))
    .sort(
      (a, b) =>
        a.classification.localeCompare(b.classification) ||
        a.schoolName.localeCompare(b.schoolName),
    );
  const results: DiscoveryResult[] = [];

  for (const [index, school] of selectedSchools.entries()) {
    await wait(160);
    let result: DiscoveryResult;
    try {
      result = await discoverSchool(
        school.schoolName,
        school.classification,
        school.aliases,
      );
    } catch {
      result = {
        requestedSchoolName: school.schoolName,
        classification: school.classification,
        schoolId: schoolBrandAssetId(school.schoolName, school.classification),
        matched: false,
        score: 0,
        searchQuery: cleanSchoolName(school.schoolName),
        candidates: [],
      };
    }
    results.push(result);
    const status = result.matched ? "matched" : "missing";
    console.log(
      `${index + 1}/${selectedSchools.length} ${status}: ${school.classification} ${school.schoolName} (${result.score})`,
    );
  }

  const assets = results.flatMap((result) => (result.asset ? [result.asset] : []));

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
  await writeGeneratedAssets(assets);

  console.log(
    `Wrote ${assets.length}/${selectedSchools.length} approved MaxPreps brand asset(s).`,
  );
  console.log(`Discovery report: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

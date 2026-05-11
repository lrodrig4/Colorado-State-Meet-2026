import * as cheerio from "cheerio";
import type {
  DiscoveredSource,
  SourceDiscoveryResult,
  SourceKind,
} from "@/types/domain";
import { fetchSafeText, SafeFetchError } from "@/lib/server/safeFetch";

const KEYWORDS = [
  "live results",
  "results",
  "timing",
  "tfmeetpro",
  "athletic.net",
  "finishedresults",
  "rapid results",
  "rapidresults",
  "vnc",
  "hytek",
  "maxpreps",
];

function classifySource(url: string, label: string): DiscoveredSource | undefined {
  const haystack = `${url} ${label}`.toLowerCase();
  let source: SourceKind = "generic";
  let score = 20;
  const reasons: string[] = [];

  if (/tfmeetpro|finishedresults|rapidresults|rapid-results|vnc|hytek|timing/.test(haystack)) {
    source = "official_timing";
    score = 100;
    reasons.push("official timing keyword");
  } else if (/athletic\.net/.test(haystack)) {
    source = "athletic_net";
    score = 80;
    reasons.push("Athletic.net live/results source");
  } else if (/milesplit/.test(haystack) && /result/.test(haystack)) {
    source = "milesplit";
    score = 60;
    reasons.push("MileSplit results page");
  } else if (/maxpreps/.test(haystack)) {
    source = "maxpreps";
    score = 45;
    reasons.push("MaxPreps source");
  } else if (KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    score = 35;
    reasons.push("results-related keyword");
  } else {
    return undefined;
  }

  if (/live/.test(haystack)) {
    score += 8;
    reasons.push("live results wording");
  }

  return {
    url,
    source,
    score,
    label: label || url,
    reason: reasons.join(", "),
  };
}

function extractTimingCompany(sources: DiscoveredSource[]): string | undefined {
  const official = sources.find((source) => source.source === "official_timing");
  if (!official) {
    return undefined;
  }

  const url = official.url.toLowerCase();
  if (url.includes("tfmeetpro")) return "tfmeetpro";
  if (url.includes("finishedresults")) return "FinishedResults";
  if (url.includes("rapid")) return "Rapid Results";
  if (url.includes("vnc")) return "VNC Timing";
  if (url.includes("hytek")) return "Hy-Tek";
  return "Official timing";
}

export function discoverSourcesFromHtml(
  html: string,
  baseUrl: string,
): SourceDiscoveryResult {
  const $ = cheerio.load(html);
  const discovered = new Map<string, DiscoveredSource>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }

    let absolute: string;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      return;
    }

    const label = $(element).text().replace(/\s+/g, " ").trim();
    const source = classifySource(absolute, label);
    if (source) {
      const existing = discovered.get(source.url);
      if (!existing || source.score > existing.score) {
        discovered.set(source.url, source);
      }
    }
  });

  const discoveredSourceUrls = [...discovered.values()].sort(
    (a, b) => b.score - a.score,
  );
  const [primary, ...secondary] = discoveredSourceUrls;

  return {
    primaryResultsUrl: primary?.url,
    secondaryResultsUrls: secondary.map((source) => source.url),
    discoveredSourceUrls,
    timingCompany: extractTimingCompany(discoveredSourceUrls),
    status: primary ? "sources_found" : "needs_review",
    notes: primary
      ? [`Ranked ${discoveredSourceUrls.length} candidate result sources.`]
      : ["No result-like outbound links found."],
  };
}

export async function discoverSourcesFromUrl(
  url: string,
): Promise<SourceDiscoveryResult> {
  try {
    const result = await fetchSafeText(url, {
      maxBytes: 750_000,
      timeoutMs: 10_000,
    });
    return discoverSourcesFromHtml(result.text, result.finalUrl);
  } catch (error) {
    return {
      secondaryResultsUrls: [],
      discoveredSourceUrls: [],
      status: "failed",
      notes: [
        error instanceof SafeFetchError
          ? error.message
          : "Source discovery fetch failed.",
      ],
    };
  }
}

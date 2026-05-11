import type { DataProvider, IngestionRun, Meet } from "@/types/domain";
import { dataProviders } from "@/lib/data/providers";
import { meets } from "@/lib/data/meets";
import { applyClassifications } from "@/lib/services/classification";
import { getSourcePerformances } from "@/lib/services/performanceStore";
import { discoverSourcesFromUrl } from "@/lib/services/sourceDiscovery";
import { buildReviewQueue } from "@/lib/services/review";

export function getDueProviders(
  providers: DataProvider[] = dataProviders,
  now = new Date(),
): DataProvider[] {
  const minute = now.getUTCMinutes();

  return providers.filter((provider) => {
    if (!provider.enabled) {
      return false;
    }

    if (provider.refreshCadenceMinutes <= 120) {
      return true;
    }

    return minute < 15;
  });
}

export function getRecentlyCompletedMeets(
  allMeets: Meet[] = meets,
  now = new Date(),
): Meet[] {
  const nowMs = now.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  return allMeets.filter((meet) => {
    const endDate = meet.endDate ?? meet.startDate ?? meet.date;
    const meetMs = new Date(`${endDate}T23:59:00-06:00`).getTime();
    return (
      !Number.isNaN(meetMs) &&
      meetMs <= nowMs &&
      nowMs - meetMs <= sevenDaysMs
    );
  });
}

export async function runIngestion(options?: {
  providerIds?: string[];
  dryRun?: boolean;
}): Promise<IngestionRun> {
  const startedAt = new Date();
  const providers = dataProviders.filter((provider) =>
    options?.providerIds?.length
      ? options.providerIds.includes(provider.id)
      : provider.enabled,
  );
  const recentMeets = getRecentlyCompletedMeets();
  const notes: string[] = [];
  let sourceUrlsDiscovered = 0;

  for (const meet of recentMeets.filter((item) => item.mileSplitUrl)) {
    try {
      const discovery = await discoverSourcesFromUrl(meet.mileSplitUrl!);
      sourceUrlsDiscovered += discovery.discoveredSourceUrls.length;
      notes.push(
        `${meet.name}: ${discovery.status} with ${discovery.discoveredSourceUrls.length} candidate sources.`,
      );
    } catch (error) {
      notes.push(
        `${meet.name}: source discovery failed (${error instanceof Error ? error.message : "unknown error"}).`,
      );
    }
  }

  const classifiedPerformances = applyClassifications(await getSourcePerformances());
  const flaggedCandidates = buildReviewQueue(classifiedPerformances).length;

  return {
    id: `ingestion-${startedAt.toISOString()}`,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    status: "completed",
    providerIds: providers.map((provider) => provider.id),
    meetsDiscovered: recentMeets.length,
    sourceUrlsDiscovered,
    candidatePerformances: classifiedPerformances.length,
    flaggedCandidates,
    notes: [
      options?.dryRun
        ? "Dry run completed; no storage writes were attempted."
        : "Local seed storage mode completed; persistent writes are ready for Supabase integration.",
      "Provider refresh uses official timing links first, then Athletic.net, MileSplit, and MaxPreps fallbacks.",
      ...notes,
    ],
  };
}

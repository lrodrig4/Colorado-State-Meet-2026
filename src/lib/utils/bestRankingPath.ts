import { getEventDefinition } from "@/lib/data/events";
import { rankingPath } from "@/lib/utils/rankingRoutes";
import type { RankingResult } from "@/types/domain";

export function bestRankingPath(rankings: RankingResult[], focusTeam: string) {
  let bestHref: string | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const ranking of rankings) {
    const event = getEventDefinition(ranking.event);
    const href = rankingPath(ranking.gender, event.slug);

    for (const group of [ranking.top18, ranking.bubble]) {
      const row = group.find((entry) => entry.school === focusTeam);
      if (!row) continue;

      const score = row.rank <= 18 ? 100 - row.rank : 30 - (row.rank - 18);
      if (score > bestScore) {
        bestScore = score;
        bestHref = href;
      }
    }
  }

  return bestHref ?? "/rankings";
}

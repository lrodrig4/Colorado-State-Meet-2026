import type { Classification } from "@/types/domain";

type RankingSourceMetadata = {
  generatedAt: string;
  sourceErrors: string[];
};

export const currentMileSplitSeedMetadata = {
  generatedAt: "2026-05-10T18:06:20.782Z",
  sourceErrors: [
    "NCIL Championship: no public MileSplit result rows found at https://co.milesplit.com/meets/735515-ncil-championship-2026/results",
    "NCIL Championship: no public MileSplit result rows found at https://co.milesplit.com/meets/735515-ncil-championship-2026/results",
  ],
} satisfies RankingSourceMetadata;

export const currentAthleticLiveLastChanceMetadata = {
  generatedAt: "2026-05-10T18:06:20.782Z",
  sourceErrors: [],
} satisfies RankingSourceMetadata;

export const maxPrepsMetadataByClassification: Partial<
  Record<Classification, RankingSourceMetadata>
> = {
  "3A": {
    generatedAt: "2026-05-10T18:50:28.306Z",
    sourceErrors: [],
  },
  "4A": {
    generatedAt: "2026-05-10T18:53:29.313Z",
    sourceErrors: [],
  },
  "5A": {
    generatedAt: "2026-05-10T18:55:55.759Z",
    sourceErrors: [],
  },
};

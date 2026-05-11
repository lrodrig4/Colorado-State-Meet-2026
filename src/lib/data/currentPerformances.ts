import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Performance } from "@/types/domain";

type CurrentMileSplitData = {
  currentMileSplitSeedMetadata: {
    generatedAt: string;
    source: string;
    rankingRows: number;
    supplementalRows: number;
    totalRows: number;
    lockedRankingPages: string[];
    sourceErrors: string[];
    lastChanceImport?: {
      generatedAt: string;
      window: string;
      source: string;
      importedRows: number;
      uniqueNewRows: number;
      meetCount: number;
    };
  };
  currentMileSplitPerformances: Performance[];
};

const currentMileSplitDataPath = path.join(
  process.cwd(),
  "src/lib/data/currentPerformances.generated.json",
);

const typedCurrentMileSplitData = JSON.parse(
  readFileSync(currentMileSplitDataPath, "utf8"),
) as CurrentMileSplitData;

export const currentMileSplitSeedMetadata =
  typedCurrentMileSplitData.currentMileSplitSeedMetadata;

export const currentMileSplitPerformances =
  typedCurrentMileSplitData.currentMileSplitPerformances;

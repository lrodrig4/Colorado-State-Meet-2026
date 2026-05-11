import type { Classification } from "@/types/domain";

export type SchoolBrandLicenseStatus = "approved" | "needs_review" | "rejected";

export interface SchoolBrandAsset {
  schoolId: string;
  schoolName: string;
  classification: Classification;
  mascotName?: string;
  mascotAssetPath?: string;
  mascotPublicUrl?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  licenseStatus: SchoolBrandLicenseStatus;
  dominantColor?: string;
  accentColor?: string;
  updatedAt?: string;
}

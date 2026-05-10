import type { Classification } from "@/types/domain";

export const CLASSIFICATION_QUERY_PARAM = "class";

const CLASSIFICATIONS: Classification[] = ["1A", "2A", "3A", "4A", "5A"];
type SearchParamValue = string | string[] | undefined;

function normalizeClassification(value: string | undefined) {
  const normalized = value?.toUpperCase();

  return CLASSIFICATIONS.includes(normalized as Classification)
    ? (normalized as Classification)
    : undefined;
}

export const DEFAULT_CLASSIFICATION: Classification =
  normalizeClassification(process.env.NEXT_PUBLIC_DEFAULT_CLASSIFICATION) ?? "4A";
export const LOCK_CLASSIFICATION =
  process.env.NEXT_PUBLIC_LOCK_CLASSIFICATION === "true";

export function resolveClassification(
  rawClassification: SearchParamValue,
  fallback: Classification = DEFAULT_CLASSIFICATION,
): Classification {
  if (LOCK_CLASSIFICATION) return fallback;

  const requested = Array.isArray(rawClassification)
    ? rawClassification[0]
    : rawClassification;
  return normalizeClassification(requested) ?? fallback;
}

export function withClassificationHref(
  href: string,
  classification: Classification,
) {
  const [path, hash = ""] = href.split("#");
  const separator = path.includes("?") ? "&" : "?";
  const scoped = `${path}${separator}${CLASSIFICATION_QUERY_PARAM}=${classification}`;

  return hash ? `${scoped}#${hash}` : scoped;
}

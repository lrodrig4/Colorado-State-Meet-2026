export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function cleanCell(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function stableId(parts: Array<string | number | undefined>): string {
  return slugify(parts.filter((part) => part !== undefined).join("-"));
}

export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: ReadonlyArray<{ key: keyof T; header: string }>,
): string {
  const escape = (value: unknown) => {
    const text = value === undefined || value === null ? "" : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  };

  return [
    columns.map((column) => escape(column.header)).join(","),
    ...rows.map((row) =>
      columns.map((column) => escape(row[column.key])).join(","),
    ),
  ].join("\n");
}

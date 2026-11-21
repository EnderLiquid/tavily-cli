import { list, record, sanitize, text } from "./data.js";
import { out } from "./stream.js";

function collapse(value: string): string {
  return sanitize(value)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function snippet(value: string, maxChars: number): string {
  const body = collapse(value);
  if (maxChars <= 0) return body;
  if (body.length <= maxChars) return body;
  return `${body.slice(0, maxChars).trimEnd()}…`;
}

export function printSearch(data: unknown, maxChars: number): void {
  const root = record(data);
  const answer = text(root.answer);
  if (answer !== "") {
    out(`Answer: ${collapse(answer)}`);
    out();
  }
  const results = list(root.results);
  results.forEach((item, index) => {
    const result = record(item);
    out(`${index + 1}. ${collapse(text(result.title)) || "Untitled"}`);
    out(sanitize(text(result.url)));
    const content = text(result.content);
    if (content !== "") out(snippet(content, maxChars));
    out();
  });
  if (results.length === 0) out("No results found.");
}

/** 只渲染成功页面；部分失败属于诊断信息。 */
export function printPages(data: unknown): void {
  for (const item of list(record(data).results)) {
    const page = record(item);
    out(`# ${sanitize(text(page.url))}`);
    out();
    out(sanitize(text(page.raw_content)) || "(no content)");
    out();
  }
}

/** 把失败页格式化为 stderr 警告块。 */
export function failureLines(data: unknown): string[] {
  const failed = list(record(data).failed_results);
  if (failed.length === 0) return [];
  const noun = failed.length === 1 ? "page" : "pages";
  return [
    `Failed ${failed.length} ${noun}:`,
    ...failed.map((item) => {
      const failure = record(item);
      return `  ${sanitize(text(failure.url))}: ${sanitize(text(failure.error))}`;
    }),
  ];
}

export function printPaths(paths: string[]): void {
  for (const file of paths) out(file);
}

export function printMap(data: unknown): void {
  for (const item of list(record(data).results)) {
    const url = typeof item === "string" ? item : text(record(item).url);
    out(sanitize(url));
  }
}

export interface UsageRow {
  label: string;
  remaining: number | null;
  unlimited: boolean;
  syncedAt: number | null;
  status: string;
}

export function relativeTime(timestamp: number | null, now = Date.now()): string {
  if (timestamp === null) return "never";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function table(rows: string[][]): void {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, cell.length);
    });
  }
  for (const row of rows) {
    const line = row
      .map((cell, index) => (index === row.length - 1 ? cell : cell.padEnd(widths[index] ?? 0)))
      .join("  ");
    out(line.trimEnd());
  }
}

export function printUsage(rows: UsageRow[]): void {
  const body = rows.map((row) => {
    const remaining = row.unlimited ? "inf" : row.remaining === null ? "-" : String(row.remaining);
    return [row.label, remaining, relativeTime(row.syncedAt), row.status];
  });
  const known = rows.filter(
    (row) =>
      !row.unlimited &&
      row.remaining !== null &&
      row.status !== "invalid" &&
      row.status !== "disabled",
  );
  const total = known.reduce((sum, row) => sum + (row.remaining ?? 0), 0);
  const totalText = known.length === 0 ? "-" : String(total);
  table([["LABEL", "REMAINING", "SYNCED", "STATUS"], ...body]);
  out(`TOTAL  ${totalText}`);
}

export interface KeyRow {
  label: string;
  key: string;
  enabled: boolean;
}

export function printKeys(rows: KeyRow[]): void {
  table([
    ["LABEL", "KEY", "ENABLED"],
    ...rows.map((row) => [row.label, row.key, row.enabled ? "yes" : "no"]),
  ]);
}

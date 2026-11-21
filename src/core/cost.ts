export type SearchDepth = "basic" | "advanced" | "fast" | "ultra-fast";
export type ExtractDepth = "basic" | "advanced";

export function searchCost(depth: SearchDepth): number {
  return depth === "advanced" ? 2 : 1;
}

export function extractCost(urls: number, depth: ExtractDepth): number {
  const per = depth === "advanced" ? 2 : 1;
  return Math.ceil((urls * per) / 5);
}

export function mapCost(limit: number, hasInstructions: boolean): number {
  return Math.ceil(limit / 10) * (hasInstructions ? 2 : 1);
}

export function crawlCost(limit: number, hasInstructions: boolean, depth: ExtractDepth): number {
  const per = depth === "advanced" ? 2 : 1;
  return mapCost(limit, hasInstructions) + Math.ceil((limit * per) / 5);
}

/** `usage.credits` from a response, or null when the field is absent. */
export function creditsOf(response: unknown): number | null {
  if (typeof response !== "object" || response === null) return null;
  const usage = (response as { usage?: unknown }).usage;
  if (typeof usage !== "object" || usage === null) return null;
  const credits = (usage as { credits?: unknown }).credits;
  return typeof credits === "number" && Number.isFinite(credits) ? credits : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

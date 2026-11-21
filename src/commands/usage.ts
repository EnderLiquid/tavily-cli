import type { Command } from "commander";
import { keyId } from "../core/config.js";
import { apiError, configError, usageError } from "../core/errors.js";
import { labelsOf, remainingOf } from "../core/pool.js";
import { type KeyState, readState } from "../core/state.js";
import { syncKey } from "../core/sync.js";
import { printUsage, type UsageRow } from "../ui/render.js";
import { emitJson, log, out } from "../ui/stream.js";
import { jsonFlag, runtime } from "./runtime.js";

export function configure(cmd: Command): void {
  cmd
    .option("--sync", "refresh usage from the API")
    .option("-f, --force", "with --sync, ignore the minimum sync interval")
    .option("--key <label>", "limit --sync to one key");
}

function statusOf(enabled: boolean, state: KeyState | undefined, now: number): string {
  if (!enabled) return "disabled";
  if (state === undefined) return "uncalibrated";
  if (state.invalid !== null) return "invalid";
  if (state.baseRemaining === null && !state.unlimited) return "uncalibrated";
  if (state.cooldownUntil !== null && state.cooldownUntil > now) return "cooldown";
  if (state.unlimited) return "unlimited";
  const remaining = remainingOf(state);
  if (remaining === null) return "uncalibrated";
  if (remaining < 1) return "exhausted";
  return "ok";
}

export async function run(opts: Record<string, unknown>, cmd: Command): Promise<void> {
  const json = jsonFlag(cmd);
  const config = runtime(cmd);
  if (opts.force === true && opts.sync !== true) throw usageError("-f requires --sync");
  const target = typeof opts.key === "string" ? opts.key : undefined;
  if (target !== undefined && !config.keys.some((entry) => entry.label === target)) {
    throw configError(`no key named ${target}`);
  }
  if (opts.sync === true) {
    const targets = config.keys.filter((entry) => target === undefined || entry.label === target);
    if (targets.length === 0) {
      throw usageError("no keys configured; run tavily-cli keys add <label>");
    }
    const outcomes = await Promise.all(
      targets.map((entry) => syncKey(config, entry, { force: opts.force === true })),
    );
    const failures = targets.flatMap((entry, index) => {
      const outcome = outcomes[index];
      return outcome !== undefined && !outcome.ok && !outcome.skipped
        ? [{ label: entry.label, error: outcome.error ?? "unknown error" }]
        : [];
    });
    if (failures.length === outcomes.length) {
      throw apiError(`all ${failures.length} sync request(s) failed`, { failures });
    }
    outcomes.forEach((outcome, index) => {
      const label = targets[index]?.label ?? "?";
      if (outcome.skipped) log(`sync ${label} skipped: ${outcome.error}`);
      else if (!outcome.ok) log(`sync ${label} failed: ${outcome.error}`);
    });
  }

  const state = readState(labelsOf(config));
  const now = Date.now();
  const rows: UsageRow[] = config.keys.map((entry) => {
    const keyStateValue = state.keys[keyId(entry.key)];
    return {
      label: entry.label,
      remaining: keyStateValue === undefined ? null : remainingOf(keyStateValue),
      unlimited: keyStateValue?.unlimited === true,
      syncedAt: keyStateValue?.syncedAt ?? null,
      status: statusOf(entry.enabled, keyStateValue, now),
    };
  });

  if (json) {
    const known = rows.filter(
      (row) =>
        !row.unlimited &&
        row.remaining !== null &&
        row.status !== "invalid" &&
        row.status !== "disabled",
    );
    emitJson({
      keys: rows.map((row) => ({
        label: row.label,
        remaining: row.unlimited ? null : row.remaining,
        unlimited: row.unlimited,
        syncedAt: row.syncedAt,
        status: row.status,
      })),
      total: known.reduce((sum, row) => sum + (row.remaining ?? 0), 0),
    });
    return;
  }
  if (rows.length === 0) {
    out("No keys configured. Run: tavily-cli keys add <label>");
    return;
  }
  printUsage(rows);
}

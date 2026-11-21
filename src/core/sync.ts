import { log } from "../ui/stream.js";
import { type Api, createApi } from "./client.js";
import type { Config, KeyEntry } from "./config.js";
import { keyId } from "./config.js";
import { messageOf } from "./errors.js";
import { labelsOf } from "./pool.js";
import { keyState, updateState } from "./state.js";

export interface SyncOutcome {
  ok: boolean;
  skipped: boolean;
  error?: string;
}

export interface UsageTruth {
  baseRemaining: number | null;
  unlimited: boolean;
  planUsage: number;
}

function asLimit(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error("unexpected /usage limit");
}

function asCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new Error("unexpected /usage usage count");
}

/** Server truth: the smaller of the account plan remainder and the per-key remainder. */
export function usageTruth(raw: unknown): UsageTruth {
  if (typeof raw !== "object" || raw === null) throw new Error("unexpected /usage response");
  const account = (raw as { account?: unknown }).account;
  if (typeof account !== "object" || account === null) {
    throw new Error("unexpected /usage response: missing account");
  }
  const key = (raw as { key?: unknown }).key;
  const keyData = typeof key === "object" && key !== null ? key : {};
  const planLimit = asLimit((account as { plan_limit?: unknown }).plan_limit);
  const planUsage = asCount((account as { plan_usage?: unknown }).plan_usage);
  const keyLimit = asLimit((keyData as { limit?: unknown }).limit);
  const keyUsage = asCount((keyData as { usage?: unknown }).usage);
  const planRemaining = planLimit === null ? Number.POSITIVE_INFINITY : planLimit - planUsage;
  const keyRemaining = keyLimit === null ? Number.POSITIVE_INFINITY : keyLimit - keyUsage;
  if (planRemaining === Number.POSITIVE_INFINITY && keyRemaining === Number.POSITIVE_INFINITY) {
    return { baseRemaining: null, unlimited: true, planUsage };
  }
  return {
    baseRemaining: Math.max(0, Math.min(planRemaining, keyRemaining)),
    unlimited: false,
    planUsage,
  };
}

export interface SyncOptions {
  /** Bypass the minimum interval. */
  force?: boolean;
  /** Use a prebuilt API client, mainly for tests. */
  api?: Api;
  /** Reserved for callers that already hold the lease. */
  now?: number;
}

/**
 * Refresh one key from `/usage`. Returns `skipped` when the lease is held or the
 * minimum interval has not elapsed. Failures are recorded in the state file.
 */
export async function syncKey(
  config: Config,
  entry: KeyEntry,
  options: SyncOptions = {},
): Promise<SyncOutcome> {
  const id = keyId(entry.key);
  const labels = labelsOf(config);
  const now = options.now ?? Date.now();
  const claim = await updateState(labels, (state) => {
    const keyStateValue = keyState(state, id, entry.label);
    if (keyStateValue.syncingUntil !== null && keyStateValue.syncingUntil > now) {
      return { acquired: false as const, reason: "sync already in flight" };
    }
    if (!options.force) {
      const interval = config.minSyncIntervalSec * 1000;
      const last = keyStateValue.lastSyncAttemptAt;
      if (last !== null && now - last < interval) {
        return { acquired: false as const, reason: "minimum sync interval not elapsed" };
      }
    }
    keyStateValue.syncingUntil = now + 5000;
    keyStateValue.lastSyncAttemptAt = now;
    return { acquired: true as const };
  });
  if (!claim.acquired) {
    return { ok: false, skipped: true, error: claim.reason };
  }

  const api = options.api ?? createApi(config.apiBaseUrl, entry.key);
  try {
    const raw = await api.getUsage();
    const truth = usageTruth(raw);
    await updateState(labels, (state) => {
      const keyStateValue = keyState(state, id, entry.label);
      const previous = keyStateValue.planUsage;
      const delta = previous === null ? null : truth.planUsage - previous;
      keyStateValue.baseRemaining = truth.baseRemaining;
      keyStateValue.unlimited = truth.unlimited;
      if (delta === null || delta < 0) {
        // First sync, or the billing period rolled over.
        keyStateValue.settled = 0;
        keyStateValue.penalty = 0;
      } else {
        // Keep whatever the server has not counted yet; it stays pessimistic until it does.
        keyStateValue.settled = Math.max(0, keyStateValue.settled - delta);
        if (delta > 0 || keyStateValue.settled === 0) keyStateValue.penalty = 0;
      }
      keyStateValue.planUsage = truth.planUsage;
      keyStateValue.syncedAt = Date.now();
      keyStateValue.callsSinceSync = 0;
      keyStateValue.syncingUntil = null;
      keyStateValue.lastError = null;
    });
    return { ok: true, skipped: false };
  } catch (error) {
    const message = messageOf(error);
    await updateState(labels, (state) => {
      const keyStateValue = keyState(state, id, entry.label);
      keyStateValue.syncingUntil = null;
      keyStateValue.lastError = message;
    });
    return { ok: false, skipped: false, error: message };
  }
}

/** Run a background sync and report failures on stderr without failing the command. */
export function backgroundSync(config: Config, entry: KeyEntry, force = false): Promise<void> {
  return syncKey(config, entry, { force }).then((outcome) => {
    if (outcome.ok || outcome.skipped) return;
    log(`sync ${entry.label} failed: ${outcome.error}`);
  });
}

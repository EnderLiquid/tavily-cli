import type { Config, KeyEntry } from "./config.js";
import { keyId } from "./config.js";
import { type KeyState, keyState, type State, updateState } from "./state.js";

export type SkipReason = "disabled" | "invalid" | "cooldown" | "uncalibrated" | "insufficient";

export interface Skip {
  label: string;
  reason: SkipReason;
  remaining: number | null;
}

export interface Selection {
  entry: KeyEntry;
  id: string;
  remaining: number | null;
}

export interface SelectResult {
  selection: Selection | null;
  skips: Skip[];
  toSync: KeyEntry[];
}

export function remainingOf(state: KeyState): number | null {
  if (state.unlimited) return Number.POSITIVE_INFINITY;
  if (state.baseRemaining === null) return null;
  return Math.max(0, state.baseRemaining - state.settled - state.pending - state.penalty);
}

export function labelsOf(config: Config): Set<string> {
  return new Set(config.keys.map((entry) => entry.label));
}

function orderedEntries(config: Config, cursor: string | null): KeyEntry[] {
  const total = config.keys.length;
  if (total === 0) return [];
  const index = cursor === null ? -1 : config.keys.findIndex((entry) => entry.label === cursor);
  const start = index + 1;
  const ordered: KeyEntry[] = [];
  for (let offset = 0; offset < total; offset++) {
    const entry = config.keys[(start + offset) % total];
    if (entry !== undefined) ordered.push(entry);
  }
  return ordered;
}

function syncEligible(state: KeyState, config: Config, now: number): boolean {
  if (state.syncingUntil !== null && state.syncingUntil > now) return false;
  const interval = config.minSyncIntervalSec * 1000;
  const last = state.lastSyncAttemptAt;
  return last === null || now - last >= interval;
}

/** Pick the next usable key and reserve `estimate` credits for it. Mutates `state`. */
export function selectKey(
  config: Config,
  state: State,
  estimate: number,
  now = Date.now(),
): SelectResult {
  if (config.keys.length === 0) {
    return { selection: null, skips: [], toSync: [] };
  }
  const skips: Skip[] = [];
  const toSync: KeyEntry[] = [];
  for (const entry of orderedEntries(config, state.cursor)) {
    const id = keyId(entry.key);
    const keyStateValue = keyState(state, id, entry.label);
    if (!entry.enabled) {
      skips.push({ label: entry.label, reason: "disabled", remaining: remainingOf(keyStateValue) });
      continue;
    }
    if (keyStateValue.invalid !== null) {
      skips.push({ label: entry.label, reason: "invalid", remaining: remainingOf(keyStateValue) });
      continue;
    }
    if (keyStateValue.cooldownUntil !== null && keyStateValue.cooldownUntil > now) {
      skips.push({ label: entry.label, reason: "cooldown", remaining: remainingOf(keyStateValue) });
      continue;
    }
    const remaining = remainingOf(keyStateValue);
    if (remaining === null) {
      skips.push({ label: entry.label, reason: "uncalibrated", remaining: null });
      continue;
    }
    if (remaining < estimate) {
      skips.push({ label: entry.label, reason: "insufficient", remaining });
      if (syncEligible(keyStateValue, config, now)) toSync.push(entry);
      continue;
    }
    keyStateValue.pending += estimate;
    keyStateValue.pendingAt = now;
    state.cursor = entry.label;
    return {
      selection: { entry, id, remaining: Number.isFinite(remaining) ? remaining : null },
      skips,
      toSync,
    };
  }
  return { selection: null, skips, toSync };
}

export async function settle(
  config: Config,
  entry: KeyEntry,
  estimate: number,
  credits: number,
): Promise<boolean> {
  return updateState(labelsOf(config), (state) => {
    const keyStateValue = keyState(state, keyId(entry.key), entry.label);
    keyStateValue.pending = Math.max(0, keyStateValue.pending - estimate);
    keyStateValue.settled += Math.max(0, credits);
    keyStateValue.callsSinceSync += 1;
    return keyStateValue.callsSinceSync >= config.syncEvery;
  });
}

export async function refund(config: Config, entry: KeyEntry, estimate: number): Promise<void> {
  await updateState(labelsOf(config), (state) => {
    const keyStateValue = keyState(state, keyId(entry.key), entry.label);
    keyStateValue.pending = Math.max(0, keyStateValue.pending - estimate);
  });
}

/** Refund the reservation and tighten the remaining bound after 432 or 433. */
export async function penalize(config: Config, entry: KeyEntry, estimate: number): Promise<void> {
  await updateState(labelsOf(config), (state) => {
    const keyStateValue = keyState(state, keyId(entry.key), entry.label);
    keyStateValue.pending = Math.max(0, keyStateValue.pending - estimate);
    if (keyStateValue.baseRemaining === null) return;
    const desired =
      keyStateValue.baseRemaining - keyStateValue.settled - keyStateValue.pending - estimate + 1;
    keyStateValue.penalty = Math.max(keyStateValue.penalty, desired);
  });
}

export async function coolDown(config: Config, entry: KeyEntry, seconds: number): Promise<void> {
  await updateState(labelsOf(config), (state) => {
    const keyStateValue = keyState(state, keyId(entry.key), entry.label);
    keyStateValue.cooldownUntil = Date.now() + seconds * 1000;
  });
}

export async function markInvalid(config: Config, entry: KeyEntry, reason: string): Promise<void> {
  await updateState(labelsOf(config), (state) => {
    const keyStateValue = keyState(state, keyId(entry.key), entry.label);
    keyStateValue.invalid = { reason, at: Date.now() };
  });
}

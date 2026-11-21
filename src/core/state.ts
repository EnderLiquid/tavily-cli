import { existsSync, readFileSync } from "node:fs";
import { withFileLock, writeAtomic } from "./atomic.js";
import { stateError } from "./errors.js";
import { stateFile } from "./paths.js";

export interface KeyState {
  label: string;
  baseRemaining: number | null;
  unlimited: boolean;
  settled: number;
  pending: number;
  pendingAt: number;
  penalty: number;
  syncedAt: number | null;
  planUsage: number | null;
  lastSyncAttemptAt: number | null;
  callsSinceSync: number;
  syncingUntil: number | null;
  cooldownUntil: number | null;
  invalid: { reason: string; at: number } | null;
  lastError: string | null;
}

export interface State {
  version: 1;
  cursor: string | null;
  keys: Record<string, KeyState>;
}

export const PENDING_TTL_MS = 600_000;

export function emptyKeyState(label: string): KeyState {
  return {
    label,
    baseRemaining: null,
    unlimited: false,
    settled: 0,
    pending: 0,
    pendingAt: 0,
    penalty: 0,
    syncedAt: null,
    planUsage: null,
    lastSyncAttemptAt: null,
    callsSinceSync: 0,
    syncingUntil: null,
    cooldownUntil: null,
    invalid: null,
    lastError: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseKeyState(label: string, raw: unknown): KeyState {
  const data = isRecord(raw) ? raw : {};
  const invalid = isRecord(data.invalid)
    ? { reason: String(data.invalid.reason ?? ""), at: asNumber(data.invalid.at, 0) }
    : null;
  return {
    label,
    baseRemaining: asNumberOrNull(data.baseRemaining),
    unlimited: data.unlimited === true,
    settled: Math.max(0, asNumber(data.settled, 0)),
    pending: Math.max(0, asNumber(data.pending, 0)),
    pendingAt: asNumber(data.pendingAt, 0),
    penalty: Math.max(0, asNumber(data.penalty, 0)),
    syncedAt: asNumberOrNull(data.syncedAt),
    planUsage: asNumberOrNull(data.planUsage),
    lastSyncAttemptAt: asNumberOrNull(data.lastSyncAttemptAt),
    callsSinceSync: Math.max(0, asNumber(data.callsSinceSync, 0)),
    syncingUntil: asNumberOrNull(data.syncingUntil),
    cooldownUntil: asNumberOrNull(data.cooldownUntil),
    invalid,
    lastError: typeof data.lastError === "string" ? data.lastError : null,
  };
}

function normalize(raw: unknown, labels: Set<string>, now: number): State {
  const data = isRecord(raw) ? raw : {};
  if (data.version !== undefined && data.version !== 1) {
    throw stateError(`state: unsupported version ${String(data.version)}`);
  }
  const keys: Record<string, KeyState> = {};
  const stored = isRecord(data.keys) ? data.keys : {};
  for (const [id, value] of Object.entries(stored)) {
    const record = isRecord(value) ? value : {};
    const label = typeof record.label === "string" ? record.label : "";
    if (!labels.has(label)) continue;
    keys[id] = parseKeyState(label, record);
  }
  for (const id of Object.keys(keys)) {
    const entry = keys[id];
    if (entry === undefined) continue;
    if (entry.pending > 0 && now - entry.pendingAt > PENDING_TTL_MS) {
      entry.pending = 0;
    }
  }
  const cursor = typeof data.cursor === "string" ? data.cursor : null;
  return { version: 1, cursor, keys };
}

function readRawState(): unknown {
  const file = stateFile();
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw stateError(`state: cannot parse ${file}: ${(error as Error).message}`);
  }
}

/** Load state without the lock, for read-only rendering. */
export function readState(labels: Set<string>, now = Date.now()): State {
  return normalize(readRawState(), labels, now);
}

/** Locked read-modify-write. The callback mutates `state` in place. */
export async function updateState<T>(labels: Set<string>, fn: (state: State) => T): Promise<T> {
  return withFileLock(stateFile(), async () => {
    const state = normalize(readRawState(), labels, Date.now());
    const result = fn(state);
    await writeAtomic(stateFile(), `${JSON.stringify(state, null, 2)}\n`);
    return result;
  });
}

export function keyState(state: State, id: string, label: string): KeyState {
  const existing = state.keys[id];
  if (existing !== undefined) {
    existing.label = label;
    return existing;
  }
  const created = emptyKeyState(label);
  state.keys[id] = created;
  return created;
}

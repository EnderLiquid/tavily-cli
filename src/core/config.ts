import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { withFileLock, writeAtomic } from "./atomic.js";
import { configError, messageOf } from "./errors.js";
import { configFile } from "./paths.js";

export interface KeyEntry {
  label: string;
  key: string;
  enabled: boolean;
}

export interface Config {
  keys: KeyEntry[];
  syncEvery: number;
  minSyncIntervalSec: number;
  drainTimeoutSec: number;
  retries: number;
  apiBaseUrl: string;
}

export const DEFAULTS = {
  syncEvery: 10,
  minSyncIntervalSec: 60,
  drainTimeoutSec: 5,
  retries: 1,
  apiBaseUrl: "https://api.tavily.com",
} as const;

export function keyId(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export function maskKey(key: string): string {
  if (key.length <= 10) return "…";
  return `${key.slice(0, 5)}…${key.slice(-4)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(raw: Record<string, unknown>, field: string, fallback: number): number {
  const value = raw[field];
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw configError(`config: ${field} must be a non-negative number`);
  }
  return value;
}

function parseKeys(raw: unknown): KeyEntry[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw configError("config: keys must be an array");
  const seenLabels = new Set<string>();
  const seenKeys = new Set<string>();
  const keys: KeyEntry[] = [];
  for (const [index, item] of raw.entries()) {
    if (!isRecord(item)) throw configError(`config: keys[${index}] must be an object`);
    const label = item.label;
    const key = item.key;
    const enabled = item.enabled ?? true;
    if (typeof label !== "string" || label.trim() === "") {
      throw configError(`config: keys[${index}].label must be a non-empty string`);
    }
    if (/\s/.test(label)) {
      throw configError(`config: keys[${index}].label must not contain whitespace`);
    }
    if (typeof key !== "string" || key.trim() === "") {
      throw configError(`config: keys[${index}].key must be a non-empty string`);
    }
    if (typeof enabled !== "boolean") {
      throw configError(`config: keys[${index}].enabled must be a boolean`);
    }
    if (seenLabels.has(label)) throw configError(`config: duplicate label ${label}`);
    if (seenKeys.has(key)) throw configError(`config: duplicate key for label ${label}`);
    seenLabels.add(label);
    seenKeys.add(key);
    keys.push({ label, key: key.trim(), enabled });
  }
  return keys;
}

function parseConfig(raw: unknown): Config {
  const data = isRecord(raw) ? raw : {};
  const apiBaseUrl = data.apiBaseUrl;
  if (apiBaseUrl !== undefined && (typeof apiBaseUrl !== "string" || apiBaseUrl.trim() === "")) {
    throw configError("config: apiBaseUrl must be a non-empty string");
  }
  return {
    keys: parseKeys(data.keys),
    syncEvery: readNumber(data, "syncEvery", DEFAULTS.syncEvery),
    minSyncIntervalSec: readNumber(data, "minSyncIntervalSec", DEFAULTS.minSyncIntervalSec),
    drainTimeoutSec: readNumber(data, "drainTimeoutSec", DEFAULTS.drainTimeoutSec),
    retries: readNumber(data, "retries", DEFAULTS.retries),
    apiBaseUrl: (apiBaseUrl ?? DEFAULTS.apiBaseUrl).replace(/\/+$/, ""),
  };
}

function readConfigFile(): unknown {
  const file = configFile();
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw configError(`config: cannot parse ${file}: ${messageOf(error)}`);
  }
}

export function loadConfig(): Config {
  return parseConfig(readConfigFile());
}

export function configExists(): boolean {
  return existsSync(configFile());
}

async function saveConfig(config: Config): Promise<void> {
  const data = {
    keys: config.keys,
    syncEvery: config.syncEvery,
    minSyncIntervalSec: config.minSyncIntervalSec,
    drainTimeoutSec: config.drainTimeoutSec,
    retries: config.retries,
    apiBaseUrl: config.apiBaseUrl,
  };
  await writeAtomic(configFile(), `${JSON.stringify(data, null, 2)}\n`);
}

async function updateConfig<T>(fn: (config: Config) => T): Promise<T> {
  return withFileLock(configFile(), async () => {
    const config = parseConfig(readConfigFile());
    const result = fn(config);
    await saveConfig(config);
    return result;
  });
}

export function validateLabel(label: string): void {
  if (label.trim() === "") throw configError("label must not be empty");
  if (/\s/.test(label)) throw configError("label must not contain whitespace");
}

export async function addKey(label: string, key: string): Promise<KeyEntry> {
  validateLabel(label);
  const value = key.trim();
  if (value === "") throw configError("key must not be empty");
  return updateConfig((config) => {
    if (config.keys.some((entry) => entry.label === label)) {
      throw configError(`key ${label} already exists`);
    }
    if (config.keys.some((entry) => entry.key === value)) {
      throw configError("this key is already in the pool");
    }
    const entry: KeyEntry = { label, key: value, enabled: true };
    config.keys.push(entry);
    return entry;
  });
}

export async function removeKey(label: string): Promise<void> {
  await updateConfig((config) => {
    const index = config.keys.findIndex((entry) => entry.label === label);
    if (index < 0) throw configError(`no key named ${label}`);
    config.keys.splice(index, 1);
  });
}

export function unknownLabels(config: Config, labels: Iterable<string>): string[] {
  const known = new Set(config.keys.map((entry) => entry.label));
  return [...labels].filter((label) => !known.has(label));
}

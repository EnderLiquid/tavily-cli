import { describe, expect, it } from "vitest";
import type { Config } from "../src/core/config.js";
import { keyId } from "../src/core/config.js";
import { remainingOf, selectKey } from "../src/core/pool.js";
import { emptyKeyState, type KeyState, type State } from "../src/core/state.js";

const config: Config = {
  keys: [
    { label: "a", key: "tvly-a", enabled: true },
    { label: "b", key: "tvly-b", enabled: true },
    { label: "c", key: "tvly-c", enabled: true },
  ],
  syncEvery: 10,
  minSyncIntervalSec: 60,
  drainTimeoutSec: 5,
  retries: 1,
  apiBaseUrl: "https://api.tavily.com",
};

function stateWith(
  values: Partial<Record<"a" | "b" | "c", Partial<KeyState>>>,
  cursor: string | null = null,
): State {
  const state: State = { version: 1, cursor, keys: {} };
  for (const [label, value] of Object.entries(values)) {
    const entry = config.keys.find((candidate) => candidate.label === label);
    if (entry === undefined) continue;
    const keyStateValue = { ...emptyKeyState(label), ...value };
    state.keys[keyId(entry.key)] = keyStateValue;
  }
  return state;
}

const calibrated = (remaining: number): Partial<KeyState> => ({
  baseRemaining: remaining,
  syncedAt: 1,
});

describe("selectKey", () => {
  it("walks keys in config order and advances the cursor", () => {
    const state = stateWith({ a: calibrated(100), b: calibrated(100), c: calibrated(100) });
    const first = selectKey(config, state, 1, 1000);
    expect(first.selection?.entry.label).toBe("a");
    expect(state.cursor).toBe("a");
    const second = selectKey(config, state, 1, 1000);
    expect(second.selection?.entry.label).toBe("b");
    const third = selectKey(config, state, 1, 1000);
    expect(third.selection?.entry.label).toBe("c");
    const fourth = selectKey(config, state, 1, 1000);
    expect(fourth.selection?.entry.label).toBe("a");
  });

  it("reserves the estimate and lowers the remaining", () => {
    const state = stateWith({ a: calibrated(10) });
    const result = selectKey(config, state, 4, 1000);
    expect(result.selection?.entry.label).toBe("a");
    const entry = state.keys[keyId("tvly-a")];
    expect(entry?.pending).toBe(4);
    expect(entry === undefined ? null : remainingOf(entry)).toBe(6);
  });

  it("skips disabled, invalid, cooling, and uncalibrated keys", () => {
    const disabled: Config = {
      ...config,
      keys: [
        { label: "a", key: "tvly-a", enabled: false },
        { label: "b", key: "tvly-b", enabled: true },
        { label: "c", key: "tvly-c", enabled: true },
      ],
    };
    const state = stateWith({
      a: calibrated(100),
      b: { baseRemaining: 100, invalid: { reason: "401", at: 1 } },
      c: { baseRemaining: 100, cooldownUntil: 2000 },
    });
    const result = selectKey(disabled, state, 1, 1000);
    expect(result.selection).toBeNull();
    expect(result.skips.map((skip) => skip.reason)).toEqual(["disabled", "invalid", "cooldown"]);
  });

  it("skips a key without enough credits and requests one background sync", () => {
    const state = stateWith({ a: calibrated(2), b: calibrated(100) });
    const first = selectKey(config, state, 5, 100_000);
    expect(first.selection?.entry.label).toBe("b");
    expect(first.skips).toEqual([{ label: "a", reason: "insufficient", remaining: 2 }]);
    expect(first.toSync.map((entry) => entry.label)).toEqual(["a"]);

    const keyA = state.keys[keyId("tvly-a")];
    if (keyA !== undefined) keyA.lastSyncAttemptAt = 100_000;
    const second = selectKey(config, state, 5, 100_001);
    expect(second.toSync).toEqual([]);
  });

  it("honors the minimum sync interval and an active lease", () => {
    const state = stateWith({
      a: { ...calibrated(0), lastSyncAttemptAt: 99_000 },
      b: { ...calibrated(0), syncingUntil: 200_000 },
      c: calibrated(100),
    });
    const result = selectKey(config, state, 5, 100_000);
    expect(result.selection?.entry.label).toBe("c");
    expect(result.toSync).toEqual([]);
  });

  it("treats unlimited keys as always affordable", () => {
    const state = stateWith({ a: { baseRemaining: null, unlimited: true } });
    const result = selectKey(config, state, 999, 1000);
    expect(result.selection?.entry.label).toBe("a");
  });
});

describe("remainingOf", () => {
  it("subtracts settled, pending, and penalty", () => {
    const key: KeyState = {
      ...emptyKeyState("a"),
      baseRemaining: 100,
      settled: 5,
      pending: 3,
      penalty: 2,
    };
    expect(remainingOf(key)).toBe(90);
  });

  it("never goes below zero", () => {
    const key: KeyState = { ...emptyKeyState("a"), baseRemaining: 10, settled: 20 };
    expect(remainingOf(key)).toBe(0);
  });
});

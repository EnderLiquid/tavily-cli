import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Api } from "../src/core/client.js";
import type { KeyEntry } from "../src/core/config.js";
import { type Config, DEFAULTS, keyId } from "../src/core/config.js";
import { emptyKeyState, type KeyState, type State } from "../src/core/state.js";
import { syncKey, usageTruth } from "../src/core/sync.js";

const KEY = "tvly-test-key";
const entry: KeyEntry = { label: "main", key: KEY, enabled: true };
const config: Config = { keys: [entry], ...DEFAULTS };

function usage(
  planUsage: number,
  planLimit: number | null = 1000,
  keyLimit: number | null = null,
  keyUsage = 0,
) {
  return {
    key: { usage: keyUsage, limit: keyLimit },
    account: { plan_usage: planUsage, plan_limit: planLimit },
  };
}

function fakeApi(payload: unknown): Api {
  return {
    post: async () => ({}),
    getUsage: async () => payload,
  };
}

function writeState(overrides: Partial<KeyState>): void {
  const state: State = {
    version: 1,
    cursor: null,
    keys: { [keyId(KEY)]: { ...emptyKeyState("main"), ...overrides } },
  };
  writeFileSync(path.join(process.env.TAVILY_CLI_HOME ?? "", "state.json"), JSON.stringify(state));
}

function readKeyState(): KeyState {
  const state = JSON.parse(
    readFileSync(path.join(process.env.TAVILY_CLI_HOME ?? "", "state.json"), "utf8"),
  ) as State;
  const value = state.keys[keyId(KEY)];
  if (value === undefined) throw new Error("missing key state");
  return value;
}

beforeEach(() => {
  process.env.TAVILY_CLI_HOME = mkdtempSync(path.join(os.tmpdir(), "tavily-cli-sync-"));
});

describe("usageTruth", () => {
  it("takes the smaller of the plan and key remainders", () => {
    expect(usageTruth(usage(169)).baseRemaining).toBe(831);
    expect(usageTruth(usage(950, 1000, 100, 80)).baseRemaining).toBe(20);
  });

  it("ignores a null key limit", () => {
    expect(usageTruth(usage(169, 1000, null)).baseRemaining).toBe(831);
  });

  it("marks both limits null as unlimited", () => {
    expect(usageTruth(usage(0, null, null)).unlimited).toBe(true);
  });

  it("rejects a response without an account", () => {
    expect(() => usageTruth({ key: {} })).toThrow();
  });
});

describe("syncKey", () => {
  it("moves base to the server truth and drops the credits it counted", async () => {
    writeState({ baseRemaining: 900, planUsage: 100, settled: 10 });
    const outcome = await syncKey(config, entry, { api: fakeApi(usage(103)), force: true });
    expect(outcome.ok).toBe(true);
    const state = readKeyState();
    expect(state.baseRemaining).toBe(897);
    expect(state.settled).toBe(7);
    expect(state.planUsage).toBe(103);
    expect(state.callsSinceSync).toBe(0);
  });

  it("keeps local credits while the server usage counter has not moved", async () => {
    writeState({ baseRemaining: 900, planUsage: 100, settled: 10 });
    await syncKey(config, entry, { api: fakeApi(usage(100)), force: true });
    const state = readKeyState();
    expect(state.baseRemaining).toBe(900);
    expect(state.settled).toBe(10);
  });

  it("clears settled when the billing period rolls over", async () => {
    writeState({ baseRemaining: 5, planUsage: 995, settled: 3, penalty: 4 });
    await syncKey(config, entry, { api: fakeApi(usage(0)), force: true });
    const state = readKeyState();
    expect(state.baseRemaining).toBe(1000);
    expect(state.settled).toBe(0);
    expect(state.penalty).toBe(0);
  });

  it("keeps the penalty when a sync learns nothing", async () => {
    writeState({ baseRemaining: 100, planUsage: 900, settled: 5, penalty: 7 });
    await syncKey(config, entry, { api: fakeApi(usage(900)), force: true });
    expect(readKeyState().penalty).toBe(7);
  });

  it("clears the penalty once the server counter moves", async () => {
    writeState({ baseRemaining: 100, planUsage: 900, settled: 5, penalty: 7 });
    await syncKey(config, entry, { api: fakeApi(usage(902)), force: true });
    const state = readKeyState();
    expect(state.penalty).toBe(0);
    expect(state.settled).toBe(3);
  });

  it("records failures and releases the lease", async () => {
    writeState({ baseRemaining: 100, planUsage: 900 });
    const failing: Api = {
      post: async () => ({}),
      getUsage: async () => {
        throw new Error("boom");
      },
    };
    const outcome = await syncKey(config, entry, { api: failing, force: true });
    expect(outcome.ok).toBe(false);
    const state = readKeyState();
    expect(state.syncingUntil).toBeNull();
    expect(state.lastError).toBe("boom");
    expect(state.baseRemaining).toBe(100);
  });

  it("respects the minimum interval unless forced", async () => {
    writeState({ baseRemaining: 100, planUsage: 900, lastSyncAttemptAt: Date.now() });
    const skipped = await syncKey(config, entry, { api: fakeApi(usage(900)) });
    expect(skipped.skipped).toBe(true);
    const forced = await syncKey(config, entry, {
      api: fakeApi(usage(900)),
      force: true,
    });
    expect(forced.ok).toBe(true);
  });
});

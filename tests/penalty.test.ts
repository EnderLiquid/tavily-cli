import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { type Config, DEFAULTS, type KeyEntry, keyId } from "../src/core/config.js";
import { penalize, remainingOf } from "../src/core/pool.js";
import { emptyKeyState, type KeyState, type State } from "../src/core/state.js";

const KEY = "tvly-test-key";
const entry: KeyEntry = { label: "main", key: KEY, enabled: true };
const config: Config = { keys: [entry], ...DEFAULTS };

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
  process.env.TAVILY_CLI_HOME = mkdtempSync(path.join(os.tmpdir(), "tavily-cli-penalty-"));
});

describe("penalize", () => {
  it("leaves exactly one credit less than the estimate", async () => {
    writeState({ baseRemaining: 100, settled: 0, pending: 0, penalty: 0 });
    await penalize(config, entry, 2);
    const state = readKeyState();
    expect(state.penalty).toBe(99);
    expect(remainingOf(state)).toBe(1);
  });

  it("accounts for an existing penalty", async () => {
    writeState({ baseRemaining: 100, settled: 0, pending: 0, penalty: 50 });
    await penalize(config, entry, 2);
    const state = readKeyState();
    expect(state.penalty).toBe(99);
    expect(remainingOf(state)).toBe(1);
  });

  it("is idempotent", async () => {
    writeState({ baseRemaining: 100, settled: 0, pending: 0, penalty: 0 });
    await penalize(config, entry, 2);
    await penalize(config, entry, 2);
    expect(readKeyState().penalty).toBe(99);
  });

  it("refunds the reservation", async () => {
    writeState({ baseRemaining: 100, settled: 0, pending: 2, penalty: 0 });
    await penalize(config, entry, 2);
    expect(readKeyState().pending).toBe(0);
  });
});

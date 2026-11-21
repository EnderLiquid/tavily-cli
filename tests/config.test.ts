import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { addKey, loadConfig, maskKey, removeKey } from "../src/core/config.js";
import { CliError } from "../src/core/errors.js";

beforeEach(() => {
  process.env.TAVILY_CLI_HOME = mkdtempSync(path.join(os.tmpdir(), "tavily-cli-config-"));
});

describe("config", () => {
  it("starts empty with defaults", () => {
    const config = loadConfig();
    expect(config.keys).toEqual([]);
    expect(config.syncEvery).toBe(10);
    expect(config.retries).toBe(1);
    expect(config.drainTimeoutSec).toBe(5);
  });

  it("adds keys in order and persists them", async () => {
    await addKey("one", "tvly-1");
    await addKey("two", "tvly-2");
    expect(loadConfig().keys.map((entry) => entry.label)).toEqual(["one", "two"]);
  });

  it("rejects duplicate labels and duplicate keys", async () => {
    await addKey("one", "tvly-1");
    await expect(addKey("one", "tvly-2")).rejects.toBeInstanceOf(CliError);
    await expect(addKey("two", "tvly-1")).rejects.toBeInstanceOf(CliError);
  });

  it("rejects labels with whitespace", async () => {
    await expect(addKey("two words", "tvly-2")).rejects.toBeInstanceOf(CliError);
  });

  it("removes keys", async () => {
    await addKey("one", "tvly-1");
    await removeKey("one");
    expect(loadConfig().keys).toEqual([]);
    await expect(removeKey("one")).rejects.toBeInstanceOf(CliError);
  });
});

describe("maskKey", () => {
  it("keeps the prefix and last four characters", () => {
    expect(maskKey("tvly-dev-1234567890abcd")).toBe("tvly-…abcd");
    expect(maskKey("short")).toBe("…");
  });
});

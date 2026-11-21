import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli.js";

let stdout = "";
let stderr = "";

function args(...rest: string[]): string[] {
  return ["node", "tavily-cli", ...rest];
}

beforeEach(() => {
  process.env.TAVILY_CLI_HOME = mkdtempSync(path.join(os.tmpdir(), "tavily-cli-cli-"));
  stdout = "";
  stderr = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    stdout += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    stderr += String(chunk);
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("cli", () => {
  it("writes a quota error as JSON and exits 3", async () => {
    const code = await runCli(args("search", "hello", "--json"));
    expect(code).toBe(3);
    expect(JSON.parse(stdout)).toEqual({
      error: "no keys configured; run tavily-cli keys add <label>",
      code: "quota_exhausted",
    });
  });

  it("adds and lists keys", async () => {
    expect(await runCli(args("keys", "add", "main", "tvly-1234567890abcd"))).toBe(0);
    expect(stderr).toContain("added main");

    stdout = "";
    expect(await runCli(args("keys", "list", "--json"))).toBe(0);
    expect(JSON.parse(stdout)).toEqual({
      keys: [{ label: "main", key: "tvly-…abcd", enabled: true }],
    });
  });

  it("reports usage with unknown keys as uncalibrated", async () => {
    await runCli(args("keys", "add", "main", "tvly-1234567890abcd"));
    stdout = "";
    expect(await runCli(args("usage"))).toBe(0);
    expect(stdout).toContain("uncalibrated");
  });

  it("rejects unknown options with exit 2", async () => {
    expect(await runCli(args("search", "hello", "--nope"))).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toContain("unknown option");
  });

  it("writes Commander errors as JSON only", async () => {
    expect(await runCli(args("search", "hello", "--nope", "--json"))).toBe(2);
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toEqual({
      error: "unknown option '--nope'",
      code: "usage_error",
    });
  });

  it("keeps missing arguments on stderr in text mode", async () => {
    expect(await runCli(args("extract"))).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toContain("missing required argument");
  });

  it("writes command usage errors as JSON only", async () => {
    expect(await runCli(args("usage", "-f", "--json"))).toBe(2);
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toEqual({
      error: "-f requires --sync",
      code: "usage_error",
    });
  });

  it("includes skipped keys in JSON errors without duplicating them on stderr", async () => {
    await runCli(args("keys", "add", "main", "tvly-1234567890abcd"));
    stdout = "";
    stderr = "";
    expect(await runCli(args("search", "hello", "--json"))).toBe(3);
    const payload = JSON.parse(stdout);
    expect(payload.code).toBe("quota_exhausted");
    expect(payload.details.skips).toEqual([
      { label: "main", reason: "uncalibrated", remaining: null },
    ]);
    expect(stderr).toBe("");
  });

  it("prints skipped keys after a text quota error", async () => {
    await runCli(args("keys", "add", "main", "tvly-1234567890abcd"));
    stdout = "";
    stderr = "";
    expect(await runCli(args("search", "hello"))).toBe(3);
    expect(stdout).toBe("");
    expect(stderr).toContain("error: no key with known remaining");
    expect(stderr).toContain("  main: uncalibrated");
  });

  it("prints help and exits 0", async () => {
    expect(await runCli(args("--help"))).toBe(0);
    expect(stdout).toContain("Usage: tavily-cli");
  });

  it("rejects -f without --sync", async () => {
    expect(await runCli(args("usage", "-f"))).toBe(2);
    expect(stderr).toContain("requires --sync");
  });
});

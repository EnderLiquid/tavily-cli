import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/core/runner.js", () => ({ postWithPool: vi.fn() }));

import { runCli } from "../src/cli.js";
import { postWithPool } from "../src/core/runner.js";
import { crawlSlug } from "../src/ui/artifact.js";

let stdout = "";
let stderr = "";
let workspace = "";

const fixture: Record<string, unknown> = {
  base_url: "https://example.com",
  results: [
    { url: "https://example.com/docs/page?x=1", raw_content: "First body" },
    { url: "https://example.com/docs/page?x=1", raw_content: "Second body" },
    { url: "https://example.com/empty", raw_content: "" },
  ],
  failed_results: [{ url: "https://example.com/bad", error: "timeout" }],
};

function args(...rest: string[]): string[] {
  return ["node", "tavily-cli", ...rest];
}

function paths(dir: string, names: string[]): string[] {
  return names.map((name) => path.join(dir, name));
}

beforeEach(() => {
  process.env.TAVILY_CLI_HOME = mkdtempSync(path.join(os.tmpdir(), "tavily-cli-crawl-home-"));
  workspace = mkdtempSync(path.join(os.tmpdir(), "tavily-cli-crawl-out-"));
  stdout = "";
  stderr = "";
  vi.mocked(postWithPool).mockReset();
  vi.mocked(postWithPool).mockResolvedValue({ data: fixture, label: "main" });
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

describe("crawl --output-dir", () => {
  it("is listed in crawl help", async () => {
    expect(await runCli(args("crawl", "--help"))).toBe(0);
    expect(stdout).toContain("--output-dir <dir>");
  });

  it("writes unique files, skips empty pages, and reports failures on stderr", async () => {
    const dir = path.join(workspace, "pages");
    const code = await runCli(
      args("crawl", "https://example.com", "--output-dir", dir, "--format", "text"),
    );
    expect(code).toBe(0);

    const names = ["example.com_docs_page_x_1.md", "example.com_docs_page_x_1-2.md"];
    expect(readdirSync(dir).sort()).toEqual([...names].sort());
    expect(stdout.trim().split(/\r?\n/)).toEqual(paths(dir, names));
    expect(readFileSync(path.join(dir, names[0] ?? ""), "utf8")).toBe(
      "# https://example.com/docs/page?x=1\n\nFirst body\n",
    );
    expect(readFileSync(path.join(dir, names[1] ?? ""), "utf8")).toBe(
      "# https://example.com/docs/page?x=1\n\nSecond body\n",
    );
    expect(existsSync(path.join(dir, "example.com_empty.md"))).toBe(false);
    expect(stderr).toContain(`Saved 2 pages to ${dir}${path.sep}`);
    expect(stderr).toContain("Failed 1 page:");
    expect(stderr).toContain("https://example.com/bad: timeout");
  });

  it("emits the full response with --json and keeps failures out of stderr", async () => {
    const dir = path.join(workspace, "pages");
    const code = await runCli(args("crawl", "https://example.com", "--output-dir", dir, "--json"));
    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toEqual(fixture);
    expect(stderr).toContain(`Saved 2 pages to ${dir}${path.sep}`);
    expect(stderr).not.toContain("Failed");
  });

  it("saves the full response with -o without changing stdout", async () => {
    const dir = path.join(workspace, "pages");
    const file = path.join(workspace, "crawl.json");
    const code = await runCli(
      args("crawl", "https://example.com", "--output-dir", dir, "-o", file),
    );
    expect(code).toBe(0);
    expect(stdout.trim().split(/\r?\n/)).toEqual(
      paths(dir, ["example.com_docs_page_x_1.md", "example.com_docs_page_x_1-2.md"]),
    );
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(fixture);
    expect(stderr).toContain(`saved to ${file}`);
  });

  it("keeps text rendering when only -o is used", async () => {
    const file = path.join(workspace, "crawl.json");
    const code = await runCli(args("crawl", "https://example.com", "-o", file));
    expect(code).toBe(0);
    expect(stdout).toContain("# https://example.com/docs/page?x=1");
    expect(stdout).toContain("First body");
    expect(stderr).toContain("Failed 1 page:");
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(fixture);
  });

  it("writes JSON to stdout and the file when combined with --json", async () => {
    const file = path.join(workspace, "crawl.json");
    const code = await runCli(args("crawl", "https://example.com", "--json", "-o", file));
    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toEqual(fixture);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(fixture);
  });

  it("rejects an empty output directory before making a request", async () => {
    const code = await runCli(args("crawl", "https://example.com", "--output-dir", ""));
    expect(code).toBe(2);
    expect(stdout).toBe("");
    expect(stderr).toContain("--output-dir must not be empty");
    expect(postWithPool).not.toHaveBeenCalled();
  });

  it("creates the directory and reports zero pages", async () => {
    vi.mocked(postWithPool).mockResolvedValue({
      data: { results: [], failed_results: [] },
      label: "main",
    });
    const dir = path.join(workspace, "empty");
    const code = await runCli(args("crawl", "https://example.com", "--output-dir", dir));
    expect(code).toBe(0);
    expect(existsSync(dir)).toBe(true);
    expect(stdout).toBe("");
    expect(stderr).toContain(`Saved 0 pages to ${dir}${path.sep}`);
  });
});

describe("partial failures", () => {
  it("moves extract failures from stdout to stderr", async () => {
    const code = await runCli(args("extract", "https://example.com/bad"));
    expect(code).toBe(0);
    expect(stdout).toContain("# https://example.com/docs/page?x=1");
    expect(stdout).not.toContain("Failed");
    expect(stderr).toContain("Failed 1 page:");
    expect(stderr).toContain("https://example.com/bad: timeout");
  });
});

describe("crawlSlug", () => {
  it("follows the URL structure and replaces unsafe characters", () => {
    expect(crawlSlug("https://example.com/docs/page?x=1")).toBe("example.com_docs_page_x_1");
    expect(crawlSlug("https://example.com/")).toBe("example.com");
  });

  it("guards Windows device names and trailing dots", () => {
    expect(crawlSlug("https://con.example/x")).toBe("_con.example_x");
    expect(crawlSlug("https://example.com/path.")).toBe("example.com_path");
  });

  it("bounds long names with a deterministic suffix", () => {
    const slug = crawlSlug(`https://example.com/${"a".repeat(300)}`);
    expect([...slug]).toHaveLength(120);
    expect(slug).toMatch(/-[0-9a-f]{8}$/);
  });
});

import { type Command, InvalidArgumentError, Option } from "commander";
import { crawlCost, type ExtractDepth, mapCost } from "../core/cost.js";
import { usageError } from "../core/errors.js";
import { postWithPool } from "../core/runner.js";
import {
  SERVER_TIMEOUT_MARGIN_SEC,
  SITE_TIMEOUT_DEFAULT_SEC,
  SITE_TIMEOUT_MAX_SEC,
  SITE_TIMEOUT_MIN_SEC,
} from "../core/timeouts.js";
import { saveCrawlPages } from "../ui/artifact.js";
import { finish } from "../ui/output.js";
import { failureLines, printMap, printPages, printPaths } from "../ui/render.js";
import { jsonFlag, outputFlag, runtime } from "./runtime.js";

function parseInteger(minimum: number, maximum = Number.MAX_SAFE_INTEGER) {
  return (raw: string): number => {
    const value = Number(raw);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new InvalidArgumentError(`expected an integer between ${minimum} and ${maximum}.`);
    }
    return value;
  };
}

function parseNumber(minimum: number, maximum: number) {
  return (raw: string): number => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      throw new InvalidArgumentError(`expected a number between ${minimum} and ${maximum}.`);
    }
    return value;
  };
}

function csv(value: unknown): string[] | undefined {
  if (typeof value !== "string") return undefined;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function addSiteOptions(cmd: Command): void {
  cmd
    .addOption(
      new Option("--max-depth <n>", "crawl depth (default 1)").argParser(parseInteger(1, 5)),
    )
    .addOption(
      new Option("--max-breadth <n>", "links followed per level (default 20)").argParser(
        parseInteger(1),
      ),
    )
    .addOption(new Option("--limit <n>", "page or URL cap (default 50)").argParser(parseInteger(1)))
    .addOption(new Option("--instructions <text>", "natural-language guidance"))
    .addOption(new Option("--select-paths <list>", "path regexes, comma separated"))
    .addOption(new Option("--exclude-paths <list>", "path regexes to skip, comma separated"))
    .addOption(new Option("--select-domains <list>", "domain regexes, comma separated"))
    .addOption(new Option("--exclude-domains <list>", "domain regexes to skip, comma separated"))
    .addOption(new Option("--allow-external", "follow links to other domains"))
    .addOption(new Option("--no-external", "stay on the starting domain"))
    .addOption(
      new Option(
        "--timeout <seconds>",
        `server-side wait limit (${SITE_TIMEOUT_MIN_SEC}-${SITE_TIMEOUT_MAX_SEC})`,
      ).argParser(parseNumber(SITE_TIMEOUT_MIN_SEC, SITE_TIMEOUT_MAX_SEC)),
    )
    .addOption(new Option("-o, --output [file]", "write the full response to a file").preset(""));
}

function siteBody(url: string, opts: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = { url, include_usage: true };
  if (typeof opts.maxDepth === "number") body.max_depth = opts.maxDepth;
  if (typeof opts.maxBreadth === "number") body.max_breadth = opts.maxBreadth;
  if (typeof opts.limit === "number") body.limit = opts.limit;
  if (typeof opts.instructions === "string") body.instructions = opts.instructions;
  const selectPaths = csv(opts.selectPaths);
  if (selectPaths !== undefined) body.select_paths = selectPaths;
  const excludePaths = csv(opts.excludePaths);
  if (excludePaths !== undefined) body.exclude_paths = excludePaths;
  const selectDomains = csv(opts.selectDomains);
  if (selectDomains !== undefined) body.select_domains = selectDomains;
  const excludeDomains = csv(opts.excludeDomains);
  if (excludeDomains !== undefined) body.exclude_domains = excludeDomains;
  if (opts.external === false) body.allow_external = false;
  else if (opts.allowExternal === true) body.allow_external = true;
  if (typeof opts.timeout === "number") body.timeout = opts.timeout;
  return body;
}

function extractionBody(opts: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (typeof opts.chunksPerSource === "number") body.chunks_per_source = opts.chunksPerSource;
  if (typeof opts.extractDepth === "string") body.extract_depth = opts.extractDepth;
  if (typeof opts.format === "string") body.format = opts.format;
  if (opts.includeImages === true) body.include_images = true;
  return body;
}

export function configureCrawl(cmd: Command): void {
  addSiteOptions(cmd);
  cmd
    .addOption(
      new Option("--chunks-per-source <n>", "chunks per page (1-5)").argParser(parseInteger(1, 5)),
    )
    .addOption(
      new Option("--extract-depth <depth>", "extraction depth").choices(["basic", "advanced"]),
    )
    .addOption(new Option("--format <format>", "content format").choices(["markdown", "text"]))
    .addOption(new Option("--include-images", "include image URLs"))
    .addOption(new Option("--output-dir <dir>", "save each page as a .md file in this directory"));
}

export function configureMap(cmd: Command): void {
  addSiteOptions(cmd);
}

export async function runCrawl(
  url: string,
  opts: Record<string, unknown>,
  cmd: Command,
): Promise<void> {
  const config = runtime(cmd);
  const limit = typeof opts.limit === "number" ? opts.limit : 50;
  const depth = (
    typeof opts.extractDepth === "string" ? opts.extractDepth : "basic"
  ) as ExtractDepth;
  const body = { ...siteBody(url, opts), ...extractionBody(opts) };
  const serverTimeout = typeof opts.timeout === "number" ? opts.timeout : SITE_TIMEOUT_DEFAULT_SEC;
  const outputDir = typeof opts.outputDir === "string" ? opts.outputDir : undefined;
  if (outputDir !== undefined && outputDir.trim() === "") {
    throw usageError("--output-dir must not be empty");
  }
  const response = await postWithPool(config, "crawl", body, {
    estimate: crawlCost(limit, typeof opts.instructions === "string", depth),
    timeoutSeconds: serverTimeout + SERVER_TIMEOUT_MARGIN_SEC,
  });
  const saved = outputDir === undefined ? undefined : saveCrawlPages(response.data, outputDir);
  finish(
    response.data,
    { json: jsonFlag(cmd), output: outputFlag(opts), command: "crawl", label: url },
    {
      text: saved === undefined ? printPages : () => printPaths(saved.files),
      warnings: failureLines,
    },
  );
}

export async function runMap(
  url: string,
  opts: Record<string, unknown>,
  cmd: Command,
): Promise<void> {
  const config = runtime(cmd);
  const limit = typeof opts.limit === "number" ? opts.limit : 50;
  const body = siteBody(url, opts);
  const serverTimeout = typeof opts.timeout === "number" ? opts.timeout : SITE_TIMEOUT_DEFAULT_SEC;
  const response = await postWithPool(config, "map", body, {
    estimate: mapCost(limit, typeof opts.instructions === "string"),
    timeoutSeconds: serverTimeout + SERVER_TIMEOUT_MARGIN_SEC,
  });
  finish(
    response.data,
    { json: jsonFlag(cmd), output: outputFlag(opts), command: "map", label: url },
    { text: printMap },
  );
}

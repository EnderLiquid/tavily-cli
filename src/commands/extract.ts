import { type Command, InvalidArgumentError, Option } from "commander";
import { type ExtractDepth, extractCost } from "../core/cost.js";
import { usageError } from "../core/errors.js";
import { postWithPool } from "../core/runner.js";
import { finish } from "../ui/output.js";
import { failureLines, printPages } from "../ui/render.js";
import { jsonFlag, outputFlag, runtime } from "./runtime.js";

const MAX_URLS = 20;

function parseChunks(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new InvalidArgumentError("expected an integer between 1 and 5.");
  }
  return value;
}

function parseTimeout(raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1 || value > 60) {
    throw new InvalidArgumentError("expected a number between 1 and 60.");
  }
  return value;
}

export function configure(cmd: Command): void {
  cmd
    .addOption(new Option("--query <text>", "rerank chunks by relevance"))
    .addOption(
      new Option("--chunks-per-source <n>", "chunks per source (requires --query)").argParser(
        parseChunks,
      ),
    )
    .addOption(
      new Option("--extract-depth <depth>", "extraction depth").choices(["basic", "advanced"]),
    )
    .addOption(new Option("--format <format>", "content format").choices(["markdown", "text"]))
    .addOption(new Option("--include-images", "include image URLs"))
    .addOption(
      new Option("--timeout <seconds>", "server-side wait limit (1-60)").argParser(parseTimeout),
    )
    .addOption(new Option("-o, --output [file]", "write the full response to a file").preset(""));
}

export async function run(
  urls: string[],
  opts: Record<string, unknown>,
  cmd: Command,
): Promise<void> {
  if (urls.length === 0) throw usageError("at least one URL is required");
  if (urls.length > MAX_URLS) {
    throw usageError(`at most ${MAX_URLS} URLs per call, got ${urls.length}`);
  }
  const config = runtime(cmd);
  const depth = (
    typeof opts.extractDepth === "string" ? opts.extractDepth : "basic"
  ) as ExtractDepth;
  const body: Record<string, unknown> = { urls, include_usage: true };
  if (typeof opts.query === "string") body.query = opts.query;
  if (typeof opts.chunksPerSource === "number") body.chunks_per_source = opts.chunksPerSource;
  if (typeof opts.extractDepth === "string") body.extract_depth = opts.extractDepth;
  if (typeof opts.format === "string") body.format = opts.format;
  if (opts.includeImages === true) body.include_images = true;
  const serverTimeout = typeof opts.timeout === "number" ? opts.timeout : 30;
  if (typeof opts.timeout === "number") body.timeout = opts.timeout;

  const response = await postWithPool(config, "extract", body, {
    estimate: extractCost(urls.length, depth),
    timeoutSeconds: serverTimeout + 10,
  });
  finish(
    response.data,
    {
      json: jsonFlag(cmd),
      output: outputFlag(opts),
      command: "extract",
      label: urls[0],
    },
    { text: printPages, warnings: failureLines },
  );
}

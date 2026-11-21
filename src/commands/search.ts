import { type Command, InvalidArgumentError, Option } from "commander";
import { type SearchDepth, searchCost } from "../core/cost.js";
import { postWithPool } from "../core/runner.js";
import { finish } from "../ui/output.js";
import { printSearch } from "../ui/render.js";
import { applySearchFlags, type SearchSpec, searchBody } from "./flags.js";
import { jsonFlag, outputFlag, runtime } from "./runtime.js";

let specs: SearchSpec[] = [];

function parseMaxChars(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new InvalidArgumentError("expected a non-negative integer.");
  }
  return value;
}

export function configure(cmd: Command): void {
  specs = applySearchFlags(cmd);
  cmd.addOption(
    new Option(
      "--max-chars <n>",
      "characters of each result to print (default 600, 0 prints everything)",
    )
      .argParser(parseMaxChars)
      .default(600),
  );
  cmd.addOption(new Option("-o, --output [file]", "write the full response to a file").preset(""));
}

export async function run(
  query: string,
  opts: Record<string, unknown>,
  cmd: Command,
): Promise<void> {
  const config = runtime(cmd);
  const depth = (typeof opts.depth === "string" ? opts.depth : "basic") as SearchDepth;
  const body = { query, ...searchBody(opts, specs) };
  const estimate = searchCost(depth);
  const response = await postWithPool(config, "search", body, {
    estimate,
    timeoutSeconds: 60,
  });
  const maxChars = typeof opts.maxChars === "number" ? opts.maxChars : 600;
  finish(
    response.data,
    {
      json: jsonFlag(cmd),
      output: outputFlag(opts),
      command: "search",
      label: query,
    },
    { text: (data) => printSearch(data, maxChars) },
  );
}

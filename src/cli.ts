import { Command, InvalidArgumentError } from "commander";
import * as extract from "./commands/extract.js";
import * as keys from "./commands/keys.js";
import * as search from "./commands/search.js";
import * as site from "./commands/site.js";
import * as usage from "./commands/usage.js";
import { loadConfig } from "./core/config.js";
import { drain } from "./core/queue.js";
import { reportError } from "./ui/report.js";
import { VERSION } from "./version.js";

function parseRetries(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new InvalidArgumentError("expected a non-negative integer.");
  }
  return value;
}

export function buildProgram(options: { json?: boolean } = {}): Command {
  const program = new Command()
    .name("tavily-cli")
    .description("Tavily search, extract, crawl, and map with a multi-account credit pool.")
    .version(VERSION, "--version", "print version")
    .option("--json", "output JSON")
    .option("--retries <n>", "extra keys to try after a quota-class failure", parseRetries)
    .configureHelp({ showGlobalOptions: true })
    .exitOverride();
  if (options.json === true) program.configureOutput({ writeErr: () => {} });

  const searchCmd = program
    .command("search")
    .description("search the web")
    .argument("<query>", "query text");
  search.configure(searchCmd);
  searchCmd.action(async (query: string, options: Record<string, unknown>, command: Command) => {
    await search.run(query, options, command);
  });

  const extractCmd = program
    .command("extract")
    .description("extract page content")
    .argument("<urls...>", "one or more URLs");
  extract.configure(extractCmd);
  extractCmd.action(async (urls: string[], options: Record<string, unknown>, command: Command) => {
    await extract.run(urls, options, command);
  });

  const crawlCmd = program
    .command("crawl")
    .description("crawl a site")
    .argument("<url>", "starting URL");
  site.configureCrawl(crawlCmd);
  crawlCmd.action(async (url: string, options: Record<string, unknown>, command: Command) => {
    await site.runCrawl(url, options, command);
  });

  const mapCmd = program
    .command("map")
    .description("discover URLs on a site")
    .argument("<url>", "starting URL");
  site.configureMap(mapCmd);
  mapCmd.action(async (url: string, options: Record<string, unknown>, command: Command) => {
    await site.runMap(url, options, command);
  });

  const usageCmd = program.command("usage").description("show pool credits");
  usage.configure(usageCmd);
  usageCmd.action(async (options: Record<string, unknown>, command: Command) => {
    await usage.run(options, command);
  });

  const keysCmd = program.command("keys").description("manage keys in the pool");
  keys.configure(keysCmd);

  return program;
}

export async function runCli(argv: string[]): Promise<number> {
  const json = argv.includes("--json");
  const program = buildProgram({ json });
  let code = 0;
  try {
    await program.parseAsync(argv);
  } catch (error) {
    code = reportError(error, json);
  }
  let timeout = 5000;
  try {
    timeout = loadConfig().drainTimeoutSec * 1000;
  } catch {
    // Fall back to the default when the config cannot be read.
  }
  await drain(timeout);
  return code;
}

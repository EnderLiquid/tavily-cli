import type { Command } from "commander";
import { type Config, loadConfig } from "../core/config.js";

/** Load config and apply the `--retries` override. */
export function runtime(cmd: Command): Config {
  const config = loadConfig();
  const retries = cmd.optsWithGlobals().retries;
  if (typeof retries === "number" && Number.isFinite(retries)) {
    return { ...config, retries: Math.max(0, Math.floor(retries)) };
  }
  return config;
}

export function jsonFlag(cmd: Command): boolean {
  return cmd.optsWithGlobals().json === true;
}

export function outputFlag(opts: Record<string, unknown>): string | undefined {
  return typeof opts.output === "string" ? opts.output : undefined;
}

import os from "node:os";
import path from "node:path";

export const DATA_DIR_ENV = "TAVILY_CLI_HOME";

export function dataDir(): string {
  const override = process.env[DATA_DIR_ENV];
  if (override !== undefined && override.trim() !== "") return override;
  return path.join(os.homedir(), ".tavily-cli");
}

export function configFile(): string {
  return path.join(dataDir(), "config.json");
}

export function stateFile(): string {
  return path.join(dataDir(), "state.json");
}

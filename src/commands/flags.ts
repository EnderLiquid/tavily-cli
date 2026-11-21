import { type ParameterDefinition, searchParameters } from "@tavily/core/parameters";
import { type Command, InvalidArgumentError, Option } from "commander";

export interface SearchSpec {
  key: string;
  optsKey: string;
}

const FLAG_OVERRIDES: Record<string, string> = { searchDepth: "depth" };
const HIDDEN = new Set(["query", "includeUsage"]);

const kebab = (key: string): string =>
  key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const camel = (flag: string): string =>
  flag.replace(/-([a-z0-9])/g, (_match, letter: string) => letter.toUpperCase());
export const snake = (key: string): string =>
  key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

interface Bounds {
  minimum?: number | undefined;
  maximum?: number | undefined;
}

function parseNumber(raw: string, integer: boolean, bounds: Bounds): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new InvalidArgumentError("Not a number.");
  if (integer && !Number.isInteger(value)) throw new InvalidArgumentError("Not an integer.");
  if (bounds.minimum !== undefined && value < bounds.minimum) {
    throw new InvalidArgumentError(`${value} is below the minimum ${bounds.minimum}.`);
  }
  if (bounds.maximum !== undefined && value > bounds.maximum) {
    throw new InvalidArgumentError(`${value} is above the maximum ${bounds.maximum}.`);
  }
  return value;
}

function buildOption(flag: string, def: ParameterDefinition): Option {
  const description = def.description;
  const rawType = def.type as unknown;

  if (Array.isArray(rawType)) {
    const allowed = (def as { enum: readonly unknown[] }).enum.map(String);
    return new Option(`--${flag} [value]`, description).argParser((raw: string) => {
      if (!allowed.includes(raw)) {
        throw new InvalidArgumentError(`Allowed choices are ${allowed.join(", ")}.`);
      }
      return raw;
    });
  }
  if (rawType === "boolean") return new Option(`--${flag}`, description);
  if (rawType === "array") {
    return new Option(`--${flag} <list>`, description).argParser((raw: string) =>
      raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }
  if (rawType === "integer" || rawType === "number") {
    const bounds = def as Bounds;
    return new Option(`--${flag} <n>`, description).argParser((raw: string) =>
      parseNumber(raw, rawType === "integer", bounds),
    );
  }
  const enumValues = (def as { enum?: readonly unknown[] }).enum;
  if (enumValues !== undefined) {
    return new Option(`--${flag} <value>`, description).choices(enumValues.map(String));
  }
  return new Option(`--${flag} <value>`, description);
}

/** Register one flag per catalog entry, skipping the positional query. */
export function applySearchFlags(cmd: Command): SearchSpec[] {
  const specs: SearchSpec[] = [];
  for (const [key, def] of Object.entries(searchParameters)) {
    if (HIDDEN.has(key)) continue;
    const flag = FLAG_OVERRIDES[key] ?? kebab(key);
    cmd.addOption(buildOption(flag, def));
    specs.push({ key, optsKey: camel(flag) });
  }
  return specs;
}

function convert(key: string, value: unknown): unknown {
  if (key === "includeAnswer" && value === true) return "basic";
  if (key === "includeRawContent" && value === true) return "markdown";
  return value;
}

export function searchBody(
  opts: Record<string, unknown>,
  specs: SearchSpec[],
): Record<string, unknown> {
  const body: Record<string, unknown> = { include_usage: true };
  for (const spec of specs) {
    const value = opts[spec.optsKey];
    if (value === undefined) continue;
    body[snake(spec.key)] = convert(spec.key, value);
  }
  return body;
}

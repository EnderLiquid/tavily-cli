import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { emitJson, err, log } from "./stream.js";

const OUTPUT_DIR = ".tavily";

function slugOf(value: string | undefined): string {
  const slug = (value ?? "")
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.join("-")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "");
  return slug === "" || slug === undefined ? "result" : slug;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 裸 `-o` 落到 `.tavily/<command>-<slug>-<HHMMSS>-<rand>.json`。 */
export function resolveOutput(
  value: string | undefined,
  command: string,
  label?: string,
  now = new Date(),
): string | undefined {
  if (value === undefined) return undefined;
  if (value !== "") return value;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const suffix = randomBytes(3).toString("hex");
  return path.join(OUTPUT_DIR, `${command}-${slugOf(label)}-${time}-${suffix}.json`);
}

export function saveOutput(data: unknown, file: string): void {
  const folder = path.dirname(file);
  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true });
    if (path.basename(path.resolve(folder)) === OUTPUT_DIR) {
      writeFileSync(path.join(folder, ".gitignore"), "*\n");
    }
  }
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  log(`saved to ${file}`);
}

export interface OutputOptions {
  json: boolean;
  output?: string | undefined;
  command: string;
  label?: string | undefined;
}

export interface ResultOutput<T> {
  text: (data: T) => void;
  warnings?: (data: T) => string[];
}

/**
 * 把主结果路由到 stdout 和落盘文件。`-o` 只产生副作用，不改变 stdout；
 * 文本模式的警告写 stderr。
 */
export function finish<T>(data: T, options: OutputOptions, output: ResultOutput<T>): void {
  const file = resolveOutput(options.output, options.command, options.label);
  if (file !== undefined) saveOutput(data, file);
  if (options.json) {
    emitJson(data);
    return;
  }
  output.text(data);
  for (const line of output.warnings?.(data) ?? []) err(line);
}

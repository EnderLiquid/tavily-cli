import type { Command } from "commander";
import { addKey, loadConfig, maskKey, removeKey } from "../core/config.js";
import { usageError } from "../core/errors.js";
import { labelsOf } from "../core/pool.js";
import { updateState } from "../core/state.js";
import { printKeys } from "../ui/render.js";
import { emitJson, log, out } from "../ui/stream.js";
import { jsonFlag } from "./runtime.js";

async function readStdinKey(): Promise<string> {
  if (process.stdin.isTTY) {
    throw usageError("pass the key as an argument or pipe it on stdin");
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString("utf8").split(/\r?\n/)[0]?.trim() ?? "";
}

export function configure(keys: Command): void {
  keys
    .command("add")
    .description("add a key to the pool")
    .argument("<label>", "name used by the pool")
    .argument("[key]", "API key; reads the first line of stdin when omitted")
    .action(async (label: string, key: string | undefined, _options: unknown, command: Command) => {
      const value = key ?? (await readStdinKey());
      if (value.trim() === "") {
        throw usageError("pass the key as an argument or pipe it on stdin");
      }
      const entry = await addKey(label, value);
      if (jsonFlag(command)) emitJson({ label: entry.label, ok: true });
      else log(`added ${entry.label}`);
    });

  keys
    .command("list")
    .description("list keys in the pool")
    .action((_options: unknown, command: Command) => {
      const config = loadConfig();
      const rows = config.keys.map((entry) => ({
        label: entry.label,
        key: maskKey(entry.key),
        enabled: entry.enabled,
      }));
      if (jsonFlag(command)) {
        emitJson({ keys: rows });
        return;
      }
      if (rows.length === 0) {
        out("No keys configured. Run: tavily-cli keys add <label>");
        return;
      }
      printKeys(rows);
    });

  keys
    .command("remove")
    .description("remove a key from the pool")
    .argument("<label>", "name used by the pool")
    .action(async (label: string, _options: unknown, command: Command) => {
      await removeKey(label);
      const config = loadConfig();
      await updateState(labelsOf(config), () => {});
      if (jsonFlag(command)) emitJson({ label, ok: true });
      else log(`removed ${label}`);
    });
}

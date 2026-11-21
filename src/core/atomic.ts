import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import lockfile from "proper-lockfile";
import { messageOf, stateError } from "./errors.js";

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  try {
    await fs.chmod(dir, 0o700);
  } catch {
    // Windows ignores POSIX modes.
  }
}

export async function writeAtomic(file: string, content: string): Promise<void> {
  const dir = path.dirname(file);
  await ensureDir(dir);
  const temp = path.join(dir, `.${path.basename(file)}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    const handle = await fs.open(temp, "wx", 0o600);
    try {
      await handle.writeFile(content, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await fs.chmod(temp, 0o600);
    } catch {
      // Windows ignores POSIX modes.
    }
    await fs.rename(temp, file);
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

export async function withFileLock<T>(target: string, fn: () => Promise<T>): Promise<T> {
  const dir = path.dirname(target);
  await ensureDir(dir);
  let release: (() => Promise<void>) | undefined;
  try {
    release = await lockfile.lock(target, {
      lockfilePath: path.join(dir, `.${path.basename(target)}.lock`),
      stale: 15_000,
      retries: { retries: 200, minTimeout: 5, maxTimeout: 200 },
      realpath: false,
      onCompromised: () => {},
    });
  } catch (error) {
    throw stateError(`cannot lock ${target}: ${messageOf(error)}`);
  }
  try {
    return await fn();
  } finally {
    await release().catch(() => {});
  }
}

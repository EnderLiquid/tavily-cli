import { TavilyRequestError } from "@tavily/core";
import { createApi } from "./client.js";
import type { Config, KeyEntry } from "./config.js";
import { creditsOf, isRecord } from "./cost.js";
import { apiError, messageOf, networkError, quotaError } from "./errors.js";
import {
  coolDown,
  labelsOf,
  markInvalid,
  penalize,
  refund,
  type Selection,
  type SelectResult,
  selectKey,
  settle,
} from "./pool.js";
import { drain, track } from "./queue.js";
import { updateState } from "./state.js";
import { backgroundSync } from "./sync.js";

/**
 * 429 后的 key 冷却时长。
 *
 * `@tavily/core` 在构造 `TavilyRequestError` 时只保留 `status` 与 `body`，响应头被丢弃，
 * 因此读不到 `Retry-After`。应用层 429 的秒数也出现在错误文本里；网关拦截的秒数只在
 * 响应头中，固定为 60 秒，且实际封锁可能更久。这里统一按 60 秒冷却，期间由号池换号。
 */
const RATE_LIMIT_COOLDOWN_SEC = 60;

export interface PoolResponse {
  data: Record<string, unknown>;
  label: string;
}

export interface PostOptions {
  estimate: number;
  timeoutSeconds: number;
}

function quotaMessage(skips: SelectResult["skips"]): string {
  if (skips.length === 0) {
    return "no keys configured; run tavily-cli keys add <label>";
  }
  if (skips.every((skip) => skip.reason === "uncalibrated" || skip.reason === "disabled")) {
    return "no key with known remaining; run tavily-cli usage --sync";
  }
  return "no key with enough credits; run tavily-cli usage";
}

async function pick(config: Config, estimate: number): Promise<SelectResult> {
  const result = await updateState(labelsOf(config), (state) => selectKey(config, state, estimate));
  for (const entry of result.toSync) track(backgroundSync(config, entry));
  return result;
}

function refuse(result: SelectResult): never {
  const details = result.skips.length === 0 ? undefined : { skips: result.skips };
  throw quotaError(quotaMessage(result.skips), details);
}

/** POST through the pool: select, reserve, settle, and fail over on quota-class errors. */
export async function postWithPool(
  config: Config,
  endpoint: string,
  body: Record<string, unknown>,
  options: PostOptions,
): Promise<PoolResponse> {
  let result = await pick(config, options.estimate);
  if (result.selection === null) {
    await drain(config.drainTimeoutSec * 1000);
    result = await pick(config, options.estimate);
  }
  if (result.selection === null) refuse(result);

  const maxAttempts = Math.max(1, Math.min(1 + config.retries, config.keys.length));
  let selection: Selection = result.selection;
  let lastMessage = "";

  for (let attempt = 1; ; attempt++) {
    const entry: KeyEntry = selection.entry;
    const api = createApi(config.apiBaseUrl, entry.key);
    let data: unknown;
    try {
      data = await api.post(endpoint, body, options.timeoutSeconds);
    } catch (error) {
      if (!(error instanceof TavilyRequestError)) {
        await refund(config, entry, options.estimate);
        throw networkError(messageOf(error));
      }
      const status = error.status;
      lastMessage = messageOf(error);
      if (status === 401 || status === 403) {
        await refund(config, entry, options.estimate);
        await markInvalid(config, entry, lastMessage);
      } else if (status === 429) {
        await refund(config, entry, options.estimate);
        await coolDown(config, entry, RATE_LIMIT_COOLDOWN_SEC);
      } else if (status === 432 || status === 433) {
        await penalize(config, entry, options.estimate);
        track(backgroundSync(config, entry, true));
      } else {
        await refund(config, entry, options.estimate);
        throw apiError(lastMessage);
      }
      if (attempt >= maxAttempts) {
        throw quotaError(`giving up after ${attempt} attempt(s): ${lastMessage}`);
      }
      const next = await pick(config, options.estimate);
      if (next.selection === null) refuse(next);
      selection = next.selection;
      continue;
    }

    if (!isRecord(data)) {
      await refund(config, entry, options.estimate);
      throw apiError("unexpected response body");
    }
    const credits = creditsOf(data);
    const due = await settle(config, entry, options.estimate, credits ?? options.estimate);
    if (due) track(backgroundSync(config, entry));
    return { data, label: entry.label };
  }
}

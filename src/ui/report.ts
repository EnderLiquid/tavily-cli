import { CommanderError } from "commander";
import { CliError, messageOf } from "../core/errors.js";
import { list, record, text } from "./data.js";
import { emitJson, err } from "./stream.js";

function cleanCommanderMessage(message: string): string {
  return message.replace(/^error:\s*/i, "");
}

function detailLines(details: unknown): string[] {
  const data = record(details);
  const skips = list(data.skips).map((item) => {
    const skip = record(item);
    const remaining = typeof skip.remaining === "number" ? ` (remaining ${skip.remaining})` : "";
    return `  ${text(skip.label)}: ${text(skip.reason)}${remaining}`;
  });
  const failures = list(data.failures).map((item) => {
    const failure = record(item);
    return `  ${text(failure.label)}: ${text(failure.error)}`;
  });
  return [...skips, ...failures];
}

/** 让致命错误只写一个流。 */
export function reportError(error: unknown, json: boolean): number {
  if (error instanceof CommanderError) {
    if (error.exitCode === 0) return 0;
    if (json) {
      emitJson({ error: cleanCommanderMessage(error.message), code: "usage_error" });
    }
    return 2;
  }
  if (error instanceof CliError) {
    if (json) {
      const payload: Record<string, unknown> = { error: error.message, code: error.code };
      if (error.details !== undefined) payload.details = error.details;
      emitJson(payload);
    } else {
      err(`error: ${error.message}`);
      for (const line of detailLines(error.details)) err(line);
    }
    return error.exitCode;
  }
  if (json) {
    emitJson({ error: messageOf(error), code: "state_error" });
  } else {
    err(`error: ${messageOf(error)}`);
  }
  return 1;
}

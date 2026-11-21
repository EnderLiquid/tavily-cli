export type ErrorCode =
  | "quota_exhausted"
  | "key_invalid"
  | "config_error"
  | "state_error"
  | "api_error"
  | "network_error"
  | "usage_error";

export class CliError extends Error {
  readonly code: ErrorCode;
  readonly exitCode: number;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, exitCode: number, details?: unknown) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.exitCode = exitCode;
    this.details = details;
  }
}

export function usageError(message: string): CliError {
  return new CliError("usage_error", message, 2);
}

export function configError(message: string): CliError {
  return new CliError("config_error", message, 2);
}

export function stateError(message: string): CliError {
  return new CliError("state_error", message, 1);
}

export function quotaError(message: string, details?: unknown): CliError {
  return new CliError("quota_exhausted", message, 3, details);
}

export function keyInvalidError(message: string): CliError {
  return new CliError("key_invalid", message, 3);
}

export function apiError(message: string, details?: unknown): CliError {
  return new CliError("api_error", message, 4, details);
}

export function networkError(message: string): CliError {
  return new CliError("network_error", message, 4);
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

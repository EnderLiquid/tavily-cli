import { createTransport } from "@tavily/core";
import { USAGE_TIMEOUT_SEC } from "./timeouts.js";

export interface Api {
  post(endpoint: string, body: Record<string, unknown>, timeoutSeconds: number): Promise<unknown>;
  getUsage(): Promise<unknown>;
}

export function createApi(apiBaseUrl: string, key: string): Api {
  const transport = createTransport({
    apiKey: key,
    apiBaseURL: apiBaseUrl,
    clientSource: "tavily-cli-pool",
  });
  return {
    post: (endpoint, body, timeoutSeconds) => transport.post(endpoint, body, { timeoutSeconds }),
    getUsage: () => transport.get("usage", { timeoutSeconds: USAGE_TIMEOUT_SEC }),
  };
}

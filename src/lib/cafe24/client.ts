import "server-only";

import type { Cafe24Config } from "./config";

type Cafe24FetchOptions = {
  body?: unknown;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  searchParams?: Record<string, number | string | undefined>;
};

export class Cafe24ApiError extends Error {
  details: unknown;
  status: number;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "Cafe24ApiError";
    this.details = details;
    this.status = status;
  }
}

export async function cafe24Fetch<T>(
  config: Cafe24Config,
  pathname: string,
  options: Cafe24FetchOptions = {},
): Promise<T> {
  const url = new URL(`${config.apiBaseUrl}${pathname}`);

  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      "X-Cafe24-Api-Version": config.apiVersion,
    },
    method: options.method ?? "GET",
  });

  const payload = await readJson(response);

  if (!response.ok) {
    throw new Cafe24ApiError(
      extractCafe24ErrorMessage(payload) ??
        `Cafe24 API 요청 실패 (${response.status})`,
      response.status,
      payload,
    );
  }

  return payload as T;
}

async function readJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractCafe24ErrorMessage(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error
  ) {
    return String(payload.error.message);
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload
  ) {
    return String(payload.message);
  }

  return null;
}

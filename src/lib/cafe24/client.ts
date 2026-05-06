import "server-only";

import type { Cafe24Config } from "./config";

type Cafe24FetchOptions = {
  body?: unknown;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  searchParams?: Record<string, number | string | undefined>;
  timeoutMs?: number;
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
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 15_000,
  );

  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  let response: Response;

  try {
    response = await fetch(url, {
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
        "X-Cafe24-Api-Version": config.apiVersion,
      },
      method: options.method ?? "GET",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Cafe24ApiError(
        `Cafe24 API 요청 시간이 초과되었습니다 (${options.timeoutMs ?? 15_000}ms)`,
        504,
        null,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

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

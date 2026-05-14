import "server-only";

type HeaderReader = Pick<Headers, "get">;

export type RequestBodySizeResult =
  | { ok: true }
  | { error: string; ok: false; status: 400 | 411 | 413 };

export function validateRequestBodySize(
  headers: HeaderReader,
  maxBytes: number,
  options: { requireContentLength?: boolean } = {},
): RequestBodySizeResult {
  const raw = headers.get("content-length");

  if (!raw) {
    return options.requireContentLength
      ? {
          error: "Content-Length is required for this request.",
          ok: false,
          status: 411,
        }
      : { ok: true };
  }

  const length = Number(raw);

  if (!Number.isSafeInteger(length) || length < 0) {
    return {
      error: "Invalid Content-Length.",
      ok: false,
      status: 400,
    };
  }

  if (length > maxBytes) {
    return {
      error: "Request body is too large.",
      ok: false,
      status: 413,
    };
  }

  return { ok: true };
}

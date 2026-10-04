import createClient from "openapi-fetch";

import type { paths } from "./schema";

/** RFC 9457 problem+json body; every Kori error carries a request_id. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  request_id?: string;
  [extension: string]: unknown;
}

export class ApiError extends Error {
  constructor(
    readonly problem: Problem,
    readonly response: Response,
  ) {
    super(problem.detail || problem.title);
    this.name = "ApiError";
  }
}

/** openapi-fetch has already read the body, so `body` is its parsed error payload. */
function toProblem(response: Response, body: unknown): Problem {
  const fallback: Problem = {
    type: "about:blank",
    title: response.statusText || "Request failed",
    status: response.status,
    detail: response.statusText || `Request failed with status ${response.status}`,
  };
  const isProblem = response.headers.get("content-type")?.includes("application/problem+json");
  if (isProblem && typeof body === "object" && body !== null) {
    return { ...fallback, ...(body as Partial<Problem>) };
  }
  return fallback;
}

// Same-origin in the browser (the dev proxy forwards /api). Node's fetch, used by
// the tests, needs an absolute URL, so fall back to the jsdom origin there.
export const api = createClient<paths>({
  baseUrl: globalThis.location?.origin ?? "",
  credentials: "include",
  // Resolve fetch per call so test doubles (MSW) installed later are honoured.
  fetch: (request) => globalThis.fetch(request),
});

/** Unwrap an openapi-fetch result, throwing an ApiError built from problem+json. */
export function unwrap<T>(result: {
  data?: T;
  error?: unknown;
  response: Response;
}): NonNullable<T> {
  if (result.error !== undefined || !result.response.ok || result.data == null) {
    throw new ApiError(toProblem(result.response, result.error), result.response);
  }
  return result.data;
}

/** Like `unwrap` for 204 responses, which have no body to return. */
export function unwrapEmpty(result: { error?: unknown; response: Response }): void {
  if (result.error !== undefined || !result.response.ok) {
    throw new ApiError(toProblem(result.response, result.error), result.response);
  }
}

let onUnauthorized: (() => void) | undefined;

/** Register what happens when an API call comes back 401 (the session expired). */
export function setUnauthorizedHandler(handler: (() => void) | undefined) {
  onUnauthorized = handler;
}

// Login and /auth/me report 401 themselves (a wrong password, "not signed in yet").
api.use({
  onResponse({ response, schemaPath }) {
    if (response.status === 401 && !schemaPath.startsWith("/api/v1/auth/")) onUnauthorized?.();
  },
});

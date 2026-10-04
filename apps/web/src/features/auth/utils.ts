import { ApiError } from "@/api/client";

function retryMinutes(response: Response): number | null {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : null;
}

/** User-facing text for a failed login attempt. */
export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.response.status === 401) return "Email or password is incorrect";
    if (error.response.status === 429) {
      const minutes = retryMinutes(error.response);
      return minutes
        ? `Too many attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`
        : "Too many attempts. Try again later";
    }
    return error.message;
  }
  return "Could not reach Kori. Check your connection and try again";
}

/** A `next` target is only honoured when it is a same-origin path. */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/transactions";
  }
  return next;
}

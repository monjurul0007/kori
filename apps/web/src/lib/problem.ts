import { ApiError } from "@/api/client";

const AT_MOST_CHARACTERS = /at most (\d+) characters?/;

/** The API's pydantic prefix isn't meant for people ("Value error, Amount is too large"). */
export function stripValueErrorPrefix(message: string): string {
  return message.replace(/^Value error, /, "");
}

export const tooLong = (max: number) => `Use ${max} characters or fewer`;

/** A server validation message in the UI's voice: no pydantic prefix, friendlier length text. */
export function friendlyProblemMessage(message: string): string {
  const cleaned = stripValueErrorPrefix(message);
  const match = AT_MOST_CHARACTERS.exec(cleaned);
  return match ? tooLong(Number(match[1])) : cleaned;
}

export interface FieldProblem<Field extends string> {
  field: Field;
  message: string;
}

interface ProblemItem {
  loc?: unknown[];
  msg?: string;
}

const UNKNOWN_PROBLEM_MESSAGE = "Invalid value";

/**
 * The `errors[]` of an RFC 9457 problem (the API sends it on 422) as form-field messages. `fieldFor` maps an `errors[].loc`
 * to a form field; items it can't place are left out, so an empty result means "show a toast".
 */
export function problemFieldErrors<Field extends string>(
  error: unknown,
  fieldFor: (loc: unknown[]) => Field | undefined,
): FieldProblem<Field>[] {
  if (!(error instanceof ApiError)) return [];
  if (!Array.isArray(error.problem.errors)) return [];
  const problems: FieldProblem<Field>[] = [];
  for (const item of error.problem.errors as ProblemItem[]) {
    const field = fieldFor(item.loc ?? []);
    if (!field) continue;
    problems.push({
      field,
      message: item.msg ? friendlyProblemMessage(item.msg) : UNKNOWN_PROBLEM_MESSAGE,
    });
  }
  return problems;
}

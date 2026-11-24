/** Name length limits. Keep in step with `max_length` in the API schemas. */
export const CATEGORY_NAME_MAX = 50; // apps/api/src/kori/categories/schemas.py
export const PAYMENT_METHOD_NAME_MAX = 40; // apps/api/src/kori/payment_methods/schemas.py

/** The counter appears once the name is this close to the limit. */
export const COUNTER_WITHIN = 10;

export const tooLong = (max: number) => `Use ${max} characters or fewer`;

/** Friendlier wording for the API's "String should have at most N characters". */
export function friendlyMessage(msg: string | undefined): string {
  const match = /at most (\d+) characters?/.exec(msg ?? "");
  return match ? tooLong(Number(match[1])) : (msg ?? "Invalid name");
}

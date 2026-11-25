// Money is a decimal string in taka everywhere (ADR-0004). Never use floats.

const AMOUNT = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;
const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";
// A dot needs digits after it, like the API and parseTakaInput: "1." is not an amount.
const TYPED_AMOUNT = /^(-?)(\d+)(?:\.(\d+))?$/;

/** Mirrors the API's MAX_POISHA (apps/api/src/kori/common/money.py); the limit is inclusive. */
export const MAX_AMOUNT_POISHA = 10n ** 13n;
const MAX_AMOUNT_TEXT = "৳1,00,00,00,00,000";

export const AMOUNT_ERRORS = {
  missing: "Enter an amount",
  tooManyDecimals: "Use up to 2 decimal places",
  notPositive: "Must be above zero",
  tooLarge: `That's more than ${MAX_AMOUNT_TEXT}`,
} as const;

function stripAmountNoise(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d))).replace(/[৳,\s]/g, "");
}

/** Lakh grouping by hand: the last three digits, then pairs (12,50,000). */
function groupLakh(digits: string): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${head},${digits.slice(-3)}`;
}

/** "1250000.5" -> "৳12,50,000.50"; whole amounts show no decimals. */
export function formatTaka(amount: string): string {
  const match = AMOUNT.exec(amount.trim());
  if (!match) throw new Error(`Invalid taka amount: ${amount}`);
  const [, sign = "", whole = "0", fraction = ""] = match;
  const cents = fraction.padEnd(2, "0");
  const decimals = cents === "00" ? "" : `.${cents}`;
  return `${sign}৳${groupLakh(whole.replace(/^0+(?=\d)/, ""))}${decimals}`;
}

/**
 * Turn what a person typed ("৳ 1,250.5", "১২৫০") into an API decimal string
 * ("1250.50"), or null when it isn't a valid amount (or has more than 2 decimals).
 */
export function parseTakaInput(input: string): string | null {
  const cleaned = stripAmountNoise(input);
  const match = AMOUNT.exec(cleaned);
  if (!match || match[1]) return null;
  const whole = (match[2] ?? "0").replace(/^0+(?=\d)/, "");
  const fraction = match[3];
  return fraction ? `${whole}.${fraction.padEnd(2, "0")}` : whole;
}

/** Exact integer poisha for sums; amounts stay strings at every boundary. */
export function toPoisha(amount: string): bigint {
  const match = AMOUNT.exec(amount.trim());
  if (!match) throw new Error(`Invalid taka amount: ${amount}`);
  const [, sign = "", whole = "0", fraction = ""] = match;
  const poisha = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return sign ? -poisha : poisha;
}

export function fromPoisha(poisha: bigint): string {
  const abs = poisha < 0n ? -poisha : poisha;
  return `${poisha < 0n ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}

/**
 * The message to show for a typed amount that can't be saved, or null when it is fine.
 * Compares integer poisha as bigint so values near the limit stay exact.
 */
export function validateAmount(input: string): string | null {
  const match = TYPED_AMOUNT.exec(stripAmountNoise(input));
  if (!match) return AMOUNT_ERRORS.missing;
  const [, sign = "", whole = "0", fraction = ""] = match;
  if (fraction.length > 2) return AMOUNT_ERRORS.tooManyDecimals;
  const poisha = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (sign || poisha === 0n) return AMOUNT_ERRORS.notPositive;
  if (poisha > MAX_AMOUNT_POISHA) return AMOUNT_ERRORS.tooLarge;
  return null;
}

export { stripValueErrorPrefix } from "./problem";

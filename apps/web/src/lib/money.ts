// Money is a decimal string in taka everywhere (ADR-0004). Never use floats.

const AMOUNT = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;
const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

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
  const cleaned = input
    .replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)))
    .replace(/[৳,\s]/g, "");
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

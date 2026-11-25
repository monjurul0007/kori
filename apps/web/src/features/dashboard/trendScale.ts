import { toPoisha } from "@/lib/money";

const POISHA_PER_TAKA = 100n;
const TICK_INTERVALS = 3;
const THOUSAND = 1_000;
const MILLION = 1_000_000;
/** Step sizes (before the power of ten) that read as round numbers on an axis. */
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];

function wholeTaka(amount: string): number {
  return Number(toPoisha(amount) / POISHA_PER_TAKA);
}

/** One decimal place from integer tenths, so "31.2" and "15" never go through float formatting. */
function tenthsText(tenths: number): string {
  const whole = Math.floor(tenths / 10);
  const fraction = tenths % 10;
  return fraction === 0 ? `${whole}` : `${whole}.${fraction}`;
}

/** Compact taka for an axis or a bar label: 880, 31.2k, 1.5M. Whole taka, no currency sign. */
export function formatShortTaka(taka: number): string {
  if (taka >= MILLION) return `${tenthsText(Math.round(taka / (MILLION / 10)))}M`;
  if (taka >= THOUSAND) {
    const tenths = Math.round(taka / (THOUSAND / 10));
    // 999.96k rounds up to a thousand k, which reads better as 1M.
    return tenths >= THOUSAND * 10 ? "1M" : `${tenthsText(tenths)}k`;
  }
  return `${Math.round(taka)}`;
}

/** Compact taka from a decimal string ("31200.00" gives "31.2k"). */
export function shortAmount(amount: string): string {
  return formatShortTaka(wholeTaka(amount));
}

/** Round axis ticks from 0 up to at least `maxTaka`: 4 ticks, or just [0] when there is nothing to show. */
export function axisTicks(maxTaka: number): number[] {
  if (maxTaka <= 0) return [0];
  const rawStep = maxTaka / TICK_INTERVALS;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const factor = NICE_STEPS.find((step) => step * magnitude >= rawStep) ?? 10;
  const step = factor * magnitude;
  return Array.from({ length: TICK_INTERVALS + 1 }, (_, i) => i * step);
}

/** Whole taka of the largest value in a list of decimal strings, as the axis needs it. */
export function largestTaka(amounts: string[]): number {
  const ceilTaka = (amount: string) =>
    Number((toPoisha(amount) + POISHA_PER_TAKA - 1n) / POISHA_PER_TAKA);
  return Math.max(0, ...amounts.map(ceilTaka));
}

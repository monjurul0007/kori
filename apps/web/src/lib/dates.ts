// `occurred_on` is a local calendar date in Asia/Dhaka (ADR-0004). Dates are
// "YYYY-MM-DD" strings; Bangladesh has no DST, so Dhaka is a fixed UTC+6.

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number): string => String(n).padStart(2, "0");

function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Invalid date: ${iso}`);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Today's date in Dhaka, whatever the device's own time zone is. */
export function todayInDhaka(now: Date = new Date()): string {
  return fromDate(new Date(now.getTime() + DHAKA_OFFSET_MS));
}

/** "2026-09-28" -> "2026-09" */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function startOfMonth(month: string): string {
  return `${month}-01`;
}

export function endOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) throw new Error(`Invalid month: ${month}`);
  return fromDate(new Date(Date.UTC(y, m, 0)));
}

/** The date a new entry starts on while `month` is on screen: today, or the month's last day if past. */
export function defaultDateForMonth(month: string, today: string = todayInDhaka()): string {
  const last = endOfMonth(month);
  return last < today ? last : today;
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) throw new Error(`Invalid month: ${month}`);
  const shifted = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}`;
}

/** "2026-09-28" -> "Mon, 28 Sep" */
export function formatDisplayDate(iso: string): string {
  const date = toDate(iso);
  return `${DAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** "2026-09" -> "September 2026" */
export function formatMonth(month: string): string {
  const date = toDate(startOfMonth(month));
  const name = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(date);
  return `${name} ${date.getUTCFullYear()}`;
}

/** "2026-09" -> "September" */
export function monthName(month: string): string {
  return formatMonth(month).split(" ")[0] ?? month;
}

/** "2026-09" -> "Sep 2026" */
export function formatMonthShort(month: string): string {
  return `${shortMonthName(month)} ${month.slice(0, 4)}`;
}

/** "2026-09" -> "Sep" */
export function shortMonthName(month: string): string {
  const date = toDate(startOfMonth(month));
  return new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(date);
}

export function addDays(iso: string, delta: number): string {
  const date = toDate(iso);
  date.setUTCDate(date.getUTCDate() + delta);
  return fromDate(date);
}

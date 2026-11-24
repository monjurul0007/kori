import type { components } from "@/api/schema";

type Frequency = components["schemas"]["RecurrenceFrequency"];

export interface ScheduleInput {
  frequency: Frequency;
  interval: number;
  /** "YYYY-MM-DD"; its weekday, day of month or day and month anchor the schedule. */
  start_on: string;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** 1 -> "1st", 22 -> "22nd", 11 -> "11th" */
function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10] ?? "th"}`;
}

/** "Monthly on the 1st", "Every 2 weeks on Saturday", "Yearly on 15 March". Display only. */
export function formatSchedule({ frequency, interval, start_on }: ScheduleInput): string {
  const [y, m, d] = start_on.split("-").map(Number);
  if (!y || !m || !d) return "";
  const every = (unit: string, adverb: string) =>
    interval > 1 ? `Every ${interval} ${unit}s` : adverb;
  switch (frequency) {
    case "weekly": {
      const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
      return `${every("week", "Weekly")} on ${weekday}`;
    }
    case "monthly":
      return `${every("month", "Monthly")} on the ${ordinal(d)}`;
    case "yearly":
      return `${every("year", "Yearly")} on ${d} ${MONTHS[m - 1]}`;
  }
}

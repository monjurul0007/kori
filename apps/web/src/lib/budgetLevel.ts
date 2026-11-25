import type { components } from "@/api/schema";

type Level = components["schemas"]["Level"];

export const levelBar: Record<Level, string> = {
  ok: "bg-primary",
  warning: "bg-warn/100",
  over: "bg-over",
};

/** "85.0" -> "85", "34.5" -> "34.5" */
export const shortPercent = (percent: string) => percent.replace(/\.0$/, "");

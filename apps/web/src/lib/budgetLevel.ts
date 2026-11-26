/** "85.0" -> "85", "34.5" -> "34.5" */
export const shortPercent = (percent: string) => percent.replace(/\.0$/, "");

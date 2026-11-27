// Real problems this suite found on its first run. Each has a BUG card in "🐞 Triage / Bugs".
// Each exemption is as narrow as it can be, so the affected screens are still checked for
// everything else. Delete the entry (and the lines that use it) in the PR that fixes the bug; the
// tests then enforce the full rule. Never add an entry without a BUG card.

/** BUG-17: the dashboard Totals list is not a valid <dl>. Only these axe rules are skipped there. */
export const DASHBOARD_DEFINITION_LIST = {
  bug: "BUG-17",
  path: "/dashboard",
  skippedRules: ["definition-list", "dlitem"],
} as const;

/** BUG-18: the 404 numeral is too pale in light mode. Only that element is left out of the scan. */
export const NOT_FOUND_NUMERAL_CONTRAST = {
  bug: "BUG-18",
  path: "/no-such-page",
  colorScheme: "light",
  excludedSelector: ".text-6xl",
} as const;

/**
 * BUG-19: these screens are wider than a 768px viewport. A screen may overflow by at most the
 * number of pixels measured on the first run (10 and 89-90), rounded up because the widths vary a
 * little with the data. It still fails if the screen gets clearly worse.
 */
export const TABLET_OVERFLOW = {
  bug: "BUG-19",
  viewportWidth: 768,
  maxExcessPixelsByPath: { "/dashboard": 20, "/transactions": 100 } as Record<string, number>,
} as const;

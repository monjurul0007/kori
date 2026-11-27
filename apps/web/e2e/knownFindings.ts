// Real problems this suite found on its first run. Each has a BUG card in "🐞 Triage / Bugs".
// `test.fail()` keeps the check running: while the bug exists the test passes by failing, and the
// moment the bug is fixed the test goes red until its entry here is deleted. Never add an entry
// without a BUG card.
export const KNOWN_FINDINGS = {
  dashboardDefinitionList: "BUG-17",
  notFoundHeadingContrastLight: "BUG-18",
  sidewaysScrollAtTablet: "BUG-19",
} as const;

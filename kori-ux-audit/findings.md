# Kori UX / QA audit — running log

- **Started:** 2026-11-24 (UTC)
- **App:** https://kori-655225497410.asia-southeast1.run.app (test account test@gmail.com)
- **Trello target list:** 🐞 Triage / Bugs (`6b055b8a1e94064f4fc5bf9a`). It was empty at the start, so there were no duplicates to merge.
- **Browser:** The Chrome extension isn't available in this cloud session, so all testing uses the container's headless Chromium (Playwright 1.63, `timezoneId: Asia/Dhaka`). Screenshots are saved in `kori-ux-audit/screens/`.
- **Caution:** The server locks an email after 5 failed logins within 15 minutes, and the lock also refuses the correct password (`auth/service.py` THROTTLE_*). Wrong-password tests on test@gmail.com are capped at 3 per 15 minutes. Throttle tests use fake `qa-…@example.invalid` emails.

## Site map

| # | Route | Main content / actions | Status |
|---|---|---|---|
| 1 | `/login` | Email, password, "Log in". No show/hide password, no "Forgot password", no signup link | TESTED |
| 2 | `/` | Redirects to `/dashboard` | TESTED |
| 3 | `/dashboard` | Month switcher (prev, native month picker, next). Cards: Budget (or "Set budgets" link), "Where the money went" breakdown, "Last 6 months" chart with a data table, Recent transactions with "See all" | TESTED |
| 4 | `/transactions` | Export CSV, month switcher, search box, Filters sheet, totals (Spent/Income/Net), day-grouped list, row → edit sheet, empty state with "Add one" | TESTED |
| 5 | `/budgets` | Month switcher, Overall "Set overall limit", per-category "Set budget" (BudgetEditSheet) | TESTED |
| 6 | `/settings` | Profile (read-only: name, email, time zone, currency), Manage links, **Log out** (the only logout in the app) | TESTED |
| 7 | `/settings/categories` | Expense/Income tabs, move up/down, edit, archive, "Add category" | TESTED |
| 8 | `/settings/payment-methods` | Move up/down, edit, archive, "Add payment method" | TESTED |
| 9 | `/settings/tags` | List of tags (created from transactions). Empty state copy | TESTED |
| G | Global shell | Desktop side nav with "Add transaction" (opens the TransactionSheet). Mobile bottom nav. Toasts (sonner), offline banner, PWA install card / iOS sheet, update toast | TESTED |

Modals / sheets: TransactionSheet (add/edit, splits, tags, date quick-pick, payment method), FilterSheet, BudgetEditSheet, ReferenceListEditor dialogs (add/edit category or payment method, archive confirm?).

## Page test status
(updated as each page is finished)
- **/login: TESTED.** Valid login, wrong password, unknown email, empty fields, invalid format, whitespace-only, padded/uppercase email (works), very long input, Enter submit, double-submit protection (button disables, 1 POST), lockout after 5 failures (429, "Too many attempts. Try again in 15 minutes"), autocomplete=username/current-password, no show/hide, no forgot password, no signup route (404).
- **Add/Edit transaction dialog: TESTED (desktop).** Amount edge cases, category required, More…, split (add line, fill remaining, over/under, balanced save), income, Today/Yesterday, future/old/cleared date, merchant/note max length, emoji/HTML, tags (dedupe, # strip, long), payment method, edit + save, delete + confirm, Esc/overlay close.
- **/transactions: TESTED (desktop).** Search (debounce, 1 char, special chars, no results), filters sheet (type/category/payment/tag, chips, URL state, reload), month switcher (prev/next/future/invalid param), CSV export (BOM, quoting, split rows, filename), totals, day groups, row → edit.
- **/dashboard: TESTED (desktop).** Empty and with data, month switcher, budget card (none, overall set, over-budget warning), donut + legend, 6-month chart (hover, a11y label, sr-only table), recent transactions → edit dialog, See all link, Set budgets link.
- **/budgets: TESTED (desktop).** Set overall/category, validation (empty, 0, negative, text, 3dp, huge), edit (prefill), remove, past month read-only message, future month carries forward, progress bars (role=progressbar with valuetext), over budget state.
- **/settings: TESTED.** Profile read-only, Manage links, Log out (works, redirects to /login).
- **/settings/categories: TESTED.** Add (empty, duplicate case-insensitive, long, emoji), edit, reorder up/down (focus kept), archive (good confirm dialog copy), show archived + unarchive, Income tab (role=tab + aria-selected; no tabpanel).
- **/settings/payment-methods: TESTED.** Add (long, duplicate, valid with Kind select), list shows kind.
- **/settings/tags: TESTED.** Empty state, tag → transactions link, rename (merge-aware dialog, normalises to lowercase-hyphen), delete confirm ("It will be removed from 1 transaction…").
- **Accessibility sweep (all routes): TESTED.** Titles, lang, headings, computed contrast scan, tab order + focus ring per page, target sizes.
- **Responsive (375 mobile, 390, 768 tablet, 1280/1366/1440 desktop): TESTED.** No overflow at 375. 22px overflow on the dashboard at 768. Bottom nav + FAB ok, main has 96px bottom padding (content not hidden). Add sheet goes full-screen on mobile with Save below the fold. Filters bottom sheet fine on mobile. Login fine.
- **Session (all 8 routes): TESTED.** Logged-out direct URL redirects to /login?next=<route> (query kept). Login returns to that route. Refresh keeps the session. Back after logout shows only the login page. /me returns 401 and the cookie is cleared. Logged-in visit to /login redirects to /dashboard. next=//evil, https://evil and /\evil all go to /dashboard (no open redirect). Logout exists only on /settings.

## Issues
| # | Title | Severity | Type | Repro x2 | Trello |
|---|---|---|---|---|---|
| 1 | [Medium] [Routing] Unknown URLs show a generic "Something went wrong" error with only a Reload button | Medium | UX | 5 routes | https://trello.com/c/VbiF8mCu |
| 2 | [Medium] [Transactions] Add transaction dialog discards everything typed on Esc or outside click, with no warning | Medium | UX | Esc + overlay | https://trello.com/c/Ma6z3Yfn |
| 3 | [Medium] [Transactions] Saving a transaction gives no success feedback | Medium | UX | /transactions + /settings | https://trello.com/c/KWISRgGu |
| 4 | [Medium] [Transactions] Save button hidden below the fold in Add transaction dialog on laptop screens | Medium | UI | 1366x768 + 1440x900 | https://trello.com/c/si4kFUcH |
| 5 | [Medium] [Login] Field error messages aren't linked to their inputs (no aria-describedby) | Medium | Accessibility | 2 sessions | https://trello.com/c/sr9qITy2 |
| 6 | [Low] [Login] Over-long email/password shows raw validator text | Low | Copy | 2x | https://trello.com/c/C2NEUSve |
| 7 | [Low] [Transactions] Too-large amount shows raw server text "Value error, Amount is too large" | Low | Copy | 2 values | https://trello.com/c/hJsyKlt3 |
| 8 | [Low] [Login] No "Forgot password?" link or recovery guidance | Low | UX | 2 sessions | https://trello.com/c/shfVcgPb |
| 9 | [Low] [Login] No show/hide password toggle | Low | UX | 2 sessions | https://trello.com/c/KzXTSKs9 |
| 10 | [Medium] [Transactions] Search or filters with no matches show "No transactions in November. Add one" | Medium | UX/Copy | 2 searches + filter | https://trello.com/c/akvTYrVH |
| 11 | [Medium] [Transactions] Day header total counts expenses only; income-only day shows "৳0" | Medium | UX/UI | 2 searches + unfiltered | https://trello.com/c/9bObm26U |
| 12 | [Medium] [Transactions] "Add one" from a past month saves to today; entry never appears in that month | Medium | UX/Bug | Oct x2 + Dec | https://trello.com/c/WZlzL0qv |
| 13 | [Medium] [Transactions] Focus is lost when the delete confirmation appears | Medium | Accessibility | 2 runs | https://trello.com/c/5BcZbPOU |
| 14 | [Low] [Transactions] After "Confirm delete" the dialog stays open 1–2.5 s with no progress | Low | UX/Performance | 2 runs | https://trello.com/c/PewFRAmt |
| 15 | [Low] [Transactions] Totals and list flash to skeletons on every search | Low | UI/Performance | 4 queries | https://trello.com/c/aWn28l4Y |
| 16 | [Low] [Transactions] Single-character searches are silently ignored | Low | UX | Q, %, ☕ | https://trello.com/c/1rBVkCLf |
| 17 | [Medium] [Global] Form sheets (Filters, Budget, Add category, Add payment method) open full-width from the bottom on desktop (renamed from the Low Filters card) | Medium | UI | 4 sheets | https://trello.com/c/sJwU4O5o |
| 18 | [Low] [Transactions] Tag field doesn't suggest existing tags | Low | UX | 2 sessions | https://trello.com/c/ZJC15AHr |
| 19 | [Medium] [Dashboard] Month's total spent, income and net aren't shown anywhere | Medium | UX | 1440 + 1280 | https://trello.com/c/hIzqrdCy |
| 20 | [Medium] [Dashboard] "Last 6 months" chart has no values/axis/tooltips; small bars invisible | Medium | UI/UX | 1440 + 1280 | https://trello.com/c/IY2YQgo6 |
| 21 | [Low] [Dashboard] Recent transactions rows misaligned with card heading | Low | UI | 1440 + 1280 | https://trello.com/c/DMnxPczY |
| 22 | [Low] [Budgets] "Remove budget" deletes immediately, no confirm/feedback/undo | Low | UX | Food + Transport | https://trello.com/c/6nCzKgv3 |
| 23 | [Low] [Budgets] Zero/negative limit shows generic format error | Low | Copy | 0 + -100 | https://trello.com/c/jMUGveTv |
| 24 | [Low] [Budgets] "Overall" shown twice in Overall card | Low | UI/Copy | 2 sessions | https://trello.com/c/yTinCNEe |
| 25 | [Medium] [Settings] Long category/payment-method names fail with generic "Unprocessable Content" toast | Medium | Bug/Copy | 60 + 51 chars cat, 60 chars PM | https://trello.com/c/rQCXvk7N |
| 26 | [Low] [Transactions] Tag chips show typed text but tag saved normalised | Low | UX | 2 tags | https://trello.com/c/YHZTqceM |
| 27 | [Medium] [Accessibility] Every page has the same document title "Kori" | Medium | Accessibility | 7 routes x2 | https://trello.com/c/Z6JpcC5e |
| 28 | [Medium] [Accessibility] Income amounts in green (#059669) fail contrast 3.77:1 | Medium | Accessibility | dashboard + transactions | https://trello.com/c/vDKK9R6H |
| 29 | [Medium] [Accessibility] Month picker invisible focus, 3 Tab stops | Medium | Accessibility | dashboard + budgets | https://trello.com/c/LcnWdE8e |
| 30 | [Low] [Accessibility] Heading levels skip H1→H3 on Dashboard and Budgets | Low | Accessibility | 2 pages | https://trello.com/c/wdAcXdeP |
| 31 | [Low] [Accessibility] Bangla brand text not marked lang="bn" | Low | Accessibility | 7 routes | https://trello.com/c/yyybM8Tf |
| 32 | [Low] [Accessibility] No skip link | Low | Accessibility | 7 routes | https://trello.com/c/Ad6KB5xx |
| 33 | [Medium] [Settings] Settings subpages have no Back button (PWA dead end) | Medium | UX | 3 pages @375+390 | https://trello.com/c/UMBnOcqJ |
| 34 | [Medium] [Settings] Category names truncated on mobile (4 action buttons per row) | Medium | UI/UX | 375 + 390 | https://trello.com/c/PtcVc4gz |
| 35 | [Low] [Dashboard] Page scrolls sideways 22px at 768px (sr-only table) | Low | UI/Bug | 2 runs @768 | https://trello.com/c/oVYDSBW4 |
| 36 | [Low] [Accessibility] Small touch targets (16px close, 20px remove, 13px checkbox) | Low | Accessibility | 375 + 390 | https://trello.com/c/mrxuDHHz |

Comments added to existing cards: #7 hJsyKlt3 (Budgets also shows "Value error"), #17 sJwU4O5o (Budget sheet also a full-width bottom sheet), #3 KWISRgGu (no toast after budget save/remove; timings), #19 hIzqrdCy (clarifies the overall-budget case).

## Design improvement / modernization / best-practice tickets (requested mid-audit)
Concept page (private artifact): https://claude.ai/artifact/HYiSuqv16Dn7MLt93mEyec. **Version 2 (2026-11-24):** the owner disliked the cowrie logo and asked to drop green and refresh every page. It now shows 3 logo directions (Coin K recommended), the "Neel and Gada" indigo/marigold palette, 9 desktop frames and 10 phone screens, with a light/dark switch. Trello cards uhmhZld5 and E1vrnG62 were rewritten; comments were added to NUzZBvyV, vDKK9R6H and kcUkxUuR. Local copy: `kori-ux-audit/design-concept/index.html`, with renders `concept-desktop-light.png` and `concept-mobile-dark.png`.

| # | Title | Severity | Type | Trello |
|---|---|---|---|---|
| 37 | [Medium] [Brand] Replace the font-dependent "K" app icon with a new logo (Coin K recommended) | Medium | Design improvement | https://trello.com/c/uhmhZld5 |
| 38 | [Medium] [Design system] Replace the green theme with the "Neel and Gada" palette and define semantic tokens | Medium | Design improvement | https://trello.com/c/E1vrnG62 |
| 39 | [Medium] [Design system] Adopt a Bangla-ready typeface pair, with wide display figures for money | Medium | Design improvement | https://trello.com/c/rIHN2GES |
| 40 | [Medium] [Design system] Write DESIGN.md and consolidate shared components | Medium | Best practice | https://trello.com/c/VMR7UVAk |
| 41 | [Medium] [Dashboard] Redesign the dashboard around "Left to spend this month" | Medium | Design improvement | https://trello.com/c/JTUER2AI |
| 42 | [Medium] [Transactions] Redesign Add transaction as an amount-first quick-entry sheet | Medium | Design improvement | https://trello.com/c/0V0v8vv7 |
| 43 | [Medium] [Onboarding] Add a first-run checklist and guided empty states | Medium | Modernization | https://trello.com/c/cakx9gQ8 |
| 44 | [Low] [Settings] Add a Light / Dark / System theme switch | Low | Modernization | https://trello.com/c/kcUkxUuR |
| 45 | [Low] [Login] Give the login screen brand presence | Low | Design improvement | https://trello.com/c/NUzZBvyV |
| 46 | [Low] [PWA] Add an "Add expense" shortcut, install screenshots and an app id to the manifest | Low | Modernization | https://trello.com/c/9KOtT5fe |
| 47 | [Low] [Global] Respect prefers-reduced-motion and define a small motion spec | Low | Best practice | https://trello.com/c/dz5GrAVE |
| 48 | [Medium] [Quality] Add automated accessibility and layout checks to the Playwright e2e suite | Medium | Best practice | https://trello.com/c/t1HmfBMa |
| 49 | [Low] [Transactions] Show category icons and colours in transaction rows | Low | Design improvement | https://trello.com/c/AEuCn7N2 |

## Notes / observations (not yet confirmed or not cards)
- Passed: XSS-like merchant text `<b>bold</b>` is escaped. Emoji are saved and shown. Bangla digits ১২৫০, "৳ 1,250.5" and "1,250.50" are parsed. 0, -50, abc, 12.345 and 1e3 are rejected client-side.
- "-50" gives "Enter an amount like 1,250.50" (could say negatives aren't allowed). Minor; not carded yet.
- Offline: the banner "You're offline. You can look around, but changes won't save until you're back." appears, Save is blocked with the same message, and the banner clears when back online. Good.
- Simulated 500 on the transactions list shows the API `detail` plus "Try again". Acceptable.
- /%2F%2Fevil.example as next renders an empty page (console warning "Matched leaf route ... does not have an element"). Edge case, not carded.

## Not tested / blocked
- Chrome extension integration was unavailable in this cloud session, so the audit used headless Chromium (Playwright). Browser **password-manager autofill** could not be exercised; only the `autocomplete` attributes were verified.
- Real **screen readers** (NVDA/VoiceOver/TalkBack) weren't available; a11y findings come from DOM/ARIA inspection, keyboard runs and a computed contrast scan.
- **Real devices** (iOS Safari standalone PWA, Android Chrome install prompt, iOS install sheet, update toast) weren't available; mobile was emulated (375/390px, touch).
- **Lockout on the real account** wasn't triggered (it would lock test@gmail.com for 15 min); throttling was verified with fake emails.
- **Password reset / signup**: neither exists in the app, so nothing to test beyond the 404s.
- **Session expiry** (30-day cookie, sliding extension) and multi-tab logout sync weren't tested (time-bound).
- **Profile/email/password changes**: not offered in the UI (read-only profile). Per instructions, nothing account-level was changed.

## QA- test data created
- Transaction "QA-Café ☕ <b>bold</b> & \"quotes\"", ৳250.50, Food & Dining, bKash, 2026-11-23, tag `qa-tag`, note "QA note 🧪 with emoji"
- Transaction "QA-From settings", ৳130 (edited from ৳120), Transport, 2026-11-24, tags `qa-mixed-case`, `qa-second-tag`
- Transaction "QA-Split", ৳500 split Groceries & Bazar 300 / Shopping 200, 2026-11-24
- Transaction "QA-Salary", ৳50,000 income, Salary, 2026-11-24
- Transaction "QA-Delete me", "QA-Delete A", "QA-Delete B" were created and then **deleted** during testing (none remain)
- Category **QA-Pets** (expense, archived — visible under "Show archived")
- Payment method **QA-City Bank Card** (kind Cash)
- Tags now: `qa-tag-renamed` (was qa-tag, on QA-Café), `qa-mixed-case`, `qa-second-tag` (both on QA-From settings)
- Budgets (from Nov 2026 onward): **Overall ৳20,000**, **Groceries & Bazar ৳200**. Food & Dining (1000→1500→1200) and Transport (500) were set and then removed.
- Failed-login records for fake emails qa-notanemail, qa-unknown1/2@example.invalid, qa-throttle1/2@example.invalid, qa-bbb…@x.io (server login_attempts table)

## Design Refresh implementation track (2026-11-24)
The owner approved the refresh and asked for implementation cards the Kori Engineer Routine can pick alongside milestone work. No code was written in this session.

- **New Trello list:** "🎨 Design Refresh · Neel and Gada" with 18 task cards in the house format (goal, design materials, context, in/out of scope, test plan, acceptance criteria, review focus, dependencies, resolves, branch/PR, kickoff prompt), each with its review-colour label:

| Card | Title | Review | Blocked by | Resolves (audit cards) |
|---|---|---|---|---|
| DR-01 https://trello.com/c/2xF8ao1x | docs: design refresh materials, DESIGN.md and ADR | skim | none | — |
| DR-02 https://trello.com/c/v3QGErpy | Neel and Gada tokens, fonts, motion | read | DR-01 | vDKK9R6H, E1vrnG62, rIHN2GES, wdAcXdeP, dz5GrAVE |
| DR-03 https://trello.com/c/QOLoMBtD | Coin K logo, icons, wordmark | skim | DR-02 | uhmhZld5, yyybM8Tf |
| DR-04 https://trello.com/c/rE8ajqfQ | shared UI primitives | read | DR-02 | VMR7UVAk, hJsyKlt3, jMUGveTv, mrxuDHHz |
| DR-05 https://trello.com/c/ZBqHe5N7 | app shell, headers, titles, skip link, 404 | read | DR-03, DR-04 | VbiF8mCu, Z6JpcC5e, Ad6KB5xx, UMBnOcqJ |
| DR-06 https://trello.com/c/hvAHyygc | accessible month picker | skim | DR-04 | LcnWdE8e |
| DR-07 https://trello.com/c/GLRztf4D | quick-entry Add transaction sheet | scrutinize | DR-04 | Ma6z3Yfn, KWISRgGu, si4kFUcH, WZlzL0qv, 0V0v8vv7 |
| DR-08 https://trello.com/c/BKdEifgg | edit/delete in sheet, tag suggestions | read | DR-07 | 5BcZbPOU, PewFRAmt, ZJC15AHr, YHZTqceM |
| DR-09 https://trello.com/c/5LFWwPYC | dashboard hero, totals, attention, recent | read | DR-05 | hIzqrdCy, DMnxPczY |
| DR-10 https://trello.com/c/9UzXhprw | dashboard breakdown and trend chart | read | DR-09 | IY2YQgo6, oVYDSBW4, JTUER2AI |
| DR-11 https://trello.com/c/nnfttmue | transactions list redesign | read | DR-05, DR-04 | akvTYrVH, 9bObm26U, aWn28l4Y, 1rBVkCLf, AEuCn7N2 |
| DR-12 https://trello.com/c/aPNIiAwN | budgets redesign | read | DR-05, DR-04 | 6nCzKgv3, yTinCNEe |
| DR-13 https://trello.com/c/7sMakpay | settings layout, General, theme switch | read | DR-05 | kcUkxUuR |
| DR-14 https://trello.com/c/I1zgEMvn | settings lists | read | DR-13, DR-04 | PtcVc4gz, rQCXvk7N, sJwU4O5o |
| DR-15 https://trello.com/c/pT2vk2vy | login redesign | read | DR-03, DR-04 | sr9qITy2, C2NEUSve, shfVcgPb, KzXTSKs9, NUzZBvyV |
| DR-16 https://trello.com/c/qAJZQvQx | first-run checklist | skim | DR-09 | cakx9gQ8 |
| DR-17 https://trello.com/c/FIxn7B6X | PWA shortcut, id, screenshots | skim | DR-03, DR-07 | 9KOtT5fe |
| DR-18 https://trello.com/c/Obq4MeA0 | automated a11y and layout e2e checks | read | DR-08, DR-10, DR-11, DR-12, DR-14, DR-15, DR-16 | t1HmfBMa |

- **All 49 audit cards** got a "Planned in DR-xx … moves to Done when DR-xx merges" comment.
- **Design materials for the cards:**
  - this folder's `design-concept/`: `index.html`, `tokens.css`, `brand/*.svg`, 41 `screens/*.png` in light and dark, and a `README.md` mapping each screen to its card
  - DR-01 copies it to `docs/design/` and `docs/brand/` on `main`
- **Kori Engineer routine (`trig_01VheUWTDMwu9TYrWntboCrY`) prompt updated:**
  - BUG- cards first; audit "[Severity] [Area]" cards are never picked directly
  - then it alternates Track M (current milestone) and Track D (Design Refresh)
  - DR cards: it reads DESIGN.md and opens the reference images, and PRs include light/dark screenshots
  - when a DR card merges, the audit cards it resolves move to Done
  - The routine card (dvZifuoD) and "How we work" (h4Mm3VqB) were updated to match.
- **Keep branch `claude/focused-wright-iatxgr`** until DR-01 merges; it holds the materials.

## Bug track, run in parallel (2026-11-24, later the same day)
The owner asked for the Triage findings to be turned into cards the routine picks up **in parallel** with milestone and design work. This replaces the "Planned in DR-xx" plan for 29 of the 36 findings. **Where this section and the DR table above differ, this section wins.**

**Ownership rule:** every audit finding has exactly one owner.
- A **BUG card** owns a finding when the behaviour fix should land now and survive the redesign. Its "Closes" list names the findings.
- A **DR card** owns a finding when the finding is purely visual. Its "Resolves" list names the findings.

### BUG cards (top of "🐞 Triage / Bugs", all "Blocked by: none")
| Card | Fix | Review | Closes (audit cards) | DR cards that wait for it |
|---|---|---|---|---|
| BUG-01 https://trello.com/c/J59pboY0 | discard guard + sticky Save in the transaction sheet | read | Ma6z3Yfn, si4kFUcH | DR-07 |
| BUG-02 https://trello.com/c/wcbgfxOd | "Add one" uses the viewed month's date; none for future months | skim | WZlzL0qv | DR-07 |
| BUG-03 https://trello.com/c/oge2RE8t | labelled day totals that include income | skim | 9bObm26U | DR-11 |
| BUG-04 https://trello.com/c/Woj9G9EN | name limits 50/40 with field errors | skim | rQCXvk7N | DR-14 |
| BUG-05 https://trello.com/c/AVybW9jA | search empty states, 1-char hint, keepPreviousData | read | akvTYrVH, aWn28l4Y, 1rBVkCLf | DR-11 |
| BUG-06 https://trello.com/c/i3JsYjdz | save/edit/delete toasts (Undo on create), focus to Cancel, "Deleting…" | read | KWISRgGu, 5BcZbPOU, PewFRAmt | DR-07, DR-08 |
| BUG-07 https://trello.com/c/ecZ8fmAT | real "Page not found" route | skim | VbiF8mCu | DR-05 |
| BUG-08 https://trello.com/c/FnRWRGEd | page titles, skip link, focus on navigation, settings Back | read | Z6JpcC5e, Ad6KB5xx, UMBnOcqJ | DR-05 |
| BUG-09 https://trello.com/c/UnO8n68N | login a11y, friendly copy, show/hide, forgot-password help | read | sr9qITy2, C2NEUSve, shfVcgPb, KzXTSKs9 | DR-15 |
| BUG-10 https://trello.com/c/ehdjHXIf | shared `validateAmount` for transaction and budget forms | skim | hJsyKlt3, jMUGveTv | DR-04 |
| BUG-11 https://trello.com/c/SBb3xMu3 | budget remove confirm + Undo, save toast, "Overall" once | read | 6nCzKgv3, yTinCNEe | DR-12 |
| BUG-12 https://trello.com/c/YCnp1ggR | tag combobox suggestions, normalised chips (keeps PR #39) | read | ZJC15AHr, YHZTqceM | DR-08 |
| BUG-13 https://trello.com/c/pPoxN17g | CardTitle as h2, `lang="bn"` | skim | wdAcXdeP, yyybM8Tf | DR-18 |
| BUG-14 https://trello.com/c/AyTmathb | 44px close, 32px chip remove, Show archived row | skim | mrxuDHHz | DR-18 |
| BUG-15 https://trello.com/c/PDQxaJNJ | no sideways scroll at 768px | skim | oVYDSBW4 | DR-18 |

### DR cards that kept their findings
These 7 findings stay with DR cards: vDKK9R6H (DR-02), LcnWdE8e (DR-06), hIzqrdCy and DMnxPczY (DR-09), IY2YQgo6 (DR-10), and PtcVc4gz and sJwU4O5o (DR-14). The 13 design proposals (#37–49) also stay with their DR cards.

### Changes to the DR cards
DR-02, 03, 04, 05, 07, 08, 10, 11, 12, 14, 15 and 18 were rewritten:
- **Resolves lists:** findings now owned by a BUG card were removed.
- **Blocked by:** each card now also lists the BUG cards it waits for, from the table above. DR-04 also waits for BUG-10, and DR-18 for BUG-13, 14 and 15.
- **Scope:** the redesign restyles the BUG fixes and keeps them; it never re-implements them.
- DR-05 and DR-08 were renamed to match their restyle-only scope.
- DR-15 no longer refers to a `kori reset-password` command. The CLI has only `create-user` and `seed`, so BUG-09 suggests a Backlog card for one.
- BUG-06 dropped Undo for delete, matching DR-08. Re-creating a deleted row gives it a new id and could lose the AI `source` markers, so it needs a restore endpoint first.

All 29 BUG-owned findings have a comment naming their BUG card.

### Routine (`trig_01VheUWTDMwu9TYrWntboCrY`): three-track rotation
- **Urgent first:** a BUG card with "URGENT" in its name or Severity Critical/High is done before the rotation.
- **Rotation:** the branch of the routine's last card PR sets the order it tries the tracks:
  - after `/bug-`: M → D → B
  - after `/dr-`: B → M → D
  - otherwise: D → B → M
- **Closing findings:** when a BUG card merges, the findings under its "Closes" list move to Done.
- The routine card (dvZifuoD) and "How we work" (h4Mm3VqB) describe the same rules.
- **The last routine run (2026-11-24 15:59 UTC) failed with "usage limit reached"**. Nothing ran. The next scheduled run is 2026-11-25 00:37 UTC.

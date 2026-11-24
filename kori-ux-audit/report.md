# Kori UX / QA audit: final report

- **Date:** 2026-11-24
- **App:** https://kori-655225497410.asia-southeast1.run.app
- **Test account:** test@gmail.com
- **Trello:** board "Kori" → list **🐞 Triage / Bugs**: 49 cards (36 issues + 13 design/modernisation/best-practice tickets)
- **Design concept** (private until you share it): https://claude.ai/artifact/HYiSuqv16Dn7MLt93mEyec. Local copy: `kori-ux-audit/design-concept/`
  - **Version 2:** every screen at desktop and phone size, in light and dark.
  - **Screens:** Login, Dashboard, first run, Transactions, Add transaction, Budgets, the four Settings pages, and 404.
  - **Logo:** three new directions (Coin K recommended). The cowrie mark was dropped at your request.
  - **Palette:** "Neel and Gada", indigo and marigold, with no green.
- **Running log:** `kori-ux-audit/findings.md`
- **Screenshots:** `kori-ux-audit/screens/`

**Method.** The Chrome extension wasn't available in this cloud session, so every flow was driven with the container's headless Chromium (Playwright, time zone Asia/Dhaka) at 375, 390, 768, 1280, 1366 and 1440px. Network and console output were captured on every run.

The design-critique, accessibility-review (WCAG 2.1 AA) and ux-copy checklists were applied per page, and the design-superpowers/frontend-design skills were used for the redesign tickets. Every issue card was reproduced at least twice before logging. No app code was changed.

## Site map and test status

| Route / surface | Main actions | Status |
|---|---|---|
| `/login` | Log in, validation, lockout, Enter submit, double-submit | **Tested** |
| `/` | Redirects to /dashboard | **Tested** |
| `/dashboard` | Month switcher, budget card, category breakdown, 6-month chart, recent transactions → edit, See all | **Tested** |
| `/transactions` | Export CSV, month switcher, search, filters sheet + chips, totals, day groups, row → edit | **Tested** |
| Add / Edit transaction dialog | Amount, type, category (+ More), split editor, date quick-pick, merchant, payment method, tags, note, save, delete + confirm | **Tested** |
| `/budgets` | Overall + category limits: set, edit, remove; past month read-only; future month carry-forward | **Tested** |
| `/settings` | Read-only profile, Manage links, Log out | **Tested** |
| `/settings/categories` | Expense/Income tabs, add, edit, reorder, archive + confirm, show archived, unarchive | **Tested** |
| `/settings/payment-methods` | Add (kind), edit, reorder, archive | **Tested** (edit/reorder/archive share the category component and were spot-checked) |
| `/settings/tags` | Tag → filtered transactions, rename/merge, delete + confirm | **Tested** |
| Session on all routes | Logged-out redirect with `next`, return after login, refresh, Back after logout, open-redirect guard | **Tested** |
| Global shell | Side nav, bottom nav + FAB, offline banner, error state with retry | **Tested** |
| PWA install card, iOS install sheet, update toast | Need a real device / installable context | **Not tested** |

## Cards created

### Issues (36)
| # | Title | Severity | Type | Link |
|---|---|---|---|---|
| 1 | [Medium] [Routing] Unknown URLs show a generic "Something went wrong" error with only a Reload button | Medium | UX | https://trello.com/c/VbiF8mCu |
| 2 | [Medium] [Transactions] Add transaction dialog discards everything typed on Esc or outside click, with no warning | Medium | UX | https://trello.com/c/Ma6z3Yfn |
| 3 | [Medium] [Transactions] Saving a transaction gives no success feedback (no toast or confirmation) | Medium | UX | https://trello.com/c/KWISRgGu |
| 4 | [Medium] [Transactions] Save button is hidden below the fold in the Add transaction dialog on laptop screens | Medium | UI | https://trello.com/c/si4kFUcH |
| 5 | [Medium] [Login] Field error messages aren't linked to their inputs (no aria-describedby) | Medium | Accessibility | https://trello.com/c/sr9qITy2 |
| 6 | [Low] [Login] Over-long email/password shows raw validator text | Low | Copy | https://trello.com/c/C2NEUSve |
| 7 | [Low] [Transactions] Too-large amount shows raw server text "Value error, Amount is too large" | Low | Copy | https://trello.com/c/hJsyKlt3 |
| 8 | [Low] [Login] No "Forgot password?" link or recovery guidance on the login page | Low | UX | https://trello.com/c/shfVcgPb |
| 9 | [Low] [Login] No show/hide password toggle | Low | UX | https://trello.com/c/KzXTSKs9 |
| 10 | [Medium] [Transactions] Search or filters with no matches show "No transactions in November. Add one" | Medium | UX | https://trello.com/c/akvTYrVH |
| 11 | [Medium] [Transactions] Day header total counts expenses only: a day with ৳50,000 income shows "৳0" | Medium | UX | https://trello.com/c/9bObm26U |
| 12 | [Medium] [Transactions] "Add one" from a past month's empty state saves the entry to today | Medium | Bug | https://trello.com/c/WZlzL0qv |
| 13 | [Medium] [Transactions] Focus is lost when the delete confirmation appears | Medium | Accessibility | https://trello.com/c/5BcZbPOU |
| 14 | [Low] [Transactions] After "Confirm delete" the dialog stays open 1–2.5 s with no progress indicator | Low | UX | https://trello.com/c/PewFRAmt |
| 15 | [Low] [Transactions] Totals and list flash to skeletons on every search | Low | Performance | https://trello.com/c/aWn28l4Y |
| 16 | [Low] [Transactions] Single-character searches are silently ignored | Low | UX | https://trello.com/c/1rBVkCLf |
| 17 | [Medium] [Global] Form sheets (Filters, Budget, Add category, Add payment method) open full-width from the bottom on desktop | Medium | UI | https://trello.com/c/sJwU4O5o |
| 18 | [Low] [Transactions] Tag field doesn't suggest existing tags | Low | UX | https://trello.com/c/ZJC15AHr |
| 19 | [Medium] [Dashboard] The month's total spent, income and net aren't shown anywhere on the dashboard | Medium | UX | https://trello.com/c/hIzqrdCy |
| 20 | [Medium] [Dashboard] "Last 6 months" chart has no values, axis or tooltips, and small expense bars are invisible | Medium | UI | https://trello.com/c/IY2YQgo6 |
| 21 | [Low] [Dashboard] Recent transactions rows and empty-state text are misaligned with the card heading | Low | UI | https://trello.com/c/DMnxPczY |
| 22 | [Low] [Budgets] "Remove budget" deletes immediately with no confirmation, feedback or undo | Low | UX | https://trello.com/c/6nCzKgv3 |
| 23 | [Low] [Budgets] Zero or negative limit shows the generic "Enter an amount in taka…" | Low | Copy | https://trello.com/c/jMUGveTv |
| 24 | [Low] [Budgets] "Overall" is shown twice in the Overall card | Low | UI | https://trello.com/c/yTinCNEe |
| 25 | [Medium] [Settings] Long category or payment-method names fail with a generic "Unprocessable Content" toast | Medium | Bug | https://trello.com/c/rQCXvk7N |
| 26 | [Low] [Transactions] Tag chips show the typed text but the tag is saved normalised | Low | UX | https://trello.com/c/YHZTqceM |
| 27 | [Medium] [Accessibility] Every page has the same document title "Kori" | Medium | Accessibility | https://trello.com/c/Z6JpcC5e |
| 28 | [Medium] [Accessibility] Income amounts in green (#059669) fail text contrast at 3.77:1 | Medium | Accessibility | https://trello.com/c/vDKK9R6H |
| 29 | [Medium] [Accessibility] Month picker has invisible keyboard focus and takes three Tab stops | Medium | Accessibility | https://trello.com/c/LcnWdE8e |
| 30 | [Low] [Accessibility] Heading levels skip from H1 to H3 on Dashboard and Budgets | Low | Accessibility | https://trello.com/c/wdAcXdeP |
| 31 | [Low] [Accessibility] Bangla brand text "কড়ি" isn't marked lang="bn" | Low | Accessibility | https://trello.com/c/yyybM8Tf |
| 32 | [Low] [Accessibility] No "Skip to main content" link | Low | Accessibility | https://trello.com/c/Ad6KB5xx |
| 33 | [Medium] [Settings] Settings subpages have no Back button, a dead end in the installed PWA | Medium | UX | https://trello.com/c/UMBnOcqJ |
| 34 | [Medium] [Settings] Category names are truncated on mobile because four action buttons fill each row | Medium | UI | https://trello.com/c/PtcVc4gz |
| 35 | [Low] [Dashboard] Page scrolls sideways 22px at 768px tablet width | Low | Bug | https://trello.com/c/oVYDSBW4 |
| 36 | [Low] [Accessibility] Small touch targets on mobile: 16px dialog close, 20px tag/filter remove, 13px checkbox | Low | Accessibility | https://trello.com/c/mrxuDHHz |

Comments with extra evidence were added to #3, #4, #7, #17 and #19 instead of creating duplicates.

### Design improvement, modernization and best-practice tickets (13)
| # | Title | Severity | Type | Link |
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
| 46 | [Low] [PWA] Add an "Add expense" shortcut, install screenshots and an app id to the web manifest | Low | Modernization | https://trello.com/c/9KOtT5fe |
| 47 | [Low] [Global] Respect prefers-reduced-motion and define a small motion spec | Low | Best practice | https://trello.com/c/dz5GrAVE |
| 48 | [Medium] [Quality] Add automated accessibility and layout checks to the Playwright e2e suite | Medium | Best practice | https://trello.com/c/t1HmfBMa |
| 49 | [Low] [Transactions] Show category icons and colours in transaction rows for faster scanning | Low | Design improvement | https://trello.com/c/AEuCn7N2 |

## Counts

**By severity (all 49 cards)**
| Severity | Issues | Design tickets | Total |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 0 | 0 | 0 |
| Medium | 18 | 8 | 26 |
| Low | 18 | 5 | 23 |

**By type (primary type per card)**
| Type | Count |
|---|---|
| UX | 14 |
| Accessibility | 9 |
| UI | 6 |
| Copy | 3 |
| Bug | 3 |
| Performance | 1 |
| Design improvement | 7 |
| Modernization | 3 |
| Best practice | 3 |

No Critical or High issues were found. Core flows (log in, add/edit/delete a transaction, budgets, settings CRUD, CSV export, session security) all work, and data persisted correctly across refreshes. The issues are about feedback, clarity, consistency and accessibility.

## What already works well
- **Auth and session:** generic login error (no email enumeration), double-submit guard, lockout with a clear "Try again in 15 minutes", `next` redirect that keeps the query string, an open-redirect guard, and Back after logout shows nothing protected.
- **Money input:** accepts "৳ 1,250.5", "1,250.50" and Bangla digits ১২৫০, and rejects 0, negatives, 3 decimals and `1e3`. Lakh grouping (৳12,50,000) in display.
- **Split editor:** pre-fills line 1, "Fill remaining", and live "Remaining / Over by".
- **Destructive-action copy:** archive and tag-delete dialogs explain consequences well ("Nothing is deleted", "It will be removed from 1 transaction").
- **Offline handling:** a clear banner, and saves are blocked with the same message.
- **Other:** CSV export with BOM and correct quoting; past-month budgets are read-only with a clear explanation; HTML in user text is escaped.

## Top 5 UX improvements to prioritise
1. **Make the dashboard answer "how much is left this month?"** Lead with a "Left to spend" hero, a Spent / Income / Net strip, a readable category bar and a trend chart with values. This fixes #19, #20 and #21 together (ticket #41, concept page).
2. **Rebuild quick entry around the phone.** Amount first, an icon category grid, optional fields as chips, a sticky "Save ৳250 expense" button and a discard guard. Logging an expense is the app's core loop; today Save is off-screen on every device and a stray tap loses the entry (#2, #4, #12 → ticket #42).
3. **One feedback system.** A success toast with Undo for every create, update and delete; errors mapped to fields instead of raw "Unprocessable Content" or "Value error" text; distinct empty states for an empty month, no search matches and active filters (#3, #7, #10, #22, #25).
4. **A small design system with one responsive sheet pattern.** DESIGN.md plus `FormSheet`, `Field`, `IconButton`, `Money`, `EmptyState` and `MonthPicker`. Most UI and accessibility cards are the same component solved differently in different places (#17, #5, #13, #29, #34, #36 → tickets #40, #38, #39).
5. **Accessibility baseline in CI.** Per-page titles, AA-contrast semantic colours, a keyboard-visible month control, skip link, heading order and `lang="bn"`, then lock them in with axe + overflow checks in Playwright so regressions fail the build (#27–#32, #35 → ticket #48).

## Not tested, and why
- **Chrome extension:** not available in this cloud session, so the audit used headless Chromium. Browser password-manager **autofill** couldn't be exercised; only the `autocomplete="username/current-password"` attributes were verified.
- **Real assistive technology** (NVDA, VoiceOver, TalkBack) wasn't available. A11y findings come from ARIA/DOM inspection, keyboard runs and a computed contrast scan.
- **Real devices:** the iOS standalone PWA, Android install prompt, iOS install sheet and the "update available" toast need an installable context. Mobile was emulated.
- **Lockout on the real account** wasn't triggered, since it would lock test@gmail.com for 15 minutes. It was verified with fake `qa-throttle…@example.invalid` emails.
- **Forgot password / signup:** neither exists in the app (both routes 404). Logged as a UX gap.
- **Session expiry** (30-day sliding cookie) and multi-tab logout sync: time-bound, not tested.
- **Account changes** (email, password, delete account): not offered in the UI, and out of bounds per the brief.

## QA test data to clean up
All on test@gmail.com:
- **Transactions:**
  - "QA-Café ☕ <b>bold</b> & "quotes"": ৳250.50, Food & Dining, bKash, 2026-11-23, tag `qa-tag-renamed`, note "QA note 🧪 with emoji"
  - "QA-From settings": ৳130, Transport, 2026-11-24, tags `qa-mixed-case`, `qa-second-tag`
  - "QA-Split": ৳500 split Groceries & Bazar ৳300 / Shopping ৳200, 2026-11-24
  - "QA-Salary": ৳50,000 income, Salary, 2026-11-24
  - "QA-Delete me", "QA-Delete A" and "QA-Delete B" were created and then deleted; nothing remains.
- **Tags:** `qa-tag-renamed`, `qa-mixed-case`, `qa-second-tag`. Delete them in Settings → Tags.
- **Category:** "QA-Pets" (expense, archived). Visible under Settings → Categories → Show archived.
- **Payment method:** "QA-City Bank Card" (kind Cash).
- **Budgets from November 2026 onward:** Overall ৳20,000 and Groceries & Bazar ৳200. Remove both on /budgets. Food & Dining and Transport budgets were already removed.
- **Server-side login-attempt rows** for fake emails: qa-notanemail, qa-unknown1/2@example.invalid, qa-throttle1/2@example.invalid, qa-bbb…@x.io. They're harmless and expire from the 15-minute throttle window.

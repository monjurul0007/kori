# PWA capabilities on iOS and Android (spike S6)

**Status:** research done 2026-11-22. **Real-device checks are still open** (see the end).
**Card:** [S6](https://trello.com/c/iDlmwJH5). **Feeds:** M2-12 (PWA polish), and the Backlog cards
"Offline entry queue" and "Budget alert notifications".

Kori is a PWA instead of a native app (ADR-0002). This page records what an installed PWA can
reliably do on **iOS Safari** (home-screen web apps) and **Android Chrome**, and what that means
for M2 scope.

> **How this was built.** Desktop-side desk research only: WebKit and MDN documentation, the
> caniuse tables, WebKit bug reports, Apple developer-forum threads and third-party guides. No
> physical iPhone or Android phone was available to the agent that wrote this. Rows marked
> **(verify)** rest on third-party or older sources and need a check on a real device.

## Capability matrix

| Capability | iOS Safari / home-screen app | Android Chrome | Notes |
|---|---|---|---|
| Install flow | **Manual only.** Share → Add to Home Screen. No `beforeinstallprompt` (unsupported through current Safari versions per caniuse). Since iOS 26, every site added opens as a web app by default ("Open as Web App" switch is on). | **Prompted.** `beforeinstallprompt` fires when installable; the app can offer its own "Install" button. Also available from the browser menu. | Feature-detect the event; fall back to instructions. |
| Standalone display | Yes (`display: standalone`, `navigator.standalone`). | Yes (`display-mode: standalone`). | Both signals are needed to hide install UI. |
| Update detection | Service worker updates work; the new worker waits until all clients close. | Same. | The `prompt` flow (toast and reload) works on both. |
| Offline app shell | Yes. Workbox precache works in home-screen apps. | Yes. | Matches M1-15's setup. |
| Offline entry queue (IndexedDB) | Works while the app is open. Writes can be stored in IndexedDB and replayed when the app is next opened. | Same, and can also replay in the background. | See "Background Sync" below. |
| Background Sync API | **Not supported (verify).** Sources agree it is unavailable or useless because iOS suspends the PWA almost at once. | Supported (Chromium). Fires when connectivity returns, even if the app is closed. | Don't depend on it. Sync on open instead. |
| Periodic Background Sync | Not supported. | Chromium only, and only for installed apps with enough engagement. | Out of scope. |
| Web Push | **Home-screen apps only**, iOS 16.4 and later. A page in a Safari tab can't subscribe. The user must grant permission after a tap. Every push must show a visible notification (no silent push). | Supported in the browser and installed apps. | Needs a push service: VAPID with the free Web Push protocol, no paid vendor required. |
| Declarative Web Push | iOS 18.4 and later (verify). | n/a | Lets Safari show the notification without running the service worker. |
| Storage quota and eviction | Safari's 7-day cap on script-writable storage applies to **browser tabs**. Home-screen apps count their own days of use. Home-screen web apps get the same quota as in the browser (Safari 17+). `navigator.storage.persist()` is granted on heuristics such as being a home-screen app. | Generous quota. `persist()` is granted for installed or engaged sites. | Treat local storage as a cache, never as the only copy (verify the eviction behavior on a device). |
| Cookies (session) | Server-set first-party cookies aren't capped by the 7-day rule. | Normal. | Kori's session cookie is unaffected. |

## Options evaluated

1. **Workbox app shell only (today).** Works on both platforms. Keep it as is.
2. **IndexedDB queue plus Background Sync.** Nice on Android, unusable on iOS. Because Kori is used
   mostly on a phone and the owner's platform may be iOS, a design that needs Background Sync would
   be inconsistent.
3. **IndexedDB queue plus sync on open (and on `online`).** Works on both, with no platform-specific
   code. This is the only offline-write design worth building.
4. **Web Push.** Works on both, but on iOS only after install. Needs a VAPID key pair, a push
   subscription table and a sender. All free.

## Recommendations for M2

- **Do in M2-12** (all verified as supported on both platforms, except where noted):
  - Update toast with `registerType: "prompt"`. Check for updates on load, on a 60-minute timer
    and when the app becomes visible again.
  - Install prompt: capture `beforeinstallprompt` on Chromium and Android. On iOS show the
    "Share → Add to Home Screen" instructions. Hide it in standalone mode.
  - Offline shell: banner from `navigator.onLine` and the `online` and `offline` events. Add
    `/internal/` to `navigateFallbackDenylist`, as the card says.
  - On iOS 26 the instructions should mention that "Open as Web App" must stay on.
- **Don't build in M2:** the offline queue, push and background sync, as the M2 decision says.

### Whether to promote the Backlog cards

- **Offline entry queue: promote to a later milestone, not M2.** It is feasible on both
  platforms *if* it syncs on open instead of using Background Sync. It also needs the idempotency
  key from the spike constraints: the client generates a UUID per entry and the API de-duplicates
  on it. That is an API change (a unique `(user_id, client_id)` key) and deserves its own card
  before the queue. Suggested order: idempotency key on `POST /transactions`, then the queue.
- **Budget alert notifications: keep in Backlog for now.** Push works on iOS only for an installed
  app, needs permission UX, a VAPID key (a secret), a subscription table and a sender that runs on
  the background-job mechanism from ADR-0006 (S3, not yet written). Revisit after that ADR and
  after the owner confirms which phone they use day to day. An in-app budget alert (M2's budget
  UI) covers the same need without push.

## Constraints from the card

- **No native app, $0:** all options above are free. Web Push uses the open protocol.
- **No duplicate transactions:** any offline write must carry a client-generated idempotency key.
  This is not yet supported by the API.

## Still needs the owner (real devices)

I couldn't test on hardware. These checks should be done once M2-12 is merged, with screenshots in
that PR:

- [ ] iPhone: Add to Home Screen, launch standalone, then airplane mode opens the offline shell.
- [ ] iPhone: after a second deploy, the update toast appears (and the Reload button works).
- [ ] Android: the install prompt appears and installing works.
- [ ] Confirm which phone is used daily, since that decides whether push is worth building.

## Sources

- [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados)
- [WebKit: Updates to Storage Policy](https://webkit.org/?p=14403)
- [firt.dev: iOS PWA compatibility](https://firt.dev/notes/pwa-ios/)
- [caniuse: BeforeInstallPromptEvent](https://caniuse.com/mdn-api_beforeinstallpromptevent)
- [Apple developer forums: Safari iOS PWA data persistence beyond 7 days](https://developer.apple.com/forums/thread/710157)
- [Apple developer forums: PWA background sync on iOS](https://developer.apple.com/forums/thread/694805)
- [MDN: Storage quotas and eviction criteria](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

# Vemobile UI Overhaul Plan

## Root Cause
Discord's desktop web app (960px+ design) on phone screens (360-414px). Current approach uses DOM tagging + CSS view toggling — too fragile.

---

## Sprint 1: Critical Fixes

| # | Issue | File | Fix |
|---|-------|------|-----|
| 1.1 | DOM tagging scans all 50K+ elements | `vemobile-prelude.js:174-271` | Replace `querySelectorAll("*")` with targeted selectors at known depth levels |
| 1.2 | URL hash detection always matches `/channels/` | `vemobile-prelude.js:282-291` | Only go to chat when hash has a channel/DM snowflake ID (17+ digit number) |
| 1.3 | Keyboard overlap — no CSS for `.vemobile-keyboard-open` | `vemobile-prelude.js:407-412` | Add CSS `.vemobile-keyboard-open .vemobile-nav { display: none }` |
| 1.4 | NoTrack wildcard `*` not actually matching | `vemobile-patches.js:55` | Replace `*` with regex matching |
| 1.5 | Navigation delegate blocks same-origin sub-navigation | `webview_shell.dart:61-79` | Allow all same-origin (discord.com), only block cross-origin |
| 1.6 | `defineProperty` loses patches on VencordNative reassign | `vemobile-prelude.js:42-61` | Use Proxy instead of defineProperty |
| 1.7 | Members toggle uses inline styles | `vemobile-prelude.js:356-367` | Use `.vemobile-show-members` body class |

## Sprint 2: Navigation & UX

| # | Issue | File | Fix |
|---|-------|------|-----|
| 2.1 | No Vencord Flux event integration | `vemobile-patches.js` | Subscribe to Discord's Flux events for real navigation detection |
| 2.2 | No transition animation between views | `vemobile-prelude.js` | Add CSS transitions for view switching |
| 2.3 | Settings button inject is fragile | `vemobile-prelude.js:368-375` | Open Vencord's own settings via Vencord API |
| 2.4 | Call fallback only on alert, not deep detection | `vemobile-prelude.js:34-40` | Override `enumerateDevices`, intercept RTC module |
| 2.5 | Member list toggle should use CSS class | `vemobile-prelude.js:356-367` | Complete the class-based approach |

## Sprint 3: Performance & Polish

| # | Issue | File | Fix |
|---|-------|------|-----|
| 3.1 | `setInterval` for hash polling wastes CPU | `vemobile-prelude.js:282` | Replace with `hashchange` event + MutationObserver |
| 3.2 | WakeLock polls every 5s regardless of state | `vemobile-patches.js:26-43` | Use Discord's Flux call state instead of DOM polling |
| 3.3 | No loading indicator on view transitions | `vemobile-prelude.js` | Add transition loading overlay |
| 3.4 | CSS injected after page renders (flash) | `webview_shell.dart:99-127` | Inject critical CSS earlier via page load events |
| 3.5 | User-agent may block features | `webview_shell.dart:89-93` | Test desktop Chrome UA on Android |

## Sprint 4: Release

| # | Issue | File | Fix |
|---|-------|------|-----|
| 4.1 | Write sprint summaries | — | Document each sprint |
| 4.2 | Rebuild APK and test | — | `flutter build apk --debug` |
| 4.3 | Create release | — | Tag v0.2.0-beta, create GitHub release |
| 4.4 | Update README with new feature list | `README.md` | Document overlay changes |

---

## Status

| Sprint | Status |
|--------|--------|
| Sprint 1: Critical Fixes | ✅ completed |
| Sprint 2: Navigation & UX | ✅ completed |
| Sprint 3: Performance | ⬜ pending |
| Sprint 4: Release | ⬜ pending |

---

## Sprint 2 Summary — Completed

### 2.1 Flux Navigation (FluxNav plugin)
- **Before:** Only URL hash polling (every 300ms) + click interception
- **After:** Subscribes to Discord's Flux dispatcher (`findByProps("dispatch", "subscribe")`) for:
  - `CHANNEL_SELECT` — instant view switch when clicking a channel. channelId present → chat view, null → home view.
  - `VOICE_CHANNEL_SELECT` — triggers native wake lock immediately
  - `RTC_CONNECTION_STATE` — releases wake lock on disconnect
- Waits for `Vencord.Webpack.onceReady` before subscribing. Falls back to 2s delay if not ready.

### 2.2 View Transition Animations
- **Before:** Instant view switch, no visual feedback
- **After:** CSS `transition: opacity 0.15s, transform 0.15s` on data-vemobile-* elements
  - Chat slides in from right (`@keyframes vemobile-slide-in`)
  - Sidebar fades out with slight left shift
  - Smooth opacity cross-fade between views

### 2.3 Settings Button (VIA Vencord API)
- **Before:** DOM click on `aria-label="User Settings"` — fragile, often missed
- **After:** First tries `Vencord.Api.Settings.open()` (Vencord's own settings panel). Falls back to DOM click. Patched via `setInterval` that hooks the nav button when rendered.

### 2.4 Deep Call Detection (CallDetect plugin)
- **Before:** Only overrode `window.alert`, `RTCPeerConnection`, and `getUserMedia`
- **After:** Also intercepts:
  - `navigator.mediaDevices.enumerateDevices` (already in prelude)
  - `console.warn` and `console.error` for RTC-related messages
  - Injects a persistent amber banner into voice channel headers: "Voice/video calls may not work in this WebView. Open native Discord app."
  - Banner is clickable — triggers the native call fallback dialog

### 2.5 Class-Based Members (completed in Sprint 1.7)
- Already done: `.vemobile-show-members` body class handles member list visibility via CSS rules

---

## Sprint 1 Summary — Completed

### 1.1 DOM Tagging (targeted selectors)
- **Before:** `querySelectorAll("*")` on 50K+ elements with `getComputedStyle` each = slow + fragile
- **After:** Walk up from `[class*=messagesWrapper]` to find the chat column, then check its siblings. Maximum 8 `parentElement` hops + 1 `querySelector` call. `~100x` faster.
- **Fallback:** None needed — if chat content exists, the walk-up finds the container.

### 1.2 URL Hash Detection (snowflake pattern)
- **Before:** `hash.indexOf("/channels/")` matched even home routes like `#/channels/@me`
- **After:** `hash.match(/channels\/(?:@me\/)?(\d{17,19})\b/)` — only matches when a channel snowflake ID (17-19 digit number) is in the URL. Home screen no longer falsely shows chat.

### 1.3 Keyboard CSS
- **Before:** `.vemobile-keyboard-open` class toggled on body but no CSS rule used it
- **After:** Added `.vemobile-keyboard-open .vemobile-nav { display: none !important }` — nav bar hides when keyboard is visible

### 1.4 NoTrack Wildcard Fix
- **Before:** `"discord.com/api/v*/science"` checked with `indexOf` — literal `*` never matched
- **After:** Regex patterns: `/\/api\/v\d+\/science/`, `/\/api\/v\d+\/track/`, `/sentry\.io/` — actually blocks tracking

### 1.5 Navigation Delegate (same-origin)
- **Before:** Blocked all URLs not containing exact Discord substrings — broke auth flows, Nitro pages, CAPTCHA
- **After:** `Uri.tryParse` + check `.host`. All same-origin (discord.com) navigation allowed. Only cross-origin blocked.

### 1.6 VencordNative Proxy
- **Before:** `Object.defineProperty` hook intercepted initial assignment but lost patches on reassignment
- **After:** Proxy wraps the VencordNative object. Intercepts all reads/writes including `openExternal` patching and `mobile` API injection. Survives reassignments.

### 1.7 Members Toggle (CSS class)
- **Before:** `ml.style.display = "none"/"flex"` inline styles overrode CSS rules, created inconsistent state
- **After:** Body class `.vemobile-show-members` controls visibility via CSS rules. Clean toggle in/out.


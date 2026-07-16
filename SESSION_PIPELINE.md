# Vemobile Session Pipeline — Complete Project Documentation

> **Purpose:** This document is a full project dump for new AI sessions. It contains everything needed to understand the codebase, pick up where the last session left off, and continue building without rediscovering anything.

**Last updated:** 2026-07-16  
**Current version:** v0.4.0-alpha  
**Active branch:** `master`

---

## 1. What This Project Is

**Vemobile** is a mobile Discord mod client. It wraps the real `discord.com/app` (mobile web) in a Flutter WebView, injects the Vencord mod bundle (155+ plugins, themes, privacy tweaks), and adds mobile-specific UX (bottom nav, floating back button, keyboard handling, safe areas).

Think of it as "Vesktop for mobile" — a custom shell that loads Discord's web app with Vencord pre-installed.

### Core Architecture

```
┌──────────────────────────────────────────────────────┐
│              Flutter Shell (vemobile/)               │
│                                                      │
│  main.dart → WebViewShell (webview_shell.dart)       │
│            → loads https://discord.com/app           │
│            → injects assets/vemobile.css (early)     │
│            → injects assets/vemobile.js (on load)    │
│                                                      │
│  JsBridge (js_bridge.dart)                           │
│            → VemobileBridge JS channel               │
│            → wakeLock, openUrl, goBack, call alerts  │
│                                                      │
│  Native Features (platform channels):                │
│            → WakeLockService (keep screen on)        │
│            → NotificationService (stub for push)     │
│            → StorageService (SharedPreferences)      │
└──────────────────────┬───────────────────────────────┘
                       │ postMessage("VemobileBridge")
                       ▼
┌──────────────────────────────────────────────────────┐
│           JS Mod Bundle (vencord-mobile-bundle/)      │
│                                                      │
│  vemobile.js = combined IIFE from esbuild            │
│    ├── __VEMOBILE__ (prelude API & bridge)           │
│    ├── Vencord core (patcher, plugin loader, UI)     │
│    ├── 155+ plugins (from Vencord ecosystem)         │
│    └── Mobile patches: FluxNav, WakeLock, NoTrack,   │
│        MobileUpdater, CallDetect                     │
│                                                      │
│  Separate dist artifacts (for debugging):            │
│    ├── dist/vemobile-prelude.js                      │
│    ├── dist/vemobile-patches.js                      │
│    ├── dist/vemobile-base.js (built Vencord)         │
│    └── dist/vemobile-base.css (built Vencord CSS)    │
└──────────────────────────────────────────────────────┘
```

---

## 2. File Map — What Each File Does

### Flutter Shell (`vemobile/`)

| File | Purpose |
|------|---------|
| `lib/main.dart` | App entry. Sets orientations (portrait+landscape), transparent status bar, launches WebViewShell. |
| `lib/webview_shell.dart` | **Core file.** Creates WebView, configures UA (Android Chrome mobile), navigation delegate (allow Discord, auth providers; block cross-origin), injects CSS early + JS bundle on page load. Back navigation via PopScope. |
| `lib/js_bridge.dart` | Handles messages from JS `VemobileBridge` channel. Routes `bridge` (wakeLock, deviceInfo, FCM), `openUrl`, `callUnsupported`, `goBack`. Uses JS callbacks for async RPC. |
| `lib/storage_service.dart` | Wrapper around SharedPreferences for persistent key-value storage. |
| `lib/wakelock_service.dart` | Platform channel for Android `FLAG_KEEP_SCREEN_ON`. iOS no-op. |
| `lib/notification_service.dart` | Stub for FCM/APNs push relay. Not implemented yet. |
| `assets/vemobile.js` | **Built mod bundle.** Copy of `vencord-mobile-bundle/dist/vemobile.js`. Injected into WebView on page load. |
| `assets/vemobile.css` | **Built Vencord CSS.** Copy of `vencord-mobile-bundle/dist/vemobile-base.css`. Injected early (before DOMContentLoaded) to avoid flash. |
| `pubspec.yaml` | Flutter dependencies: webview_flutter 4.8.0, shared_preferences, path_provider, url_launcher, package_info_plus. Version: 0.4.0-alpha+1. |

### JS Mod Bundle (`vencord-mobile-bundle/`)

| File | Purpose |
|------|---------|
| `dist/vemobile.js` | Full IIFE bundle built by esbuild. This is what gets loaded into the WebView. Contains prelude + Vencord core + all plugins + mobile patches. |
| `dist/vemobile-prelude.js` | Pre-injection setup: `__VEMOBILE__` API object, viewport meta, WebRTC stubs, VencordNative proxy, floating back button, bottom nav, keyboard detection, call alert interception. Runs before Vencord loads. |
| `dist/vemobile-patches.js` | Mobile-specific plugins: FluxNav (Flux events for wake lock), WakeLock (screen-on during calls), NoTrack (blocks /science, /track, sentry), MobileUpdater (checks GitHub releases), CallDetect (console interception + amber banner). |
| `dist/vemobile-base.js` | Built Vencord core — webpack patcher, plugin loader, settings UI, all 155+ desktop plugins. |
| `dist/vemobile-base.css` | Built Vencord CSS — all `.vc-*` utility classes for plugin UIs. |
| `scripts/build/vemobile.mjs` | esbuild build config. Resolves `@api`, `@webpack`, etc from `/tmp/vencord-analysis/src`. Generates plugins index. Builds IIFE bundle targeting ES2020. |
| `src-mobile/vemobile.ts` | Mobile entry point for esbuild. Imports prelude, then Vencord core, then patches. |
| `src-mobile/plugins-index.ts` | Auto-generated plugin registry. Imports all plugins from Vencord + mobile-specific ones. |

---

## 3. How Mod Injection Works (End to End)

1. Flutter app launches → `main.dart` → `WebViewShell`
2. WebView loads `https://discord.com/app` with mobile Chrome UA
3. **CSS injected early** (`onPageStarted` JS with DOMContentLoaded listener) — prevents flash of unstyled desktop layout
4. **JS bundle injected** on `onPageFinished`:
   - Prelude sets up `window.__VEMOBILE__`, viewport, WebRTC stubs, proxy for `VencordNative`
   - Vencord core loads (webpack patching, plugin system)
   - Mobile patches register: FluxNav, WakeLock, NoTrack, MobileUpdater, CallDetect
5. **JS → Flutter bridge**: JS calls `VemobileBridge.postMessage({type, data})` for wakeLock, URL opening, back navigation, call alerts
6. **Flutter → JS**: `_updateJsBackState()` calls JS to show/hide the floating back button based on WebView history

### Key Design Decisions

- **Mobile UA (Android Chrome), not desktop UA.** Discord's mobile web app is fully responsive and handles layout natively. Desktop UA would load the 960px+ layout and require fragile DOM tagging to fix. The mobile web app just works.
- **No DOM tagging.** Earlier versions used `querySelectorAll("*")` on 50K+ elements to tag views — removed. Discord's mobile web handles views correctly on its own.
- **Proxy for VencordNative.** `Object.defineProperty` was unreliable because Vencord reassigns the object. A Proxy intercepts all reads/writes including re-assignments.
- **FluxNav over hash polling.** Subscribe to Discord's Flux dispatcher for `CHANNEL_SELECT`, `VOICE_CHANNEL_SELECT`, etc. Reacts instantly instead of 300ms polling.
- **PopScope + WebView.goBack() + JS fallback.** Back button is handled by: Flutter's PopScope → WebView `canGoBack()` → `goBack()` → JS `history.back()` fallback.

---

## 4. What Was Fixed in This Session (v0.4.0-alpha)

### Back Navigation (Complete)

**Problem:** Android back button exited the app instead of going back in WebView history. Discord's SPA didn't register its navigations in browser history.

**Solution:**
- `PopScope` with `onPopInvokedWithResult` — intercepts system back button
- `_onWillPop()` → `_controller.canGoBack()` → `_controller.goBack()` — uses WebView history
- If no WebView history: calls `SystemNavigator.pop()` to minimize app (don't exit)
- **Floating JS back button** (CSS class `vemobile-back-btn`):
  - Positioned top-left, below safe area
  - Shows when navigating into sub-pages (detected via hash analysis: snowflakes, `/settings`, `/store`, etc.)
  - Overrides `history.pushState` / `replaceState` to track SPA navigation
  - Falls back to `location.hash = "#/channels/@me"` when no history
- **Bottom nav "Back" button** also works the same way
- **Keyboard hide**: `.vemobile-keyboard-open` hides both nav and back button

### Safe Areas (Complete)

**Flutter side:** `SafeArea(top: true, bottom: false)` — system status bar respected, bottom handled by CSS.

**CSS side:**
```css
#app-mount {
  padding-top: env(safe-area-inset-top, 0);
  padding-bottom: calc(48px + env(safe-area-inset-bottom, 0));
}
.vemobile-nav {
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.vemobile-back-btn {
  top: calc(env(safe-area-inset-top, 0) + 4px);
}
```

### Bottom Nav (Complete)

4 buttons: Home (DM list), Back, Refresh, Settings. Home highlighted initially. Settings tries Vencord's own settings API first, falls back to Discord DOM click.

### Other Improvements
- VencordNative proxy properly injects `mobile.getPlatform()`, `requestWakeLock()`, `releaseWakeLock()`
- VencordNative `openExternal` wired to postMessage → native URL launching
- Version bumped: 0.3.0 → 0.4.0

---

## 5. Current Known Issues

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| 1 | **Voice/video calls don't work** | High | WebRTC in mobile WebViews is unreliable. `getUserMedia` stubbed. CallDetect shows amber banner. Dialog offers to open native Discord app. WebRTC stubs prevent crashes. |
| 2 | **Push notifications not implemented** | High | `NotificationService` is a stub. No FCM/APNs wiring. WebView apps can't receive Discord's native push. Need relay server or Discord API polling. |
| 3 | **iOS untested** | Medium | Code uses `webview_flutter` which supports iOS WKWebView, but JS injection timing, safe areas, and navigation delegate may differ. No iOS build run yet. |
| 4 | **MobileUpdater doesn't show UI** | Low | It checks GitHub releases and sends `updateAvailable` to native, but no Flutter-side dialog or download flow is implemented. |
| 5 | **Settings page might overlap safe areas on some devices** | Low | CSS uses `env(safe-area-inset-*)` which works on most modern devices but may need testing on older Android. |
| 6 | **Login flows with external providers** | Low | Google, Apple, hCaptcha are allowed in navigation delegate. Tested manually but could break if Discord changes auth flow. |
| 7 | **No offline/caching** | Low | Each app restart loads Discord fresh from web. No Service Worker or offline support. |

---

## 6. Architecture Decisions Registry

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| **Mobile Chrome UA** | Discord's mobile web app is responsive and handles layout natively. No DOM tagging needed. | Can't use desktop-only features. Some power-user features may be missing from mobile web. |
| **No DOM tagging** | Previous approach with `querySelectorAll("*")` was fragile and slow (50K+ elements). Discord's mobile web handles view toggling on its own. | Can't customize Discord's native mobile UI beyond what CSS can do. |
| **Proxy for VencordNative** | `Object.defineProperty` lost patches on reassign. Proxy intercepts all operations including re-assignments. | Slightly more complex, but zero maintenance. |
| **PopScope (not WillPopScope)** | `WillPopScope` is deprecated in Flutter 3.44+. `PopScope` with `canPop: false` is the correct API. | None — this is the Flutter-recommended approach. |
| **JS floating back button** | WebView history doesn't always track SPA navigations correctly. A JS button that detects sub-page navigation and falls back to Discord hash navigation is more reliable. | Duplicates some native behavior, but much more reliable. |
| **Flux events over polling** | Subscribing to Discord's internal Flux dispatcher gives instant react to navigation and call state changes, vs 300ms-5s polling intervals. | Depends on Vencord's webpack being ready. Falls back to polling if unavailable. |
| **CSS injected before DOMContentLoaded** | Injecting CSS at `onPageStarted` with a `DOMContentLoaded` listener prevents flash of unstyled desktop layout. | Must have CSS ready at build time. Uses escaped string injection. |
| **Flutter for shell** | Single codebase for Android + iOS. Mature WebView plugin with JS injection. Growing ecosystem. | Heavier than Capacitor (includes Dart runtime). Worth it for deployment simplicity. |
| **GPL-3.0 license** | Matches Vencord's license since this is a derivative work. | Restrictive for commercial use (not relevant). |

---

## 7. Build Commands

### JS Bundle

```bash
cd vencord-mobile-bundle
# Install dependencies (if not done)
pnpm install

# Build the full bundle → dist/vemobile.js + dist/vemobile-base.css
pnpm build

# Watch mode for development
pnpm watch
```

### Copy to Flutter Assets

```bash
cp vencord-mobile-bundle/dist/vemobile.js vemobile/assets/vemobile.js
cp vencord-mobile-bundle/dist/vemobile-base.css vemobile/assets/vemobile.css
```

### Flutter APK

```bash
cd vemobile
flutter pub get
flutter build apk --debug
```

**Output:** `vemobile/build/app/outputs/flutter-apk/app-debug.apk` (~150 MB debug, ~170 KB JS bundle)

### CI (GitHub Actions)

CI triggers on push to `master`/`main` and on tags `v*`. It:
1. Builds debug APK (`flutter build apk --debug`)
2. Builds release APK (`flutter build apk --release`)
3. Uploads both as artifacts
4. If triggered by a tag → creates a GitHub Release with APK attachments

**CI file:** `.github/workflows/build.yml`

---

## 8. Version History

| Tag | Date | Key Changes |
|-----|------|-------------|
| `v0.4.0-alpha` | Jul 2026 | Back navigation (PopScope + WebView history + JS back button), safe areas (Flutter + CSS), mobile Chrome UA, no DOM tagging, VencordNative proxy, 0.4.0 version bump |
| `v0.3.0-alpha` | Jul 2026 | Mobile UA switch to mobile Chrome, removed DOM tagging, FluxNav event-driven navigation, CallDetect with console interception + amber banner, CSS transitions, optimized patch loading |
| `v0.2.0-beta` | Jul 2026 | DOM tagging 100x faster, snowflake hash detection, Proxy VencordNative, keyboard CSS, NoTrack regex fix, Flux events, wake lock, loading overlay, CSS-early injection, hashchange event (no polling) |
| `v0.1.2` | Jul 2026 | Early releases with DOM tagging, desktop UA, basic injection |
| `v0.1.1` | Jul 2026 | — cleaned up |
| `v0.1.0` | Jul 2026 | Initial WebView shell, basic Vencord injection |

---

## 9. Next Steps (Priority Order)

### P0 — Critical (next session should start here)

1. **Test on real device.** Build APK, install, test:
   - Login flow (with 2FA, Google login)
   - Channel navigation (back button behavior)
   - DM list, message sending, image upload
   - Bottom nav responsiveness
   - Keyboard appearance/hiding
   - Safe areas on notched devices

2. **Fix any login/auth issues.** Navigation delegate allows Discord + auth providers but may need adjustment for new OAuth flows.

### P1 — Important

3. **Push notification relay.** Design choices:
   - **Option A:** Relay server that subscribes to Discord gateway and pushes via FCM/APNs (most complex, best UX)
   - **Option B:** Periodic API polling with local notifications (simpler, battery impact)
   - **Option C:** Extract Discord push token from WebView and forward to relay (gray area)

4. **iOS build and test.** Run `flutter build ios --no-codesign --debug`. Test WKWebView JS injection timing, safe areas, navigation delegate behavior. May need different CSS/adjustments.

5. **Voice/video call investigation.** Test if any mobile WebViews support WebRTC reliably:
   - Try `flutter_inappwebview` (different implementation than `webview_flutter`)
   - Check if Android WebView supports `getUserMedia` with proper permissions
   - Consider fallback to opening native Discord for calls (already partially implemented)

### P2 — Nice to Have

6. **MobileUpdater UI.** Show a Flutter dialog when `updateAvailable` message comes from JS. Show version, changelog, link to GitHub releases.

7. **Offline/caching support.** Service Worker or at least basic loading indicator improvements.

8. **Custom CSS themes.** Already supported through Vencord's theme system. Test adding themes from URLs, ensure they persist in localStorage.

9. **iOS release.** Build IPA, set up AltStore/sideloading instructions, test on real iOS device.

10. **Plugin compatibility audit.** Not all 155+ Vencord plugins make sense on mobile. Some may need platform-specific toggles or mobile adaptations.

### P3 — Future

11. **Android native patch mode (Phase 2).** Patch the real Discord APK for rootless installation (like BunnyManager). Major undertaking, only after Phase 1 is stable.

12. **F-Droid / app store distribution.** Investigate alternative distribution channels that won't trigger takedowns.

---

## 10. Debugging & Troubleshooting

### Common Issues

**"Bundle injection failed" in console:**
- Check that `vemobile/assets/vemobile.js` exists and is not empty
- The bundle must be valid JS — check `dist/vemobile.js` for syntax errors
- `_vencordInjected` flag prevents double-injection — reset if needed

**Back button doesn't work:**
- Check `_updateJsBackState()` is being called on `onPageFinished`
- Verify `PopScope` is wrapping the Scaffold correctly
- If SPA navigation isn't tracked, check `history.pushState` override in prelude.js

**Bottom nav not visible:**
- Check CSS is injected: look for `.vemobile-nav` in DOM
- If keyboard is open, nav is hidden by design → `.vemobile-keyboard-open` class
- Check `env(safe-area-inset-bottom)` on device — may be 0 on older Android

**Call dialog appearing unexpectedly:**
- CallDetect may be too aggressive with `console.warn`/`console.error` matching. Adjust regex.
- Some Discord UI elements with "call" in class name may trigger false positives

**CSS flash of unstyled content:**
- CSS must be injected in `_injectVencordBundle()` called from `onPageFinished`
- The CSS is actually injected via `runJavaScript` that appends a `<style>` element — check `DOMContentLoaded` timing
- If flash persists, try injecting CSS even earlier (in `onPageStarted` before nav)

---

## 11. Session Checklist (for new sessions)

When a new AI session starts, read these files first:

1. **This document** (SESSION_PIPELINE.md)
2. `vemobile/lib/webview_shell.dart` — core injection logic
3. `vemobile/lib/js_bridge.dart` — native bridge
4. `vencord-mobile-bundle/dist/vemobile-prelude.js` — JS setup
5. `vencord-mobile-bundle/dist/vemobile-patches.js` — mobile plugins
6. `vencord-mobile-bundle/scripts/build/vemobile.mjs` — build config
7. `vemobile/pubspec.yaml` — dependencies and version
8. `vencord-mobile-bundle/package.json` — JS build commands

Then run `git log --oneline -20` to see recent changes.

---

## 12. Repository URLs

- **GitHub:** `https://github.com/yHugoSoares/VencordMobile` (based on build config)
- **Vencord source:** Cloned to `/tmp/vencord-analysis/src` (for esbuild resolution)
- **Local workspace:** `/Users/hugo/Documents/Personal/VencordMobile`

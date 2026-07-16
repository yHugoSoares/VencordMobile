# Project Plan: "Vesktop for Mobile" — A Modded Discord Client for Android/iOS
### Codename: **Vemobile**

> **Current state:** v0.4.2-alpha — Phase 1 (WebView MVP) complete and stable
> **Last updated:** 2026-07-16

---

## 1. Context & Feasibility (validated)

- **Vencord** is a browser-injected JS mod for Discord's **desktop/web app** (Electron/Chromium-based).
- **Vesktop** is a custom Electron shell with Vencord preinstalled — the direct model for Vemobile.
- **Discord's official mobile app is React Native** — you cannot inject JS the way Vencord does on desktop.
- WebView-based wrappers (like Vendroid) load `discord.com` in a WebView and inject JS — this is what Vemobile does.
- Native RN patching (Bunny, Aliucord) exists but is Android-only, fragile, and legally gray.

**Conclusion:** The realistic best outcome is a WebView-based client. This is what Vemobile implements.

---

## 2. Legal & Ethical

- Violates Discord ToS — users assume risk.
- No Discord assets bundled. Client downloads from `discord.com` at runtime.
- Open-source only — never App Store / Play Store.
- GPL-3.0 license (matches Vencord).

---

## 3. Product Definition

| Aspect | Decision |
|---|---|
| Name | Vemobile |
| Platforms (current) | Android (via WebView) |
| Platforms (planned) | iOS (via WebView, requires Xcode) |
| Core approach | Flutter shell → mobile Chrome UA → responsive Discord mobile web app |
| Distribution | GitHub Releases (APK sideload) |
| License | GPL-3.0 |

---

## 4. Architecture (current)

```
Flutter Shell (vemobile/)
  └─ WebView: https://discord.com/app (mobile Chrome UA)
       ├─ Injected CSS → no flash of broken layout
       ├─ Injected JS bundle:
       │   ├─ __VEMOBILE__ bridge
       │   ├─ Vencord core (webpack patcher, 155+ plugins)
       │   └─ Mobile patches: FluxNav, WakeLock, NoTrack, MobileUpdater, CallDetect
       └─ Native Bridge (Flutter ↔ JS):
            ├─ Android back button (PopScope → WebView.goBack)
            ├─ Floating back button (top-left, auto-show/hide)
            ├─ Bottom nav bar (Home / Back / Refresh / Settings)
            ├─ Wake lock (Flux-driven, screen-on during calls)
            └─ Call fallback dialog (WebRTC → open native Discord)

Key design decisions:
- Mobile Chrome UA (NOT iPad/desktop) — Discord's responsive mobile web app handles layout
- No DOM tagging — Discord's mobile web is already responsive
- Proxy-based VencordNative — survives reassignments
- Flux events for navigation — instant, no polling
- PopScope for back button — properly async
```

---

## 5. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Shell app | Flutter (`webview_flutter`) | Single codebase for Android+iOS, mature WebView JS injection APIs |
| Mod bundle | Vencord web build (esbuild IIFE) | Reuses entire Vencord ecosystem (155+ plugins) |
| Native bridge | JavaScriptChannel + postMessage | Simple, reliable, bidirectional |
| Push notifications | Pending design (FCM/APNs relay or polling) | WebView can't receive Discord's native push |
| CI/CD | GitHub Actions | Automated APK builds per tag |
| Distribution | GitHub Releases | Sideload only |

---

## 6. Milestones Status

| Sprint | Status | Actual Result |
|--------|--------|---------------|
| Sprint 0: Research | ✅ | WebView injection timing validated |
| Sprint 1: Bare shell | ✅ | Flutter WebView loads discord.com/app |
| Sprint 2: Mod injection | ✅ | Vencord bundle injects successfully |
| Sprint 3: UX pass | ✅ | Bottom nav, gestures, keyboard, safe areas |
| Sprint 4: Plugin/theme UI | ✅ | Vencord's own settings + plugin UI available |
| Sprint 5: Notifications | ⏳ Pending | Push notification relay design not started |
| Sprint 6: Auto-update | ✅ | MobileUpdater checks GitHub releases |
| Sprint 7-8: Release | ✅ | v0.4.2-alpha on GitHub Releases |

---

## 7. Known Risks (and resolutions)

| Risk | Status |
|---|---|
| Voice/video calls in WebView | ❌ Not supported. Fallback: dialog to open native Discord app |
| Discord DOM/API changes | ⚠️ Mitigated: mobile web app changes less frequently than desktop |
| iOS sandboxing | ⏳ Untested — no Xcode installed yet |
| Account safety | ⚠️ Warning in README |
| APK update fails | ✅ Fixed: versionCode now increments (+5) |

---

## 8. Deliverables (current state)

1. ✅ Working Flutter app implementing Phase 1 MVP end-to-end
2. ✅ Vencord core bundle runnable inside a mobile WebView (687 KB)
3. ✅ 155+ reused Vencord plugins + 4 mobile plugins (FluxNav, WakeLock, NoTrack, CallDetect, MobileUpdater)
4. ✅ CI pipeline producing debug APK per tag
5. ✅ README with install instructions, disclaimer, license
6. ✅ SESSION_PIPELINE.md for session handoff

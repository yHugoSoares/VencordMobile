# Project Plan: "Vesktop for Mobile" — A Modded Discord Client for Android/iOS
### Codename suggestion: **Vemobile** (or "Vencord Mobile Shell")

> Target AI Builder: DeepSeek V4 Pro (or any capable coding agent)
> Author: Generated for Hugo Soares, July 2026
> Goal: Build a mobile equivalent of Vesktop — i.e., NOT a from-scratch Discord clone, but a lightweight wrapper/loader app that preinstalls a Vencord-like mod layer on top of the real Discord client, giving users plugins, themes, and privacy tweaks on Android (and ideally iOS) with minimal setup.

---

## 1. Context & Feasibility Research (already validated)

Before coding starts, the agent must understand why this is hard and what prior art exists:

- **Vencord** is a browser-injected JS mod for the Discord **desktop/web app** (Electron/Chromium-based), which is why it works so well on desktop — the desktop client is essentially a website in an Electron shell.
- **Vesktop** is not a mod itself; it's a *custom Electron shell* that ships with Vencord preinstalled, replacing Discord's official Electron app with a lighter, faster one. This is the direct model to replicate for mobile.
- **Discord's official mobile app is NOT Electron/web-based** — it is built with **React Native**, a compiled native app, not a webpage. This is the single biggest technical obstacle: you cannot inject arbitrary JS into it the way Vencord does on desktop.
- Because of this, **no clean "Vesktop for mobile" exists today**. Prior attempts fall into two categories:
  - **Web-wrapper apps** (e.g., Vendroid / VendroidEnhanced): load `discord.com` mobile website in a WebView and inject Vencord's JS bundle. Simple, cross-platform, but Discord's mobile *website* is poorly optimized and missing features (no reliable voice/video, clunky UI) — described by its own developers as "not very usable" and "mostly a proof of concept."
  - **Native RN patching (Bunny, formerly Vendetta, formerly Aliucord)**: patches the real React Native Discord APK directly, either via an Xposed module (root required) or via a repackaged/re-signed APK (no root, via "BunnyManager"). This gives near-native performance and real voice/video support, and has its own plugin/theme ecosystem, but requires reverse-engineering RN bundles, is Android-only in practice, breaks on every Discord update, and sits in a legal gray zone (violates Discord ToS; iOS is nearly impossible due to App Store sandboxing/signing).

**Conclusion:** Yes, it is technically possible, but there is no way to get a *true* one-to-one "Vesktop but mobile" (i.e., desktop-grade JS injection) because the underlying app isn't a webpage. The realistic best outcome is a **hybrid**: default to a WebView-based Vencord-injected client (cross-platform, easy to maintain) with an *optional* advanced mode that patches the native RN APK on Android for users who want full native performance. This plan builds both paths, starting with the WebView approach as MVP since it's dramatically simpler and works on both Android and iOS.

---

## 2. Legal & Ethical Notes (must be included in README of final product)

- This project modifies a third-party client and technically violates Discord's Terms of Service; users can theoretically be action against their account (rare in practice for mod usage, but not zero risk).
- No Discord assets, trademarks, or proprietary code should be redistributed. The mod loader must download Discord's real client/website at runtime, not bundle it.
- Distribute only as open-source source code, not as an App Store / Play Store listing, to avoid takedown and store policy violations.
- Include a clear disclaimer and "use at your own risk" notice.

---

## 3. Product Definition

| Aspect | Decision |
|---|---|
| Name | Vemobile (placeholder, rename freely) |
| Platforms (MVP) | Android + iOS (via WebView wrapper) |
| Platforms (Advanced/Phase 2) | Android only (native RN patch, root or repack) |
| Core tech (MVP) | Cross-platform shell app (Flutter *or* Capacitor/Ionic *or* React Native WebView) hosting `discord.com/app` with injected Vencord-compatible JS |
| Core tech (Phase 2) | Metro/Hermes bundle patching, similar to Bunny's approach |
| Distribution | GitHub releases (APK/IPA sideload), never official stores |
| License | Open source, MIT or GPLv3 (match Vencord's license) |

---

## 4. Architecture Overview

### Phase 1 — WebView Mod Shell (MVP)
1. Native mobile shell app (Flutter recommended for single-codebase iOS+Android, or Capacitor if the agent prefers web tech).
2. WebView component loads `https://discord.com/app` (the same URL the desktop Electron client loads).
3. On page load, inject a JS bundle equivalent to Vencord's core (patcher, plugin loader, settings UI) via `evaluateJavascript` / WebView JS injection hooks.
4. Reuse or fork Vencord's existing plugin API surface where possible so existing plugins/themes are compatible without rewriting them.
5. Add mobile-specific UX fixes that Discord's own mobile website lacks: better touch targets, a persistent bottom nav bar, swipe gestures for the server/channel list, and screen-wake handling for calls.
6. Local storage for settings, plugin toggles, and custom CSS/theme snippets (use platform secure storage, not cloud sync, for privacy).
7. Auto-updater: check a GitHub releases JSON feed for new mod-bundle versions Independent of app store updates (bundle can update itself without a full app reinstall, same trick Vencord desktop uses).

### Phase 2 — Native RN Patch Mode (Advanced, Android only)
1. Download the current official Discord APK.
2. Unpack the RN Hermes bytecode bundle.
3. Patch the bundle to load an external mod script (loader pattern used by Bunny/Vendetta), rather than decompiling/recompiling app logic directly.
4. Re-sign the APK with a debug/user key for sideloading (non-root) — mirrors "BunnyManager" flow — or ship an Xposed module for rooted devices for cleaner injection without repackaging Discord's APK at all.
5. Build a companion "Manager" app (like BunnyManager) that automates: download official APK → patch → sign → install, all on-device, so the agent's app never redistributes Discord's code itself, only the patch script.

### Feature Parity Checklist (build in this order)
- Load & log in to real Discord account (OAuth/token, stored securely)
- Send/receive messages, images, reactions, threads
- Voice & video calls (WebRTC — critical to test early since this is the classic failure point of WebView Discord clients)
- Push notifications (FCM for Android, APNs for iOS, since WebView apps lose native push unless wired up separately)
- Plugin system: enable/disable, per-plugin settings screen
- Theme system: load community themes via URL, live CSS injection
- Vencord parity plugins to port first: message logger, no-track (analytics blocking), custom CSS, badge/decoration removal, quick-reply, spotify-controls

---

## 5. Suggested Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Shell app | Flutter (`webview_flutter` / `flutter_inappwebview`) | Single codebase for Android+iOS, mature WebView JS-injection APIs |
| Mod bundle | TypeScript, compiled via esbuild (same tooling Vencord uses) | Maximizes plugin-code reuse from existing Vencord ecosystem |
| Native patch (Phase 2) | Kotlin/Java (Android), Frida-style bytecode patching or Bunny's existing loader | Proven pattern, avoid reinventing RN patching from scratch |
| Push notifications | Firebase Cloud Messaging (Android), APNs bridge (iOS) | Required since WebView doesn't get Discord's native push |
| CI/CD | GitHub Actions | Automated APK/IPA builds + release publishing |
| Distribution | GitHub Releases + F-Droid-style manual install docs | Avoid app store bans |

---

## 6. Milestones / Build Order (give this to the coding agent as a sprint plan)

1. **Sprint 0 — Research spike**: Confirm WebView JS-injection timing works reliably against Discord's SPA (single-page app) lifecycle; confirm login/token persistence works in WebView cookies/localStorage across app restarts.
2. **Sprint 1 — Bare shell**: Flutter app that just opens `discord.com/app` in a WebView, no mod yet. Validate login, messaging, and basic voice call work at all inside a mobile WebView.
3. **Sprint 2 — Mod injection pipeline**: Build the JS injection bridge; port Vencord's core patcher/plugin-loader into a mobile-safe bundle; get at least one working plugin (e.g., custom CSS) end-to-end.
4. **Sprint 3 — UX pass**: Fix mobile-specific layout issues (nav bar, gestures, keyboard handling, safe-area insets).
5. **Sprint 4 — Plugin/theme manager UI**: Native settings screens to install/toggle plugins and themes from URLs, matching Vencord desktop's settings UX.
6. **Sprint 5 — Notifications**: Wire FCM/APNs so users get push notifications like the real app (this is usually the hardest and most-skipped part).
7. **Sprint 6 — Auto-update system**: Self-update the JS mod bundle without requiring a full app store update.
8. **Sprint 7 (stretch) — Phase 2 native patch mode**: Only attempt after Phase 1 is stable; build the Android APK-patching "Manager" companion app.
9. **Sprint 8 — Docs & release**: Write install guide, disclaimer, contributing guide; publish first GitHub release.

---

## 7. Known Risks / Things the Agent Must Flag, Not Silently Skip

- Voice/video calls are the most likely feature to break inside a WebView; the agent should build a fallback that opens the native Discord app (if installed) for calls only, if WebRTC proves unreliable.
- Discord frequently changes its web client's DOM/internal APIs, which will break plugin compatibility; the mod bundle needs versioned compatibility shims, mirroring how Vencord handles Discord updates.
- iOS WebView JS injection has stricter sandboxing than Android; test iOS early rather than treating it as an afterthought.
- Account safety: warn users clearly that automation/token extraction risks Discord ToS enforcement action.

---

## 8. Deliverables Expected From the Coding Agent

1. A working Flutter (or chosen stack) repo implementing Phase 1 MVP end-to-end.
2. A forked/adapted Vencord core bundle runnable inside a mobile WebView.
3. At least 5 working ported plugins from the existing Vencord/Bunny plugin ecosystems.
4. CI pipeline producing signed debug APK + iOS IPA build artifacts per release.
5. A README with install instructions, screenshots, disclaimer, and contribution guide.
6. A written report at the end of each sprint documenting what worked, what didn't, and any architecture changes made vs. this plan.
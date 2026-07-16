# Vemobile UI Overhaul Plan — Complete (18 fixes across 6 sprints)

## Architecture Evolution

```
v0.1–v0.2: Desktop UA + DOM tagging + CSS view toggling  ← BROKEN, REMOVED
v0.3–v0.4: Mobile Chrome UA + Discord's responsive mobile web  ← CURRENT
```

---

## Sprint 1: Critical Fixes (v0.2.0)

| # | Issue | Fix |
|---|-------|-----|
| 1.1 | DOM tagging full-tree scan | Targeted selectors (walk up from messagesWrapper) |
| 1.2 | URL hash detection matched `/channels/` always | Snowflake-ID pattern (`\d{17,19}`) |
| 1.3 | Keyboard no CSS | `.vemobile-keyboard-open .vemobile-nav { display: none }` |
| 1.4 | NoTrack wildcard `*` not matching | Regex `/\/api\/v\d+\/science/` |
| 1.5 | Navigation delegate blocked auth providers | Same-origin (discord.com) allowed, cross-origin blocked |
| 1.6 | VencordNative lost patches on reassign | Proxy-based hook |
| 1.7 | Members toggle used inline styles | Body class `.vemobile-show-members` |

## Sprint 2: Navigation & UX (v0.2.0)

| # | Issue | Fix |
|---|-------|-----|
| 2.1 | No Flux event integration | FluxNav: subscribes to CHANNEL_SELECT, VOICE_CHANNEL_SELECT, RTC |
| 2.2 | No view transition animations | CSS opacity + slide-in animations |
| 2.3 | Settings button fragile | Vencord.Api.Settings.open() as primary path |
| 2.4 | Call detection surface-level | CallDetect: console interception + amber banner |
| 2.5 | Member list inline style | Class-based toggle (completed in 1.7) |

## Sprint 3: Performance & Polish (v0.2.0)

| # | Issue | Fix |
|---|-------|-----|
| 3.1 | setInterval hash polling 300ms | Native hashchange event (0 CPU idle) |
| 3.2 | WakeLock DOM polling every 5s | Flux event-driven wake lock (instant) |
| 3.3 | No loading indicator | Spinner overlay during view transitions |
| 3.4 | CSS injected after paint | DOMContentLoaded listener (before Discord renders) |
| 3.5 | iPad user-agent may block features | Deferred |

## Sprint 4: Mobile UA Rewrite (v0.3.0-alpha)

| # | Issue | Fix |
|---|-------|-----|
| 4.1 | Desktop layout on phone screens (960px+) | **Mobile Chrome UA** — Discord serves responsive mobile web app |
| 4.2 | DOM tagging fragile & slow | **Removed entirely** — mobile web handles layout itself |
| 4.3 | All layout CSS overrides | **Removed** ~450 lines of view-toggling CSS |
| 4.4 | URL hash detection, click interception, swipe nav | **Removed** — Discord's SPA handles nav |
| 4.5 | 2FA / auth flows blocked | Navigation delegate parses URI hosts properly |
| 4.6 | Bottom nav always shown | Auto-hides on login, 2FA, register screens |

## Sprint 5: Back Navigation & Safe Areas (v0.4.0–v0.4.1-alpha)

| # | Issue | Fix |
|---|-------|-----|
| 5.1 | Android back button exits app | PopScope → canGoBack → goBack → SystemNavigator.pop |
| 5.2 | No visible back button | Floating ← button (auto-show on sub-pages) |
| 5.3 | Status bar/notch overlap | SafeArea(top:true) + env(safe-area-inset-*) CSS |
| 5.4 | Bottom nav blocks content | CSS padding on #app-mount |
| 5.5 | Nav buttons don't work | Home | Back | Refresh | Settings in bottom nav |
| 5.6 | APK update fails | versionCode +1→+5, removed release APK (debug only) |

## Sprint 6: UX Polish (v0.4.2-alpha)

| # | Issue | Fix |
|---|-------|-----|
| 6.1 | Side-swipe for server list blocked | Removed overflow-x:hidden from html/body |
| 6.2 | "Browser not supported" on calls | Added MediaStream, MediaStreamTrack stubs |
| 6.3 | Niche menus/popups overflow screen | Added [class*=popout], menu, tooltip, layer to CSS |
| 6.4 | Back button async race | PopScope properly awaits canGoBack() |

---

## Status Summary

| Sprint | Version | Fixes | Theme |
|--------|---------|-------|-------|
| 1 | v0.2.0 | 7 | Critical: DOM, hash, keyboard, NoTrack, nav delegate, Proxy, members |
| 2 | v0.2.0 | 5 | UX: FluxNav, transitions, settings, call detection, class toggle |
| 3 | v0.2.0 | 5 | Perf: hashchange, event wake lock, loading overlay, CSS timing |
| 4 | v0.3.0-alpha | 6 | Rewrite: mobile UA, no DOM tagging, no layout CSS, 2FA fix |
| 5 | v0.4.0–1 | 6 | Nav: back button, safe areas, bottom nav, versionCode fix |
| 6 | v0.4.2-alpha | 4 | Polish: side-swipe, call stubs, menus, async back |

**Total: 33 fixes, v0.4.2-alpha current**

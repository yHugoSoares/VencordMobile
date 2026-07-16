---
name: vemobile-bundle
description: Use when working on the Vencord mobile JS mod bundle — prelude, patches, plugins, CSS injection, DOM tagging, WebRTC overrides, or the esbuild build config. Trigger keywords: bundle, prelude, patches, inject, webview js, vemobile.js, venial, mod bundle, DOM tagging, layout engine, mobileUX, wakeLock, noTrack, mobileUpdater, bottom nav, back button, swipe gesture.
---

# Vemobile JS Mod Bundle

The mobile mod bundle is an IIFE that wraps Vencord's web build with a mobile prelude and post-injection patches.

## File Layout

```
vencord-mobile-bundle/
├── dist/
│   ├── vemobile.js           # Combined bundle: prelude + Vencord + patches
│   ├── vemobile-prelude.js   # Viewport, base CSS, DOM tagging, navigation engine, WebRTC override
│   ├── vemobile-base.js      # Vencord web build (browser.js, 653 KB, 155+ plugins)
│   ├── vemobile-base.css     # Vencord styles
│   └── vemobile-patches.js   # Mobile plugins: WakeLock, NoTrack, MobileUpdater
├── scripts/build/
│   └── vemobile.mjs          # esbuild config for mobile target
├── package.json
└── tsconfig.json
```

## Architecture

### Injection Order (in webview_shell.dart)
1. CSS injected first (`vemobile-base.css`) — prevents flash of broken layout
2. JS bundle injected (`vemobile.js`) — contains prelude + Vencord + patches

### Prelude (`vemobile-prelude.js`) — runs first, before Vencord
- Platform detection (`window.__VEMOBILE__` global)
- Viewport meta tag injection
- WebRTC/media support overrides (RTCPeerConnection, getUserMedia)
- VencordNative setter hook for mobile API patching
- DOM tagging engine: finds Discord's layout elements and tags with `data-vemobile-*`
- Base CSS injection (layout states: `.vemobile-home`, `.vemobile-chat`, `.vemobile-guilds`)
- Navigation engine: URL hash monitoring, click interception, swipe gestures
- Back button creation and management
- Bottom nav bar creation
- Call interception (overrides `window.alert` for unsupported call errors)

### Base (`vemobile-base.js`) — Vencord web build
- 155+ web-compatible Vencord plugins
- Webpack patcher and module finder
- Settings UI, plugin manager, theme engine
- Uses localStorage for settings persistence

### Patches (`vemobile-patches.js`) — runs after Vencord loads
- WakeLock: `setInterval` every 5s to detect voice states, request/release screen lock
- NoTrack: overrides `window.fetch` to block analytics endpoints
- MobileUpdater: polls GitHub API for new release versions

## DOM Tagging System

Instead of fragile CSS `[class*="sidebar"]` selectors (Discord mangles class names), the engine finds Discord's layout elements via JavaScript and tags them:

- `data-vemobile-sidebar` — channel/DM list container
- `data-vemobile-chat` — messages container
- `data-vemobile-guilds` — server list container
- `data-vemobile-members` — member list container

Tagging algorithm: walks `#app-mount`, finds the flex container with 2-5 children, identifies columns by width (narrow = guilds, medium = sidebar/members, wide = chat), and tags them. Falls back to `nav` + `[class*=chat]` selectors if width-based detection fails. Retries every 500ms for up to 15s.

## CSS Layout States

Three view states controlled by body classes:

```
.vemobile-home     → [data-vemobile-sidebar] visible, chat/guilds/members hidden
.vemobile-chat     → [data-vemobile-chat] visible, sidebar/guilds/members hidden
.vemobile-guilds   → [data-vemobile-guilds] visible, sidebar/chat/members hidden
```

## Building

```bash
cd vencord-mobile-bundle
pnpm install
pnpm build

# Or manually concatenate:
cd dist
cat vemobile-prelude.js vemobile-base.js vemobile-patches.js > vemobile.js
```

Then copy to Flutter assets:
```bash
cp vencord-mobile-bundle/dist/vemobile.js vemobile/assets/vemobile.js
cp vencord-mobile-bundle/dist/vemobile-base.css vemobile/assets/vemobile.css
```

## Key Design Decisions

- Prelude runs BEFORE Vencord. It sets up `window.__VEMOBILE__` and hooks `VencordNative` setter.
- Patches wait for Vencord's webpack to initialize before registering plugins.
- DOM tagging uses `data-*` attributes instead of class selectors for reliability.
- WebRTC is polyfilled (not actually available in WebView) — call attempts trigger a native fallback dialog.
- The bottom nav sits below `#app-mount` with `padding-bottom: calc(50px + safe-area)`.

# Vemobile — Vencord for Mobile

[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Build](https://github.com/yHugoSoares/VencordMobile/actions/workflows/build.yml/badge.svg)](https://github.com/yHugoSoares/VencordMobile/actions/workflows/build.yml)

**Vemobile** is a custom Discord client shell for Android that loads
Discord's mobile web app in a WebView and injects the [Vencord](https://github.com/Vendicated/Vencord)
mod bundle — bringing 155+ plugins, themes, and privacy tweaks to your phone.

> ⚠️ **WARNING:** This project modifies a third-party client and technically violates
> Discord's Terms of Service. Usage may theoretically result in account action
> (rare in practice for mod usage, but not zero risk). **Use at your own risk.**

## How It Works

```
┌──────────────────────────────────────────────────┐
│               Vemobile App (Flutter)              │
│  ┌────────────────────────────────────────────┐   │
│  │  WebView: discord.com/app (mobile Chrome)  │   │
│  │  ┌──────────────────────────────────────┐  │   │
│  │  │  Vencord Bundle (injected JS IIFE)   │  │   │
│  │  │  • 155+ plugins                      │  │   │
│  │  │  • Theme engine (custom CSS)         │  │   │
│  │  │  • MobileUX: bottom nav, back button │  │   │
│  │  │  • Privacy: NoTrack, CallDetect      │  │   │
│  │  └──────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────┐   │
│  │  Native Features (Flutter)                 │   │
│  │  • Back navigation (PopScope + WebView)    │   │
│  │  • Wake lock during calls (Flux-driven)    │   │
│  │  • URL opening (external links → browser)  │   │
│  │  • SharedPreferences storage               │   │
│  │  • Push notifications (pending)            │   │
│  └────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

Unlike other mobile Discord mod approaches (Vendroid, Bunny, Aliucord), Vemobile
loads Discord's **responsive mobile web app** with a mobile Chrome user-agent
and injects Vencord on top. This means:
- The layout works correctly out of the box (no CSS hacks)
- Login/2FA/CAPTCHA flows work natively
- The app auto-updates via GitHub Releases
- No repackaging of Discord's proprietary code

## Features

### Core
- [x] Full Discord login (email + password, 2FA, Google SSO)
- [x] Send/receive messages, images, reactions, threads
- [x] Full Vencord plugin system (155+ plugins from Vencord ecosystem)
- [x] Custom CSS themes (load from URL, stored in localStorage)
- [x] Vencord's own settings UI (User Settings > Vencord)

### Mobile-Specific
- [x] **Bottom nav bar**: Home | Back | Refresh | Settings
- [x] **Floating back button**: appears top-left when in a channel/DM/settings
- [x] **Android hardware back button**: properly navigates WebView history
- [x] **Safe-area insets**: works on notched phones, status bars, navigation bars
- [x] **Keyboard handling**: nav bar hides when keyboard opens
- [x] **Auto-hide nav on login**: nav bar hidden during auth flows
- [x] **WakeLock**: keeps screen on during voice/video calls
- [x] **NoTrack**: blocks Discord analytics and telemetry
- [x] **MobileUpdater**: checks GitHub releases for new versions
- [x] **CallDetect**: intercepts "browser not supported" → offers to open native Discord
- [ ] **Push notifications**: FCM/APNs relay (in design)
- [ ] **Voice/video calls**: WebRTC not supported in WebView

### From Vencord (155+ included)
Custom CSS, Message Logger, Show Hidden Channels, No Typing, Better Folders,
Spotify Controls, Translate, Permissions Viewer, ReviewDB, Relationship Notifier,
and 145+ more.

## Installation

### Android (sideload)

1. Download the latest `app-debug.apk` from [GitHub Releases](https://github.com/yHugoSoares/VencordMobile/releases)
2. Enable "Install from unknown sources" in your device settings
3. Install the APK
4. Open Vemobile and log in with your Discord account

> **Updating:** Just install the new APK over the old one. Version code increments
> automatically. If it says "App not installed", uninstall the old version first.

### iOS

Not yet available. Requires Xcode setup on macOS. See build instructions below.

### Build from Source

```bash
# Prerequisites
#   - Flutter SDK 3.44+ (setup: ~/flutter or /opt/homebrew/share/flutter)
#   - Android SDK (for Android builds)
#   - Xcode 15+ (for iOS builds, macOS only)

# Clone
git clone https://github.com/yHugoSoares/VencordMobile.git
cd VencordMobile

# Build JS bundle
cd vencord-mobile-bundle
pnpm install
pnpm build
cd ..

# Copy bundle to Flutter assets
cp vencord-mobile-bundle/dist/vemobile.js vemobile/assets/
cp vencord-mobile-bundle/dist/vemobile-base.css vemobile/assets/vemobile.css

# Build Flutter APK
cd vemobile
flutter pub get
flutter build apk --debug     # → build/app/outputs/flutter-apk/app-debug.apk

# iOS (requires Xcode)
flutter build ios --no-codesign --debug
```

## Architecture

```
VencordMobile/
├── vemobile/                          # Flutter shell app
│   ├── lib/
│   │   ├── main.dart                  # App entry, theme, orientations
│   │   ├── webview_shell.dart         # WebView + JS injection + back nav
│   │   ├── js_bridge.dart             # Flutter ↔ JS bridge (postMessage)
│   │   ├── storage_service.dart       # SharedPreferences wrapper
│   │   ├── notification_service.dart  # Push notifications (stub)
│   │   └── wakelock_service.dart      # Android wake lock
│   ├── assets/
│   │   ├── vemobile.js                # Mod bundle (687 KB)
│   │   └── vemobile.css               # Vencord themes CSS
│   └── pubspec.yaml
│
├── vencord-mobile-bundle/             # JS mod bundle source
│   ├── dist/
│   │   ├── vemobile.js                # Combined IIFE bundle
│   │   ├── vemobile-prelude.js        # Bridge, nav, WebRTC, keyboard
│   │   ├── vemobile-patches.js        # FluxNav, WakeLock, NoTrack, etc.
│   │   └── vemobile-base.js           # Vencord web build (653 KB)
│   ├── scripts/build/vemobile.mjs     # esbuild config
│   └── package.json
│
├── UI_overhaul.md                     # Sprint-by-sprint fix log
├── SESSION_PIPELINE.md                # Full project handoff document
├── plan.md                            # Original project plan (updated)
├── .github/workflows/build.yml        # CI: APK per tag
└── LICENSE                            # GPL-3.0
```

## Navigation Controls

| Control | Behavior |
|---------|----------|
| **Android hardware back** | First: WebView history back (SPA-aware). At root: minimizes app. |
| **Floating ← button** | Appears top-left when in a sub-page (channel/DM/settings). Hidden on home. |
| **Bottom nav Home** | Navigates to `#/channels/@me` (DM list) |
| **Bottom nav Back** | Same as hardware back (`history.back()`) |
| **Bottom nav Refresh** | Reloads Discord web app |
| **Bottom nav Settings** | Opens Vencord's settings panel (or Discord settings as fallback) |

## Known Limitations

- **Voice/Video calls**: WebRTC is not available in mobile WebViews. A dialog
  offers to open the native Discord app when calls are detected.
- **Push notifications**: WebView apps cannot receive Discord's native push.
  A relay/polling mechanism is in design.
- **iOS**: Not yet built. Requires Xcode (12 GB, macOS only).
- **Discord updates**: Vencord uses webpack module finder which may need updates
  when Discord changes its code.

## License

GNU General Public License v3.0 (GPL-3.0) — matching the Vencord project.

## Disclaimer

Vemobile is not affiliated with Discord Inc. or Vencord. All Discord trademarks
and copyrights are owned by Discord Inc. Vemobile does not redistribute Discord's
code — it downloads the Discord web client at runtime from `discord.com`.

Use of this software may violate Discord's Terms of Service. The authors assume
no liability for any consequences of using this software.

## Acknowledgments

- [Vencord](https://github.com/Vendicated/Vencord) — The desktop mod this project builds upon
- [Vesktop](https://github.com/Vencord/Vesktop) — Inspiration for the custom shell concept

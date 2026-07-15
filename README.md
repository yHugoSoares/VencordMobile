# Vemobile — Vencord for Mobile

[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Build](https://github.com/vencordmobile/vemobile/actions/workflows/build.yml/badge.svg)](https://github.com/vencordmobile/vemobile/actions/workflows/build.yml)

**Vemobile** is a custom Discord client shell for Android and iOS that loads the
real Discord web app in a WebView and injects the [Vencord](https://github.com/Vendicated/Vencord)
mod bundle, bringing desktop-quality plugins, themes, and privacy tweaks to mobile.

> ⚠️ **WARNING:** This project modifies a third-party client and technically violates
> Discord's Terms of Service. Usage may theoretically result in account action
> (rare in practice for mod usage, but not zero risk). **Use at your own risk.**

## How It Works

```
┌─────────────────────────────────────────┐
│            Vemobile App (Flutter)        │
│  ┌─────────────────────────────────────┐ │
│  │  WebView: https://discord.com/app   │ │
│  │  ┌───────────────────────────────┐  │ │
│  │  │  Vencord Bundle (injected JS) │  │ │
│  │  │  • 155+ plugins               │  │ │
│  │  │  • Theme engine               │  │ │
│  │  │  • Mobile UX enhancements     │  │ │
│  │  │  • Anti-tracking              │  │ │
│  │  └───────────────────────────────┘  │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │  Native Bridge (Flutter ↔ JS)       │ │
│  │  • Wake lock during calls           │ │
│  │  • External link handling           │ │
│  │  • Local storage                    │ │
│  │  • Push notifications (planned)     │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

Unlike other mobile Discord mod approaches (Vendroid, Bunny, Aliucord), Vemobile
defaults to a **WebView-based injection** strategy that:
- Works on **both Android and iOS** without root or jailbreak
- Reuses Vencord's existing plugin ecosystem (155+ plugins)
- Does not repackage or redistribute Discord's proprietary code

## Features

### Core
- [x] Load real Discord account (login works via WebView cookies/localStorage)
- [x] Send/receive messages, images, reactions
- [x] Full Vencord plugin system (155+ plugins from the Vencord ecosystem)
- [x] Custom CSS themes (load from URL, stored locally)
- [x] Plugin settings manager
- [x] Discord settings accessible (User Settings > Vencord)

### Mobile-Specific
- [x] **MobileUX** plugin: safe-area insets for notched devices, larger touch targets, swipe gestures, keyboard handling, hides Discord's mobile download banner
- [x] **WakeLock** plugin: keeps screen on during voice/video calls
- [x] **NoTrack** plugin: blocks Discord analytics and telemetry
- [x] **MobileUpdater** plugin: checks GitHub releases for new mod bundle versions
- [ ] **PushNotifications** plugin: FCM/APNs push relay (in development)
- [ ] Voice/video calls via WebRTC in WebView (testing needed)

### From Vencord (all web-compatible plugins work)
Selected highlights from the 155+ included plugins:
- **Custom CSS** — inject custom CSS snippets
- **Message Logger** — log deleted/edited messages
- **Show Hidden Channels** — reveal hidden channels
- **No Typing** — disable typing indicators
- **Better Folders** — improved server folder UI
- **Spotify Controls** — control Spotify playback from Discord
- **Translate** — translate messages inline
- **Permissions Viewer** — detailed channel/role permissions
- **ReviewDB** — user review system
- **Relationship Notifier** — friend request and relationship notifications
- ... and 145+ more

## Installation

### Android

1. Download the latest APK from [GitHub Releases](https://github.com/vencordmobile/vemobile/releases)
2. Enable "Install from unknown sources" in your device settings
3. Install the APK
4. Open Vemobile and log in with your Discord account

### iOS

iOS installation requires sideloading:
1. Download the latest IPA from [GitHub Releases](https://github.com/vencordmobile/vemobile/releases)
2. Use AltStore, Sideloadly, or another IPA sideloading tool
3. Trust the developer certificate in Settings > General > Device Management
4. Open Vemobile and log in

### Build from Source

```bash
# Prerequisites
# - Flutter SDK 3.44+
# - Android Studio (for Android builds)
# - Xcode 15+ (for iOS builds)

# Clone the repository
git clone https://github.com/vencordmobile/vemobile.git
cd vemobile

# Build JS bundle
cd vencord-mobile-bundle
pnpm install
pnpm build
cd ..

# Copy bundle to assets
cp vencord-mobile-bundle/dist/vemobile.js vemobile/assets/
cp vencord-mobile-bundle/dist/vemobile-base.css vemobile/assets/vemobile.css

# Build Flutter app
cd vemobile
flutter pub get
flutter build apk --debug     # Android
flutter build ios --no-codesign --debug  # iOS
```

## Architecture

```
VencordMobile/
├── vemobile/                          # Flutter shell app
│   ├── lib/
│   │   ├── main.dart                  # App entry point
│   │   ├── webview_shell.dart         # WebView + JS injection controller
│   │   ├── js_bridge.dart             # Flutter ↔ JS communication
│   │   ├── storage_service.dart       # Local storage wrapper
│   │   ├── notification_service.dart  # Push notification handler
│   │   └── wakelock_service.dart      # Screen-on during calls
│   ├── assets/
│   │   ├── vemobile.js                # Mod bundle (prelude + Vencord + patches)
│   │   └── vemobile.css               # Vencord themes CSS
│   └── pubspec.yaml
│
├── vencord-mobile-bundle/             # Mod bundle project
│   ├── dist/
│   │   ├── vemobile.js                # Combined mobile bundle
│   │   ├── vemobile-prelude.js        # Pre-injection setup
│   │   ├── vemobile-patches.js        # Mobile plugins & patches
│   │   └── vemobile-base.js           # Vencord web build
│   ├── scripts/build/
│   │   └── vemobile.mjs               # esbuild mobile build config
│   └── package.json
│
└── .github/workflows/
    └── build.yml                      # CI: APK + IPA + release
```

## Known Limitations

- **Voice/Video calls**: WebRTC in mobile WebViews may be unreliable. A fallback
  to open the native Discord app for calls is planned if WebRTC proves unstable.
- **Push notifications**: WebView apps cannot receive Discord's native push.
  A relay mechanism is in development.
- **iOS restrictions**: iOS `WKWebView` has stricter JS injection rules than
  Android `WebView`. The app has been designed to work within these constraints.
- **Discord updates**: Discord frequently changes its web client internals which
  may break plugin compatibility. The mod bundle uses versioned compatibility
  shims (same approach as Vencord desktop).

## License

This project is licensed under the **GNU General Public License v3.0** (GPL-3.0),
matching the license of the Vencord project it builds upon.

See [LICENSE](LICENSE) for details.

## Disclaimer

Vemobile is not affiliated with Discord Inc. or Vencord. All Discord trademarks
and copyrights are owned by Discord Inc. Vemobile does not redistribute Discord's
code — it downloads the Discord web client at runtime from `discord.com`.

Use of this software may violate Discord's Terms of Service. The authors assume
no liability for any consequences of using this software.

## Acknowledgments

- [Vencord](https://github.com/Vendicated/Vencord) — The desktop mod this project builds upon
- [Vesktop](https://github.com/Vencord/Vesktop) — Inspiration for the custom shell concept
- The Vencord community — for the plugin ecosystem and ongoing development

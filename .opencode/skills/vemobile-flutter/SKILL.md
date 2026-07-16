---
name: vemobile-flutter
description: Use when working on the Flutter shell app — WebView configuration, JS bridge, user-agent, platform channels, navigation delegate, Android/iOS build issues, permissions, or native feature integration. Trigger keywords: flutter, dart, webview, APK, build, compile, Gradle, pubspec, user-agent, WebViewController, js_bridge, main.dart, webview_shell, platform channel, Android, iOS, Xcode, CocoaPods.
---

# Vemobile Flutter Shell

The Flutter app wraps Discord's web app in a mobile WebView and injects the Vencord mod bundle.

## File Layout

```
vemobile/
├── lib/
│   ├── main.dart                  # App entry, theme, orientation lock
│   ├── webview_shell.dart         # WebView setup, JS injection, call fallback dialog
│   ├── js_bridge.dart             # Flutter ↔ JS bidirectional communication
│   ├── storage_service.dart       # SharedPreferences wrapper
│   ├── notification_service.dart  # Local/push notification handler
│   └── wakelock_service.dart      # Android wake lock via platform channel
├── assets/
│   ├── vemobile.js                # Mod bundle (copied from vencord-mobile-bundle/dist/)
│   └── vemobile.css               # Vencord styles
├── android/                       # Android platform code
├── ios/                           # iOS platform code
├── pubspec.yaml                   # Dependencies
└── pubspec.lock
```

## Key Flutter Dependencies

```yaml
webview_flutter: ^4.8.0      # WebView with JS injection
shared_preferences: ^2.3.0   # Local key-value storage
url_launcher: ^6.3.0         # Open external URLs/browsers
package_info_plus: ^10.2.1   # App version info
```

## WebView Configuration (`webview_shell.dart`)

### User-Agent
Uses iPad Safari UA to get Discord's desktop app with touch-aware behavior:
```
Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15
(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 Vemobile/0.1.0
```

### Navigation Delegate
- **Allow**: `discord.com`, `discordapp.com`, `discordapp.net`, `discord.gg`, `discord.media`, `discordcdn.com`, captcha/cloudflare domains
- **Block**: All other external URLs → opened in native browser via `url_launcher`

### JS Injection Order
1. CSS first (prevents layout flash)
2. Main bundle (prelude + Vencord + patches)

### JS Channel
- Channel name: `VemobileBridge`
- Messages forwarded to `JsBridge.handleJsMessage()`

### Call Fallback
- `onCallUnsupported` / `onCallAttempted` callbacks show a native `AlertDialog` offering to open native Discord via `discord://` deep link

## JS Bridge (`js_bridge.dart`)

Bidirectional communication:
- **JS → Flutter**: `VemobileBridge.postMessage(JSON)` → `handleJsMessage()`
- **Flutter → JS**: `controller.runJavaScript("window.__VEMOBILE__.receiveFromNative(...)")`

### Message Types (JS → Flutter)
- `bridge` — native method call with callback ID
- `openUrl` — open external URL
- `callUnsupported` — show call fallback dialog
- `callAttempted` — show call fallback dialog
- `updateAvailable` — new version notification
- `log` — debug logging

### Native Methods (callable from JS via `window.__VEMOBILE__.callNative()`)
- `requestWakeLock` — Android wake lock via `MethodChannel('vemobile/wakelock').invokeMethod('acquire')`
- `releaseWakeLock` — release wake lock
- `getDeviceInfo` — platform + app version
- `getFCMToken` — stored push token from SharedPreferences

## Building

```bash
# Android (requires ANDROID_HOME set)
cd vemobile
flutter pub get
flutter build apk --debug
# Output: build/app/outputs/flutter-apk/app-debug.apk

# iOS (requires Xcode)
flutter build ios --no-codesign --debug
```

## Flutter Version

Currently targeting Flutter 3.44.6 (stable). Packages must be compatible with this version. If upgrading Flutter, run `flutter pub upgrade --major-versions` and `flutter clean` to regenerate plugin registrants.

## Common Issues

- **Package incompatibility**: Flutter 3.44 removed `BinaryMessenger`, `PlatformException`, `MethodChannel` etc. as top-level types. Older packages fail. Fix: `flutter pub upgrade --major-versions`.
- **GeneratedPluginRegistrant errors**: After upgrading packages, run `flutter clean && flutter pub get` to regenerate.
- **`_controller` not initialized**: Must call `_createWebView()` in `initState()` before `build()`.
- **Cascade notation + closures**: `final ctrl = WebViewController()..addChannel(..ctrl..)` fails because `ctrl` is captured before declaration. Use separate statements: `final ctrl = WebViewController(); ctrl.setFoo(); ctrl.addChannel();`

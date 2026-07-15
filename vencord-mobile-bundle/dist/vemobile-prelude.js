/**
 * Vemobile Prelude — Runs before Vencord bundle.
 * Detects mobile, injects viewport + base CSS, sets up bridge.
 */
(function () {
  // Detect platform
  var ua = navigator.userAgent || "";
  var isAndroid = /Android/i.test(ua);
  var isIOS = /iPhone|iPad|iPod/i.test(ua);

  window.__VEMOBILE__ = {
    platform: isAndroid ? "android" : isIOS ? "ios" : "unknown",
    isMobile: true,
    version: "0.1.0",
    sendToNative: function (type, data) {
      try {
        window.VemobileBridge &&
          window.VemobileBridge.postMessage(JSON.stringify({ type: type, data: data }));
      } catch (e) {}
    },
    callbacks: {},
    receiveFromNative: function (id, data) {
      var cb = window.__VEMOBILE__.callbacks[id];
      if (cb) cb(data);
    },
    registerCallback: function (type, cb) {
      window.__VEMOBILE__.callbacks[type] = cb;
    },
    callNative: function (method, args) {
      return new Promise(function (resolve, reject) {
        var callId = "nc_" + Date.now() + "_" + Math.random().toString(36).slice(2);
        window.__VEMOBILE__.callbacks[callId] = function (result) {
          delete window.__VEMOBILE__.callbacks[callId];
          if (result && result.error) reject(result.error);
          else resolve(result && result.value);
        };
        window.__VEMOBILE__.sendToNative("bridge", {
          id: callId, method: method, args: args || [],
        });
      });
    },
  };

  // --- Inject viewport meta ---
  var vp = document.querySelector('meta[name="viewport"]');
  if (!vp) {
    vp = document.createElement("meta");
    vp.name = "viewport";
    document.head.appendChild(vp);
  }
  vp.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";

  // --- Override WebRTC / media support detection ---
  // Discord checks for RTCPeerConnection and getUserMedia. WebView may have
  // restricted support. Force-enable to allow call UI to at least attempt.
  var origGUM = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }
  if (!navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia = function (constraints) {
      return new Promise(function (resolve, reject) {
        reject(new Error("Vemobile: getUserMedia not supported in WebView. Try opening in native Discord app for calls."));
      });
    };
  }
  if (!window.RTCPeerConnection) {
    window.RTCPeerConnection = function () {
      throw new Error("Vemobile: WebRTC not supported in this WebView. Voice/video calls require the native Discord app.");
    };
  }
  if (!window.webkitRTCPeerConnection) {
    window.webkitRTCPeerConnection = window.RTCPeerConnection;
  }

  // --- Hook VencordNative setter to patch in mobile APIs ---
  var _vcNative = null;
  Object.defineProperty(window, "VencordNative", {
    get: function () { return _vcNative; },
    set: function (v) {
      _vcNative = v;
      if (_vcNative && _vcNative.native) {
        _vcNative.native.openExternal = function (url) {
          window.__VEMOBILE__.sendToNative("openUrl", { url: url });
        };
      }
      if (_vcNative) {
        _vcNative.mobile = {
          getPlatform: function () { return window.__VEMOBILE__.platform; },
          requestWakeLock: function () { return window.__VEMOBILE__.callNative("requestWakeLock", []); },
          releaseWakeLock: function () { return window.__VEMOBILE__.callNative("releaseWakeLock", []); },
          getDeviceInfo: function () { return window.__VEMOBILE__.callNative("getDeviceInfo", []); },
        };
      }
    },
    configurable: true,
    enumerable: true,
  });

  // --- Inject base mobile layout CSS ---
  // Runs immediately to prevent flash of broken layout
  var baseCSS = document.createElement("style");
  baseCSS.id = "vemobile-base";
  baseCSS.textContent = [
    /* Prevent horizontal overflow everywhere */
    "html, body { width: 100vw !important; max-width: 100vw !important; overflow-x: hidden !important; }",
    /* Force Discord's root to fill and clip */
    "#app-mount { width: 100vw !important; max-width: 100vw !important; overflow-x: hidden !important; }",
    /* Make the app layer fill viewport */
    '[class*="app"] { width: 100vw !important; max-width: 100vw !important; }',
    /* Base content should not overflow */
    '[class*="base"] { min-width: 0 !important; width: 100% !important; max-width: 100% !important; }',
    '[class*="content"] { min-width: 0 !important; max-width: 100% !important; }',
    /* Hide server list on narrow screens by default */
    '[class*="guilds"] { width: 0 !important; min-width: 0 !important; overflow: hidden !important; }',
    /* Hide member list by default */
    '[class*="membersWrap"] { display: none !important; }',
    '[class*="members"] { display: none !important; }',
    /* Chat area takes full width */
    '[class*="chat"] { flex: 1 !important; min-width: 0 !important; width: auto !important; }',
    /* Messages area */
    '[class*="messagesWrapper"] { width: 100% !important; max-width: 100% !important; }',
    /* Fix login page */
    '[class*="authBox"] { width: 90vw !important; max-width: 420px !important; margin: 0 auto !important; }',
    '[class*="authBox"] form { width: 100% !important; }',
    '[class*="authBox"] input { width: 100% !important; box-sizing: border-box !important; font-size: 16px !important; }',
    /* Remove any min-width on containers */
    '[class*="container"] { min-width: 0 !important; }',
    '[class*="layer"] { min-width: 0 !important; }',
    /* Fix all scrollers */
    '[class*="scroller"] { -webkit-overflow-scrolling: touch !important; overscroll-behavior: contain !important; max-width: 100% !important; }',
    /* Modals should fit screen */
    '[class*="modal"] { max-width: 100vw !important; max-height: 100vh !important; overflow-y: auto !important; }',
    '[class*="root"] { max-width: 100vw !important; }',
    /* Fix SVG/icon contention */
    "svg { max-width: 100% !important; }",
    "img { max-width: 100% !important; }",
    /* Hide download app banners */
    '[class*="mobileWebRTCBanner"], [class*="getAppBanner"], [class*="mobileBanner"] { display: none !important; }',
    /* Fix message input bar at bottom */
    '[class*="channelTextArea"] { margin: 0 !important; }',
    '[class*="form"] { position: sticky !important; bottom: 0 !important; }',
    /* Safe area padding */
    ":root {",
    "  --safe-top: env(safe-area-inset-top, 0px);",
    "  --safe-bottom: env(safe-area-inset-bottom, 0px);",
    "  --safe-left: env(safe-area-inset-left, 0px);",
    "  --safe-right: env(safe-area-inset-right, 0px);",
    "}",
    "#app-mount {",
    "  padding-top: var(--safe-top) !important;",
    "  padding-bottom: var(--safe-bottom) !important;",
    "  padding-left: var(--safe-left) !important;",
    "  padding-right: var(--safe-right) !important;",
    "}",
    /* Text input sizing - prevent iOS zoom */
    'textarea, input[type="text"], input[type="email"], input[type="password"], [contenteditable] { font-size: 16px !important; }',
    /* Larger touch targets */
    '[role="button"], button, [class*="clickable"] { min-height: 44px !important; min-width: 44px !important; }',
    /* Fix popout/menu positioning */
    '[class*="popout"], [class*="menu"] { max-width: 90vw !important; }',
    /* Fix long words breaking layout */
    '* { word-wrap: break-word !important; overflow-wrap: break-word !important; }',
    /* Fix account panel at bottom */
    '[class*="panels"] { width: 100% !important; }',
    /* Fix server channel list when visible */
    '.vemobile-show-channels [class*="sidebar"] { display: flex !important; width: 70vw !important; max-width: 300px !important; }',
    '.vemobile-show-channels [class*="chat"] { display: none !important; }',
    /* Fix server list when visible */
    '.vemobile-show-guilds [class*="guilds"] { width: 72px !important; min-width: 72px !important; overflow: visible !important; }',
    /* Bottom nav bar */
    ".vemobile-nav {",
    "  position: fixed; bottom: 0; left: 0; right: 0; z-index: 10000;",
    "  display: flex; justify-content: space-around; align-items: center;",
    "  height: 50px; background: #1e1f22; border-top: 1px solid #2b2d31;",
    "  padding-bottom: var(--safe-bottom);",
    "}",
    ".vemobile-nav button {",
    "  flex: 1; height: 100%; border: none; background: none; color: #949ba4;",
    "  font-size: 11px; display: flex; flex-direction: column; align-items: center; justify-content: center;",
    "  padding: 4px; cursor: pointer;",
    "}",
    ".vemobile-nav button.active { color: #5865f2; }",
    ".vemobile-nav button svg { width: 24px; height: 24px; margin-bottom: 2px; }",
    /* Push content above nav bar */
    '[class*="app"] { padding-bottom: 50px !important; }',
  ].join("\n");
  document.head.appendChild(baseCSS);

  console.log("[Vemobile] Prelude loaded. Platform:", window.__VEMOBILE__.platform);
})();

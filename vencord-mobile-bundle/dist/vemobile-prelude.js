/**
 * Vemobile Prelude — Runs before Vencord bundle
 * Detects mobile environment and sets up hooks for the Vencord bundle.
 */
(function () {
  // Detect mobile WebView
  var ua = navigator.userAgent || "";
  var isAndroid = /Android/i.test(ua);
  var isIOS = /iPhone|iPad|iPod/i.test(ua);
  var isMobileWebView = isAndroid || isIOS;

  window.__VEMOBILE__ = {
    platform: isAndroid ? "android" : isIOS ? "ios" : "unknown",
    isMobile: isMobileWebView,
    version: "0.1.0",

    // Bridge to Flutter (postMessage to WebView host)
    sendToNative: function (type, data) {
      try {
        window.VemobileBridge &&
          window.VemobileBridge.postMessage(JSON.stringify({ type: type, data: data }));
      } catch (e) {
        console.warn("[Vemobile] Failed to send to native:", e);
      }
    },

    // Callbacks registered by native side
    callbacks: {},

    // Called by native to invoke a JS callback
    receiveFromNative: function (id, data) {
      var cb = window.__VEMOBILE__.callbacks[id];
      if (cb) cb(data);
    },

    // Register a callback for native to call
    registerCallback: function (type, cb) {
      window.__VEMOBILE__.callbacks[type] = cb;
    },

    // Promise-based call to native
    callNative: function (method, args) {
      return new Promise(function (resolve, reject) {
        var callId = "nc_" + Date.now() + "_" + Math.random().toString(36).slice(2);
        window.__VEMOBILE__.callbacks[callId] = function (result) {
          delete window.__VEMOBILE__.callbacks[callId];
          if (result && result.error) reject(result.error);
          else resolve(result && result.value);
        };
        window.__VEMOBILE__.sendToNative("bridge", {
          id: callId,
          method: method,
          args: args || [],
        });
      });
    },
  };

  // Hook into VencordNative setter to patch it
  var _origDescriptor = Object.getOwnPropertyDescriptor(window, "VencordNative");
  var _vcNative = null;
  Object.defineProperty(window, "VencordNative", {
    get: function () {
      return _vcNative;
    },
    set: function (v) {
      _vcNative = v;
      // Patch in mobile-specific methods
      if (_vcNative) {
        // Override openExternal to use mobile bridge
        var origOpenExternal = _vcNative.native && _vcNative.native.openExternal;
        if (_vcNative.native) {
          _vcNative.native.openExternal = function (url) {
            window.__VEMOBILE__.sendToNative("openUrl", { url: url });
          };
        }

        // Add mobile-specific APIs
        _vcNative.mobile = {
          getPlatform: function () {
            return window.__VEMOBILE__.platform;
          },
          requestWakeLock: function () {
            return window.__VEMOBILE__.callNative("requestWakeLock", []);
          },
          releaseWakeLock: function () {
            return window.__VEMOBILE__.callNative("releaseWakeLock", []);
          },
          registerPushToken: function (token) {
            return window.__VEMOBILE__.callNative("registerPushToken", [token]);
          },
          getDeviceInfo: function () {
            return window.__VEMOBILE__.callNative("getDeviceInfo", []);
          },
        };
      }
    },
    configurable: true,
    enumerable: true,
  });

  console.log("[Vemobile] Prelude loaded. Platform:", window.__VEMOBILE__.platform);
})();

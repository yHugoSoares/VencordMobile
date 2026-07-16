/**
 * Vemobile Prelude v0.4.0
 *
 * Minimal prelude — Discord's mobile web app handles layout.
 * Adds: bridge, WebRTC stubs, VencordNative proxy, bottom nav,
 * floating back button (SPA-aware), keyboard handling.
 */
(function () {
  var ua = navigator.userAgent || "";
  var isAndroid = /Android/i.test(ua);

  window.__VEMOBILE__ = {
    platform: isAndroid ? "android" : "ios",
    version: "0.4.0",
    sendToNative: function (t, d) {
      try { window.VemobileBridge && window.VemobileBridge.postMessage(JSON.stringify({ type: t, data: d })); } catch (e) {}
    },
    callbacks: {},
    receiveFromNative: function (id, data) {
      var cb = window.__VEMOBILE__.callbacks[id];
      if (cb) cb(data);
    },
    callNative: function (method, args) {
      return new Promise(function (resolve, reject) {
        var id = "nc_" + Date.now() + "_" + Math.random().toString(36).slice(2);
        window.__VEMOBILE__.callbacks[id] = function (r) {
          delete window.__VEMOBILE__.callbacks[id];
          r && r.error ? reject(r.error) : resolve(r && r.value);
        };
        window.__VEMOBILE__.sendToNative("bridge", { id: id, method: method, args: args || [] });
      });
    },
    // Called by native to update back button visibility
    _updateBackState: function (canGoBack) {},
  };

  // ── Viewport ──
  if (!document.querySelector('meta[name="viewport"]')) {
    var vp = document.createElement("meta");
    vp.name = "viewport";
    vp.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";
    document.head.appendChild(vp);
  }

  // ── WebRTC stubs ──
  if (!navigator.mediaDevices) navigator.mediaDevices = {};
  if (!navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia = function () { return Promise.reject(new Error("WebView")); };
  }
  if (!navigator.mediaDevices.enumerateDevices) {
    navigator.mediaDevices.enumerateDevices = function () { return Promise.resolve([]); };
  }
  if (!window.RTCPeerConnection) {
    window.RTCPeerConnection = function () { throw new Error("WebRTC not available"); };
  }

  // ── VencordNative proxy ──
  function wrap(obj) {
    return new Proxy(obj, {
      set: function (t, k, v) {
        if (k === "native" && v && typeof v === "object") {
          v.openExternal = function (url) { window.__VEMOBILE__.sendToNative("openUrl", { url: url }); };
        }
        t[k] = v; return true;
      },
      get: function (t, k) {
        if (k === "mobile") {
          return {
            getPlatform: function () { return window.__VEMOBILE__.platform; },
            requestWakeLock: function () { return window.__VEMOBILE__.callNative("requestWakeLock", []); },
            releaseWakeLock: function () { return window.__VEMOBILE__.callNative("releaseWakeLock", []); },
          };
        }
        return t[k];
      },
    });
  }
  var store = {};
  Object.defineProperty(window, "VencordNative", {
    get: function () { return store._p || store; },
    set: function (v) { store._p = wrap(v); },
    configurable: true, enumerable: true,
  });

  // ═══════════════════════════════════════════════
  // CSS
  // ═══════════════════════════════════════════════
  var CSS = document.createElement("style");
  CSS.id = "vemobile-base";
  CSS.textContent = [
    "html,body{overflow-x:hidden}",

    // Safe areas — respect device insets (status bar, notch, home indicator)
    "#app-mount{padding-top:env(safe-area-inset-top,0);padding-bottom:calc(48px + env(safe-area-inset-bottom,0));padding-left:env(safe-area-inset-left,0);padding-right:env(safe-area-inset-right,0)}",

    // Hide Discord's "download the app" banners
    '[class*=mobileBanner],[class*=getAppBanner],[class*=downloadApp]{display:none!important}',

    // Touch targets (16px font prevents iOS zoom)
    "textarea,input,[contenteditable],input[type=text],input[type=email],input[type=password]{font-size:16px!important}",

    // Smooth scroll
    '[class*=scroller]{-webkit-overflow-scrolling:touch!important}',

    // ── Floating back button (top-left, below safe area) ──
    ".vemobile-back-btn{",
    "  display:none;position:fixed;top:calc(env(safe-area-inset-top,0) + 4px);left:8px;z-index:10001;",
    "  width:40px;height:40px;border-radius:50%;border:none;",
    "  background:rgba(30,31,34,0.9);color:#fff;",
    "  font-size:22px;line-height:40px;text-align:center;cursor:pointer;",
    "  box-shadow:0 2px 8px rgba(0,0,0,0.3);",
    "}",
    // Show when navigated into a sub-page
    ".vemobile-back-btn.visible{display:block}",
    // Keyboard hides the back button too
    ".vemobile-keyboard-open .vemobile-back-btn{display:none!important}",

    // ── Bottom nav ──
    ".vemobile-nav{position:fixed;bottom:0;left:0;right:0;z-index:10000;display:flex;justify-content:space-around;align-items:center;height:48px;background:#1e1f22;border-top:1px solid #2b2d31;padding-bottom:env(safe-area-inset-bottom,0)}",
    ".vemobile-nav button{flex:1;height:100%;border:none;background:none;color:#949ba4;font-size:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2px;cursor:pointer;gap:1px}",
    ".vemobile-nav button.active{color:#5865f2}",
    ".vemobile-nav button svg{width:22px;height:22px}",
    ".vemobile-keyboard-open .vemobile-nav{display:none!important}",
    ".vemobile-nav button.vemobile-back-highlight{color:#f04747}",
  ].join("\n");
  document.head.appendChild(CSS);

  // ═══════════════════════════════════════════════
  // Floating back button — tracks SPA navigation
  // ═══════════════════════════════════════════════
  var backBtn = null;
  function createBackBtn() {
    if (backBtn) return;
    backBtn = document.createElement("button");
    backBtn.className = "vemobile-back-btn";
    backBtn.innerHTML = "←";
    backBtn.title = "Go back";
    backBtn.onclick = function () {
      // Try browser back first, then fallback to Discord home
      if (history.length > 1) {
        history.back();
      } else {
        location.hash = "#/channels/@me";
      }
    };
    document.body.appendChild(backBtn);
    updateBackVisibility();
  }

  // Show/hide based on whether we're on a sub-page (not root)
  function updateBackVisibility() {
    if (!backBtn) return;
    // Consider "deeper" if:
    // 1. Hash has a channel ID (snowflake: 17+ digits)
    // 2. Or hash has /channels/ and more path after @me
    // 3. Or we're on a settings/guild-discovery/etc page
    var hash = location.hash;
    var isDeep = (
      /\d{17,}/.test(hash) ||                         // Channel/DM snowflake
      /channels\/\d{17,}\//.test(hash) ||             // Server channel
      /\/settings\b/.test(hash) ||                    // Settings page
      /\/store\b/.test(hash) ||                       // Store
      /\/discovery\b/.test(hash) ||                   // Discovery
      /\/guild-discovery\b/.test(hash)                // Guild discovery
    );
    backBtn.classList.toggle("visible", isDeep);

    // Also highlight the Home button in nav when we need a back button
    var homeBtn = document.getElementById("vemobile-btn-home");
    if (homeBtn) homeBtn.classList.toggle("vemobile-back-highlight", isDeep);
  }

  // Listen for navigation changes
  window.addEventListener("popstate", updateBackVisibility);
  window.addEventListener("hashchange", updateBackVisibility);
  // Override pushState/replaceState to detect SPA nav
  var _push = history.pushState;
  var _replace = history.replaceState;
  history.pushState = function () { _push.apply(this, arguments); setTimeout(updateBackVisibility, 50); };
  history.replaceState = function () { _replace.apply(this, arguments); setTimeout(updateBackVisibility, 50); };

  // ── Bottom nav ──
  function createNav() {
    if (document.querySelector(".vemobile-nav")) return;
    var nav = document.createElement("div");
    nav.className = "vemobile-nav";
    nav.innerHTML = [
      '<button id="vemobile-btn-home"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg><span>Home</span></button>',
      '<button id="vemobile-btn-back"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg><span>Back</span></button>',
      '<button id="vemobile-btn-refresh"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg><span>Refresh</span></button>',
      '<button id="vemobile-btn-settings"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L3.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg><span>Settings</span></button>',
    ].join("");
    document.body.appendChild(nav);

    function hl(id) {
      nav.querySelectorAll("button").forEach(function (b) { b.classList.remove("active"); });
      var x = document.getElementById(id);
      if (x) x.classList.add("active");
    }

    // Home: navigate to Discord's home
    document.getElementById("vemobile-btn-home").onclick = function () {
      hl("vemobile-btn-home");
      location.hash = "#/channels/@me";
    };

    // Back: same as browser back or floating back button
    document.getElementById("vemobile-btn-back").onclick = function () {
      hl("vemobile-btn-back");
      if (history.length > 1) history.back();
      else location.hash = "#/channels/@me";
    };

    document.getElementById("vemobile-btn-refresh").onclick = function () {
      location.reload();
    };

    document.getElementById("vemobile-btn-settings").onclick = function () {
      hl("vemobile-btn-settings");
      setTimeout(function () {
        // Try Vencord settings first
        if (window.Vencord && window.Vencord.Api && window.Vencord.Api.Settings && window.Vencord.Api.Settings.open) {
          window.Vencord.Api.Settings.open();
        } else {
          var b = document.querySelector('[aria-label="User Settings"],[aria-label="Open Settings"]');
          if (b) b.click();
        }
      }, 200);
    };

    // Show Home as active initially
    hl("vemobile-btn-home");
  }

  // ── Keyboard ──
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () {
      document.body.classList.toggle("vemobile-keyboard-open",
        window.visualViewport.height < window.innerHeight * 0.8);
    });
  }

  // ── Call alert interception ──
  var oa = window.alert;
  window.alert = function (m) {
    if (typeof m === "string" && /voice|video|call|rtc|webrtc|getusermedia|microphone|camera|not (support|available|work)/i.test(m)) {
      window.__VEMOBILE__.sendToNative("callUnsupported", { message: m });
      return;
    }
    return oa.apply(this, arguments);
  };

  // ── Bootstrap ──
  setTimeout(function () {
    createNav();
    createBackBtn();
    // Initial check
    setTimeout(updateBackVisibility, 500);
    console.log("[Vemobile] Prelude v0.4.0 loaded");
  }, 500);
})();

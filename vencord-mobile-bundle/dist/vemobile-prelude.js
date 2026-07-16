/**
 * Vemobile Prelude v0.4.2
 *
 * Minimal prelude — Discord's mobile web app handles layout.
 * Adds: bridge, WebRTC stubs + browser check override, VencordNative proxy,
 * bottom nav (hidden on login), floating back button, keyboard handling.
 */
(function () {
  var ua = navigator.userAgent || "";
  var isAndroid = /Android/i.test(ua);

  window.__VEMOBILE__ = {
    platform: isAndroid ? "android" : "ios",
    version: "0.4.2",
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
  };

  // ── Viewport ──
  if (!document.querySelector('meta[name="viewport"]')) {
    var vp = document.createElement("meta");
    vp.name = "viewport";
    vp.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";
    document.head.appendChild(vp);
  }

  // ── WebRTC stubs — complete prototypes so Discord's browser check passes ──
  if (!navigator.mediaDevices) navigator.mediaDevices = {};

  // getUserMedia — reject so call doesn't actually start (WebView has no mic/camera)
  if (!navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia = function () {
      return Promise.reject(new DOMException("NotAllowedError", "NotAllowedError"));
    };
  }

  // enumerateDevices — return empty list
  if (!navigator.mediaDevices.enumerateDevices) {
    navigator.mediaDevices.enumerateDevices = function () { return Promise.resolve([]); };
  }

  // getSupportedConstraints — return empty object
  if (!navigator.mediaDevices.getSupportedConstraints) {
    navigator.mediaDevices.getSupportedConstraints = function () { return {}; };
  }

  // RTCPeerConnection — full prototype so Discord sees a "real" implementation
  if (!window.RTCPeerConnection) {
    var RTCStub = {};
    RTCStub.createOffer = function () { return Promise.resolve({ sdp: "", type: "offer" }); };
    RTCStub.createAnswer = function () { return Promise.resolve({ sdp: "", type: "answer" }); };
    RTCStub.setLocalDescription = function () { return Promise.resolve(); };
    RTCStub.setRemoteDescription = function () { return Promise.resolve(); };
    RTCStub.addIceCandidate = function () { return Promise.resolve(); };
    RTCStub.addTrack = function () {};
    RTCStub.removeTrack = function () {};
    RTCStub.close = function () {};
    RTCStub.getStats = function () { return Promise.resolve(new Map()); };
    RTCStub.getSenders = function () { return []; };
    RTCStub.getReceivers = function () { return []; };
    RTCStub.getLocalStreams = function () { return []; };
    RTCStub.getRemoteStreams = function () { return []; };

    window.RTCPeerConnection = function () {
      this.createOffer = RTCStub.createOffer;
      this.createAnswer = RTCStub.createAnswer;
      this.setLocalDescription = RTCStub.setLocalDescription;
      this.setRemoteDescription = RTCStub.setRemoteDescription;
      this.addIceCandidate = RTCStub.addIceCandidate;
      this.addTrack = RTCStub.addTrack;
      this.removeTrack = RTCStub.removeTrack;
      this.close = RTCStub.close;
      this.getStats = RTCStub.getStats;
      this.getSenders = RTCStub.getSenders;
      this.getReceivers = RTCStub.getReceivers;
      this.getLocalStreams = RTCStub.getLocalStreams;
      this.getRemoteStreams = RTCStub.getRemoteStreams;
      this.localDescription = null;
      this.remoteDescription = null;
      this.signalingState = "stable";
      this.iceConnectionState = "new";
      this.connectionState = "new";
      this.ontrack = null;
      this.onicecandidate = null;
      this.oniceconnectionstatechange = null;
    };
    window.RTCPeerConnection.prototype = RTCStub;
  }

  if (!window.webkitRTCPeerConnection) {
    window.webkitRTCPeerConnection = window.RTCPeerConnection;
  }

  // RTCSessionDescription / RTCIceCandidate — Discord may check these exist
  if (!window.RTCSessionDescription) {
    window.RTCSessionDescription = function (desc) {
      this.type = (desc && desc.type) || "offer";
      this.sdp = (desc && desc.sdp) || "";
    };
  }
  if (!window.RTCIceCandidate) {
    window.RTCIceCandidate = function (cand) {
      this.candidate = (cand && cand.candidate) || "";
      this.sdpMLineIndex = (cand && cand.sdpMLineIndex) || 0;
      this.sdpMid = (cand && cand.sdpMid) || "";
    };
  }

  // MediaStream — full prototype
  if (!window.MediaStream) {
    window.MediaStream = function () {
      this.id = "vemobile-fake-stream";
      this.active = false;
    };
    window.MediaStream.prototype = {
      getTracks: function () { return []; },
      getAudioTracks: function () { return []; },
      getVideoTracks: function () { return []; },
      addTrack: function () {},
      removeTrack: function () {},
      getTrackById: function () { return null; },
    };
  }

  // MediaStreamTrack
  if (!window.MediaStreamTrack) {
    window.MediaStreamTrack = function () {
      this.kind = "audio";
      this.enabled = false;
      this.readyState = "ended";
      this.id = "vemobile-fake-track";
    };
    window.MediaStreamTrack.prototype = {
      stop: function () {},
      clone: function () { return new window.MediaStreamTrack(); },
      applyConstraints: function () { return Promise.resolve(); },
    };
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
    // No overflow-x:hidden on html! It blocks Discord's side-swipe.
    // Only prevent overflow on #app-mount.
    "#app-mount{overflow-x:hidden}",

    // Safe areas
    "#app-mount{padding-top:env(safe-area-inset-top,0);padding-bottom:calc(48px + env(safe-area-inset-bottom,0));padding-left:env(safe-area-inset-left,0);padding-right:env(safe-area-inset-right,0)}",

    // Hide Discord's "download the app" banners
    '[class*=mobileBanner],[class*=getAppBanner],[class*=downloadApp]{display:none!important}',

    // Touch targets
    "textarea,input,[contenteditable],input[type=text],input[type=email],input[type=password]{font-size:16px!important}",

    // Smooth scroll
    '[class*=scroller]{-webkit-overflow-scrolling:touch!important}',

    // Fix menus/popups/modals going off-screen
    '[class*=modal],[class*=popout],[class*=menu],[class*=tooltip],[class*=layerContainer],[class*=layer]{max-width:100vw!important;max-height:90vh!important}',

    // ── Floating back button ──
    ".vemobile-back-btn{",
    "  display:none;position:fixed;top:calc(env(safe-area-inset-top,0) + 4px);left:8px;z-index:10001;",
    "  width:40px;height:40px;border-radius:50%;border:none;",
    "  background:rgba(30,31,34,0.9);color:#fff;",
    "  font-size:22px;line-height:40px;text-align:center;cursor:pointer;",
    "  box-shadow:0 2px 8px rgba(0,0,0,0.3);",
    "}",
    ".vemobile-back-btn.visible{display:block}",
    ".vemobile-keyboard-open .vemobile-back-btn{display:none!important}",

    // ── Bottom nav (hidden on login/auth pages) ──
    ".vemobile-nav{position:fixed;bottom:0;left:0;right:0;z-index:10000;display:flex;justify-content:space-around;align-items:center;height:48px;background:#1e1f22;border-top:1px solid #2b2d31;padding-bottom:env(safe-area-inset-bottom,0)}",
    ".vemobile-nav button{flex:1;height:100%;border:none;background:none;color:#949ba4;font-size:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2px;cursor:pointer;gap:1px}",
    ".vemobile-nav button.active{color:#5865f2}",
    ".vemobile-nav button svg{width:22px;height:22px}",
    ".vemobile-keyboard-open .vemobile-nav{display:none!important}",
    ".vemobile-nav button.vemobile-back-highlight{color:#f04747}",

    // Hide nav on login/auth screens
    ".vemobile-nav.vemobile-hidden{display:none!important}",
    "#app-mount.vemobile-no-nav{padding-bottom:env(safe-area-inset-bottom,0)!important}",

    // Don't override touch-action — let Discord handle all gestures natively.
  ].join("\n");
  document.head.appendChild(CSS);

  // ═══════════════════════════════════════════════
  // Login detection — hide nav on auth pages
  // ═══════════════════════════════════════════════
  function isLoginPage() {
    var h = location.hash || "";
    var p = location.pathname || "";
    return (
      p.indexOf("/login") >= 0 ||
      /\/register\b/.test(p) ||
      /\/verify\b/.test(p) ||
      /\/authenticator\b/.test(p) ||
      /\/mfa\b/.test(p) ||
      /\/sms\b/.test(p) ||
      /\/backup\b/.test(p) ||
      /^\/$/.test(p) ||
      (p === "/app" && !h) // Just loaded /app but not logged in yet
    );
  }

  function updateNavVisibility() {
    var nav = document.querySelector(".vemobile-nav");
    var app = document.getElementById("app-mount");
    if (!nav) return;
    if (isLoginPage()) {
      nav.classList.add("vemobile-hidden");
      if (app) app.classList.add("vemobile-no-nav");
    } else {
      nav.classList.remove("vemobile-hidden");
      if (app) app.classList.remove("vemobile-no-nav");
    }
  }

  // Check on hash/path changes and periodically
  window.addEventListener("hashchange", updateNavVisibility);
  window.addEventListener("popstate", updateNavVisibility);
  var _push = history.pushState;
  history.pushState = function () { _push.apply(this, arguments); setTimeout(updateNavVisibility, 50); };
  var _replace = history.replaceState;
  history.replaceState = function () { _replace.apply(this, arguments); setTimeout(updateNavVisibility, 50); };

  // ═══════════════════════════════════════════════
  // Floating back button
  // ═══════════════════════════════════════════════
  var backBtn = null;
  function createBackBtn() {
    if (backBtn) return;
    backBtn = document.createElement("button");
    backBtn.className = "vemobile-back-btn";
    backBtn.innerHTML = "←";
    backBtn.title = "Go back";
    backBtn.onclick = function () {
      if (history.length > 1) history.back();
      else location.hash = "#/channels/@me";
    };
    document.body.appendChild(backBtn);
    updateBackVisibility();
  }

  function updateBackVisibility() {
    if (!backBtn) return;
    var hash = location.hash;
    var isDeep = (
      /\d{17,}/.test(hash) ||
      /channels\/\d{17,}\//.test(hash) ||
      /\/settings\b/.test(hash) ||
      /\/store\b/.test(hash) ||
      /\/discovery\b/.test(hash) ||
      /\/guild-discovery\b/.test(hash)
    );
    backBtn.classList.toggle("visible", isDeep);
    var homeBtn = document.getElementById("vemobile-btn-home");
    if (homeBtn) homeBtn.classList.toggle("vemobile-back-highlight", isDeep);
  }

  // ═══════════════════════════════════════════════
  // Bottom nav
  // ═══════════════════════════════════════════════
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
      var x = document.getElementById(id); if (x) x.classList.add("active");
    }

    document.getElementById("vemobile-btn-home").onclick = function () { hl("vemobile-btn-home"); location.hash = "#/channels/@me"; };
    document.getElementById("vemobile-btn-back").onclick = function () { hl("vemobile-btn-back"); if (history.length > 1) history.back(); else location.hash = "#/channels/@me"; };
    document.getElementById("vemobile-btn-refresh").onclick = function () { location.reload(); };
    document.getElementById("vemobile-btn-settings").onclick = function () {
      hl("vemobile-btn-settings");
      setTimeout(function () {
        if (window.Vencord && window.Vencord.Api && window.Vencord.Api.Settings && window.Vencord.Api.Settings.open) {
          window.Vencord.Api.Settings.open();
        } else {
          var b = document.querySelector('[aria-label="User Settings"],[aria-label="Open Settings"]');
          if (b) b.click();
        }
      }, 200);
    };

    hl("vemobile-btn-home");
    updateNavVisibility();
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
    setTimeout(updateBackVisibility, 500);
    // Re-check nav visibility after page fully loads
    setInterval(updateNavVisibility, 5000);
    console.log("[Vemobile] Prelude v0.4.2 loaded");
  }, 500);
})();

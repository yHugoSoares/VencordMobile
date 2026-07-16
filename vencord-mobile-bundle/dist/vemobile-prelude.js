/**
 * Vemobile Prelude v0.2.0 — Sprint 1 hardened
 * 
 * Fixes applied:
 * 1.1: Targeted DOM selectors instead of full-tree scan
 * 1.2: Snowflake pattern for URL hash detection
 * 1.3: Keyboard CSS hides nav bar
 * 1.6: Proxy-based VencordNative hook
 * 1.7: Body class (.vemobile-show-members) instead of inline styles
 */
(function () {
  var ua = navigator.userAgent || "";
  window.__VEMOBILE__ = {
    platform: /Android/i.test(ua) ? "android" : /iPhone|iPad|iPod/i.test(ua) ? "ios" : "unknown",
    version: "0.2.0",
    view: "home",
    sendToNative: function (t, d) {
      try { window.VemobileBridge && window.VemobileBridge.postMessage(JSON.stringify({ type: t, data: d })); } catch (e) {}
    },
    callbacks: {},
    receiveFromNative: function (id, data) { var cb = window.__VEMOBILE__.callbacks[id]; if (cb) cb(data); },
    callNative: function (method, args) {
      return new Promise(function (resolve, reject) {
        var id = "nc_" + Date.now() + "_" + Math.random().toString(36).slice(2);
        window.__VEMOBILE__.callbacks[id] = function (r) {
          delete window.__VEMOBILE__.callbacks[id];
          if (r && r.error) reject(r.error); else resolve(r && r.value);
        };
        window.__VEMOBILE__.sendToNative("bridge", { id: id, method: method, args: args || [] });
      });
    },
  };

  // ── Viewport ──
  var vp = document.querySelector('meta[name="viewport"]');
  if (!vp) { vp = document.createElement("meta"); vp.name = "viewport"; document.head.appendChild(vp); }
  vp.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";

  // ── WebRTC override ──
  if (!navigator.mediaDevices) navigator.mediaDevices = {};
  if (!navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia = function () { return Promise.reject(new Error("WebView")); };
  }
  if (!navigator.mediaDevices.enumerateDevices) {
    navigator.mediaDevices.enumerateDevices = function () { return Promise.resolve([]); };
  }
  if (!window.RTCPeerConnection) window.RTCPeerConnection = function () { throw new Error("WebRTC not available"); };

  // ── VencordNative Proxy hook (1.6) ──
  // Proxy intercepts: reads, writes, and reassignments to VencordNative
  function wrapVencordNative(obj) {
    return new Proxy(obj, {
      set: function (target, key, value) {
        if (key === "native" && value && typeof value === "object") {
          // Patch openExternal
          var origOpenExternal = value.openExternal;
          value.openExternal = function (url) {
            window.__VEMOBILE__.sendToNative("openUrl", { url: url });
          };
          // Patch clipboard if present
          if (value.copy) {
            value.copy = function (text) {
              value.copy = function () {};
              var f = document.createElement("textarea"); f.value = text; f.style.cssText = "position:absolute;left:-9999px";
              document.body.appendChild(f); f.select(); document.execCommand("copy"); document.body.removeChild(f);
            };
          }
        }
        target[key] = value;
        return true;
      },
      get: function (target, key) {
        if (key === "mobile") {
          return {
            getPlatform: function () { return window.__VEMOBILE__.platform; },
            requestWakeLock: function () { return window.__VEMOBILE__.callNative("requestWakeLock", []); },
            releaseWakeLock: function () { return window.__VEMOBILE__.callNative("releaseWakeLock", []); },
            getDeviceInfo: function () { return window.__VEMOBILE__.callNative("getDeviceInfo", []); },
          };
        }
        return target[key];
      },
    });
  }

  var _vcStore = {};
  Object.defineProperty(window, "VencordNative", {
    get: function () { return _vcStore._proxy || _vcStore; },
    set: function (val) {
      _vcStore._proxy = wrapVencordNative(val);
    },
    configurable: true,
    enumerable: true,
  });

  // ═══════════════════════════════════════════════
  // CSS (1.3: keyboard rule added)
  // ═══════════════════════════════════════════════

  var CSS = document.createElement("style");
  CSS.id = "vemobile-layout";
  CSS.textContent = [
    "html,body{width:100vw!important;max-width:100vw!important;overflow-x:hidden!important}",
    "#app-mount{width:100vw!important;max-width:100vw!important;overflow:hidden!important}",
    "#app-mount [class*=app]{width:100vw!important;max-width:100vw!important}",
    "*{word-wrap:break-word!important;overflow-wrap:break-word!important}",
    "img,svg{max-width:100%!important}",
    ":root{--safe-top:env(safe-area-inset-top,0px);--safe-bottom:env(safe-area-inset-bottom,0px)}",
    "#app-mount{padding-top:var(--safe-top)!important;padding-bottom:calc(50px + var(--safe-bottom))!important}",
    'textarea,input[type=text],input[type=email],input[type=password],[contenteditable]{font-size:16px!important}',
    '[role=button],button,[class*=clickable]{min-height:44px!important;min-width:44px!important}',
    '[class*=scroller]{-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important}',
    '[class*=mobileBanner],[class*=getAppBanner],[class*=mobileWebRTC]{display:none!important}',
    '[class*=modal]{max-width:100vw!important;max-height:100vh!important;overflow-y:auto!important}',

    // ── Layout states (data-vemobile-*) ──
    '.vemobile-home [data-vemobile-sidebar]{display:flex!important;width:100%!important;flex:1!important;min-width:0!important}',
    '.vemobile-home [data-vemobile-chat]{display:none!important}',
    '.vemobile-home [data-vemobile-members]{display:none!important}',
    '.vemobile-home [data-vemobile-guilds]{display:none!important}',

    '.vemobile-chat [data-vemobile-sidebar]{display:none!important}',
    '.vemobile-chat [data-vemobile-chat]{display:flex!important;width:100%!important;flex:1!important;min-width:0!important}',
    '.vemobile-chat [data-vemobile-members]{display:none!important}',
    '.vemobile-chat [data-vemobile-guilds]{display:none!important}',

    // ── 1.7 Members class toggle ──
    '.vemobile-show-members [data-vemobile-chat]{display:none!important}',
    '.vemobile-show-members [data-vemobile-members]{display:flex!important;width:100%!important;flex:1!important}',
    '.vemobile-show-members [data-vemobile-sidebar]{display:none!important}',

    '.vemobile-guilds [data-vemobile-sidebar]{display:none!important}',
    '.vemobile-guilds [data-vemobile-chat]{display:none!important}',
    '.vemobile-guilds [data-vemobile-members]{display:none!important}',
    '.vemobile-guilds [data-vemobile-guilds]{display:flex!important;width:100%!important;flex:1!important;flex-direction:column!important;overflow-y:auto!important}',

    // ── Back button ──
    ".vemobile-back{display:none;position:fixed;top:var(--safe-top,0);left:0;z-index:9999;padding:8px 16px;background:rgba(30,31,34,0.95);color:#fff;border:none;font-size:14px;cursor:pointer;border-radius:0 0 8px 0;align-items:center;gap:4px}",
    ".vemobile-back svg{width:20px;height:20px}",
    ".vemobile-chat .vemobile-back{display:flex}",

    // ── Bottom nav + 1.3 keyboard hide ──
    ".vemobile-nav{position:fixed;bottom:0;left:0;right:0;z-index:10000;display:flex;justify-content:space-around;align-items:center;height:50px;background:#1e1f22;border-top:1px solid #2b2d31;padding-bottom:var(--safe-bottom)}",
    ".vemobile-nav button{flex:1;height:100%;border:none;background:none;color:#949ba4;font-size:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2px;cursor:pointer;gap:1px}",
    ".vemobile-nav button.active{color:#5865f2}",
    ".vemobile-nav button svg{width:22px;height:22px}",
    ".vemobile-keyboard-open .vemobile-nav{display:none!important}",

    // ── 2.2 View transitions ──
    "[data-vemobile-sidebar],[data-vemobile-chat],[data-vemobile-members]",
    "{transition:opacity 0.15s ease,transform 0.15s ease}",
    ".vemobile-home [data-vemobile-chat]{opacity:0;transform:translateX(20px)}",
    ".vemobile-chat [data-vemobile-sidebar]{opacity:0;transform:translateX(-20px)}",
    ".vemobile-home [data-vemobile-sidebar],.vemobile-chat [data-vemobile-chat]",
    "{opacity:1;transform:translateX(0)}",

    // ── Slide-in effect for chat (from right) ──
    ".vemobile-chat [data-vemobile-chat]{animation:vemobile-slide-in 0.2s ease}",
    "@keyframes vemobile-slide-in{",
    "  from{opacity:0;transform:translateX(30px)}",
    "  to{opacity:1;transform:translateX(0)}",
    "}",

    // ── 3.3 Loading overlay for view transitions ──
    ".vemobile-loading-overlay{",
    "  display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:9998;",
    "  background:rgba(32,34,37,0.8);justify-content:center;align-items:center",
    "}",
    ".vemobile-loading .vemobile-loading-overlay{display:flex}",
    ".vemobile-spinner{",
    "  width:32px;height:32px;border:3px solid #5865f2;border-top-color:transparent;",
    "  border-radius:50%;animation:vemobile-spin 0.6s linear infinite",
    "}",
    "@keyframes vemobile-spin{to{transform:rotate(360deg)}}",
  ].join("\n");
  document.head.appendChild(CSS);

  // ═══════════════════════════════════════════════
  // DOM TAGGING (1.1: targeted selectors)
  // ═══════════════════════════════════════════════

  function tagLayoutElements() {
    var app = document.getElementById("app-mount");
    if (!app) return false;

    // Strategy: find the content row that has sidebar + chat + members as flex children.
    // Look for the element containing both a nav (sidebar) and [class*=messagesWrapper] (chat).

    // Find all elements containing messagesWrapper - the chat area
    var chatContent = app.querySelector('[class*=messagesWrapper]');
    if (!chatContent) return false;

    // Walk up from the chat content to find the flex row container
    // Discord structure: contentWrapper → chat → ... → app-mount
    // The flex row is typically 2-4 levels up
    var chatCandidate = chatContent;
    for (var depth = 0; depth < 8; depth++) {
      chatCandidate = chatCandidate.parentElement;
      if (!chatCandidate || chatCandidate === app) break;

      var cs = getComputedStyle(chatCandidate);
      // Found a flex/grid container with siblings
      if (cs.display === "flex" && chatCandidate.children.length >= 2) {
        // This is likely the chat column. Tag it.
        if (!chatCandidate.hasAttribute("data-vemobile-chat")) {
          chatCandidate.setAttribute("data-vemobile-chat", "true");
        }

        // Look at siblings to find sidebar, guilds, members
        var parent = chatCandidate.parentElement;
        if (parent) {
          for (var j = 0; j < parent.children.length; j++) {
            var sibling = parent.children[j];
            if (sibling === chatCandidate) continue;
            if (sibling.hasAttribute("data-vemobile-sidebar") ||
                sibling.hasAttribute("data-vemobile-guilds") ||
                sibling.hasAttribute("data-vemobile-members")) continue;

            // Check for nav → sidebar
            if (sibling.querySelector('nav') && !sibling.hasAttribute("data-vemobile-sidebar")) {
              sibling.setAttribute("data-vemobile-sidebar", "true");
            }
            // Check for member list content
            else if (sibling.querySelector('[class*=member]') && !sibling.hasAttribute("data-vemobile-members")) {
              sibling.setAttribute("data-vemobile-members", "true");
            }
            // Very narrow = guilds
            else {
              var rect = sibling.getBoundingClientRect();
              if (rect.width > 0 && rect.width <= 100 && !sibling.hasAttribute("data-vemobile-guilds")) {
                sibling.setAttribute("data-vemobile-guilds", "true");
              } else if (!sibling.hasAttribute("data-vemobile-members")) {
                sibling.setAttribute("data-vemobile-members", "true");
              }
            }
          }
        }
        return true;
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════
  // NAVIGATION (1.2: snowflake detection)
  // ═══════════════════════════════════════════════

  function isInChannelHash() {
    var hash = location.hash;
    // Match #/channels/xxx/123456789012345678 or #/channels/@me/123456789012345678
    // Snowflake: 17-19 digit number after the last /
    var match = hash.match(/channels\/(?:@me\/)?(\d{17,19})\b/);
    return !!match;
  }

  var backBtn = null;
  function createBackButton() {
    if (backBtn) return;
    backBtn = document.createElement("button");
    backBtn.className = "vemobile-back";
    backBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg> Back';
    backBtn.onclick = function () { goHome(); };
    document.body.appendChild(backBtn);
  }

  function goHome() {
    showLoading();
    document.body.classList.remove("vemobile-chat", "vemobile-guilds", "vemobile-show-members");
    document.body.classList.add("vemobile-home");
    window.__VEMOBILE__.view = "home";
    highlightNav("channels");
    setTimeout(hideLoading, 200);
  }

  function goToChat() {
    showLoading();
    document.body.classList.remove("vemobile-home", "vemobile-guilds", "vemobile-show-members");
    document.body.classList.add("vemobile-chat");
    window.__VEMOBILE__.view = "chat";
    highlightNav("chat");
    setTimeout(hideLoading, 200);
  }

  function goToGuilds() {
    showLoading();
    document.body.classList.remove("vemobile-home", "vemobile-chat", "vemobile-show-members");
    document.body.classList.add("vemobile-guilds");
    window.__VEMOBILE__.view = "guilds";
    highlightNav("servers");
    setTimeout(hideLoading, 200);
  }

  function showLoading() {
    document.body.classList.add("vemobile-loading");
  }

  function hideLoading() {
    document.body.classList.remove("vemobile-loading");
  }

  function highlightNav(active) {
    var btns = document.querySelectorAll(".vemobile-nav button");
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove("active");
    var b = document.getElementById("vemobile-btn-" + active);
    if (b) b.classList.add("active");
  }

  // ── Navigation detection ──
  function setupNavigationDetection() {
    // 3.1: Replace setInterval with native hashchange event (zero CPU overhead)
    window.addEventListener("hashchange", function () {
      if (isInChannelHash()) goToChat(); else goHome();
    });

    // Sidebar click interception
    document.addEventListener("click", function (e) {
      var sidebar = document.querySelector("[data-vemobile-sidebar]");
      if (sidebar && sidebar.contains(e.target)) {
        var navItem = e.target.closest('a, [class*=item], [class*=link], li[role], [role=link], [role=button]');
        if (navItem) {
          setTimeout(function () {
            if (isInChannelHash()) goToChat();
          }, 200);
        }
      }
      var guilds = document.querySelector("[data-vemobile-guilds]");
      if (guilds && guilds.contains(e.target)) {
        var item = e.target.closest('[class*=guild], [class*=wrapper], [class*=item], [data-list-item-id]');
        if (item) setTimeout(goHome, 200);
      }
    }, true);
  }

  // ── Bottom nav (1.7: class-based members toggle) ──
  var navBar = null;
  function createBottomNav() {
    if (navBar || document.querySelector(".vemobile-nav")) return;
    navBar = document.createElement("div");
    navBar.className = "vemobile-nav";
    navBar.innerHTML = [
      '<button id="vemobile-btn-servers"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg><span>Servers</span></button>',
      '<button id="vemobile-btn-channels" class="active"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg><span>Chat</span></button>',
      '<button id="vemobile-btn-members"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg><span>Members</span></button>',
      '<button id="vemobile-btn-settings"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L3.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg><span>Settings</span></button>',
    ].join("");
    document.body.appendChild(navBar);

    document.getElementById("vemobile-btn-servers").onclick = goToGuilds;
    document.getElementById("vemobile-btn-channels").onclick = goHome;
    document.getElementById("vemobile-btn-members").onclick = function () {
      // 1.7: Use body class instead of inline styles
      if (document.body.classList.contains("vemobile-show-members")) {
        goHome();
      } else {
        document.body.classList.remove("vemobile-chat", "vemobile-guilds", "vemobile-home");
        document.body.classList.add("vemobile-show-members");
        highlightNav("members");
      }
    };
    document.getElementById("vemobile-btn-settings").onclick = function () {
      goHome();
      setTimeout(function () {
        // Try Vencord settings first, fall back to Discord settings
        if (window.Vencord && window.Vencord.Api) {
          var btn = document.querySelector('[aria-label="Open Settings"],[aria-label="User Settings"]');
          if (btn) btn.click();
        }
      }, 300);
    };
  }

  // ── Swipe ──
  var tsx = 0, tsy = 0, tm = false;
  document.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return;
    tsx = e.touches[0].clientX; tsy = e.touches[0].clientY; tm = false;
  }, { passive: true });
  document.addEventListener("touchmove", function (e) { tm = true; }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (!tm) return;
    var dx = e.changedTouches[0].clientX - tsx;
    var dy = e.changedTouches[0].clientY - tsy;
    if (Math.abs(dx) <= Math.abs(dy) || Math.abs(dx) < 80) return;
    if (dx > 0 && tsx < 50 && (window.__VEMOBILE__.view === "chat" || document.body.classList.contains("vemobile-show-members"))) {
      goHome();
    }
  }, { passive: true });

  // ── Keyboard (1.3: hides nav via CSS, just toggles class) ──
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () {
      document.body.classList.toggle("vemobile-keyboard-open", window.visualViewport.height < window.innerHeight * 0.8);
    });
  }

  // ── Call interception ──
  var origAlert = window.alert;
  window.alert = function (msg) {
    if (typeof msg === "string" && /voice|video|call|not (?:support|available|work|compatible)|RTC|getUserMedia|microphone|camera/i.test(msg)) {
      window.__VEMOBILE__.sendToNative("callUnsupported", { message: msg });
      return;
    }
    return origAlert.apply(this, arguments);
  };

  // ── Bootstrap ──
  function bootstrap() {
    createBottomNav();
    createBackButton();

    // 3.3: Create loading overlay
    var overlay = document.createElement("div");
    overlay.className = "vemobile-loading-overlay";
    overlay.innerHTML = '<div class="vemobile-spinner"></div>';
    document.body.appendChild(overlay);

    var tagged = tagLayoutElements();
    setupNavigationDetection();

    if (!tagged) {
      var retries = 0;
      var retry = setInterval(function () {
        if (tagLayoutElements() || ++retries > 30) clearInterval(retry);
      }, 500);
    }

    if (isInChannelHash()) goToChat(); else goHome();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(bootstrap, 1000); });
  } else {
    setTimeout(bootstrap, 1000);
  }

  console.log("[Vemobile] Prelude v0.2.0 loaded (sprint 1)");
})();

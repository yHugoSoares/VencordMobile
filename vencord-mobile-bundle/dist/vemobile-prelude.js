/**
 * Vemobile Prelude — Base CSS + Viewport + Navigation Engine
 * Creates a native-like mobile UI from Discord's desktop web app.
 *
 * Pattern: Sidebar-as-home, chat-slides-in, back-button-to-return.
 * Uses JavaScript DOM tagging (data attributes) for reliable CSS targeting.
 */
(function () {
  var ua = navigator.userAgent || "";
  window.__VEMOBILE__ = {
    platform: /Android/i.test(ua) ? "android" : /iPhone|iPad|iPod/i.test(ua) ? "ios" : "unknown",
    isMobile: true,
    version: "0.1.2",
    view: "home", // "home" | "chat"
    sendToNative: function (t, d) {
      try { window.VemobileBridge && window.VemobileBridge.postMessage(JSON.stringify({ type: t, data: d })); } catch (e) {}
    },
    callbacks: {},
    receiveFromNative: function (id, data) { var cb = window.__VEMOBILE__.callbacks[id]; if (cb) cb(data); },
    callNative: function (method, args) {
      return new Promise(function (resolve, reject) {
        var id = "nc_" + Date.now() + "_" + Math.random().toString(36).slice(2);
        window.__VEMOBILE__.callbacks[id] = function (r) { delete window.__VEMOBILE__.callbacks[id]; r && r.error ? reject(r.error) : resolve(r && r.value); };
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
  if (!window.RTCPeerConnection) window.RTCPeerConnection = function () { throw new Error("WebRTC not available"); };
  if (!window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = window.RTCPeerConnection;

  // ── VencordNative hook ──
  var _vcNative = null;
  Object.defineProperty(window, "VencordNative", {
    get: function () { return _vcNative; },
    set: function (v) {
      _vcNative = v;
      if (_vcNative && _vcNative.native) {
        _vcNative.native.openExternal = function (url) { window.__VEMOBILE__.sendToNative("openUrl", { url: url }); };
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
    configurable: true, enumerable: true,
  });

  // ═══════════════════════════════════════════════
  // MOBILE LAYOUT ENGINE
  // ═══════════════════════════════════════════════

  var CSS = document.createElement("style");
  CSS.id = "vemobile-layout";
  CSS.textContent = [
    // ── Global ──
    "html,body{width:100vw!important;max-width:100vw!important;overflow-x:hidden!important}",
    "#app-mount{width:100vw!important;max-width:100vw!important;overflow:hidden!important}",
    "#app-mount [class*=app]{width:100vw!important;max-width:100vw!important}",
    "*{word-wrap:break-word!important;overflow-wrap:break-word!important}",
    "img,svg{max-width:100%!important}",

    // ── Safe areas ──
    ":root{--safe-top:env(safe-area-inset-top,0px);--safe-bottom:env(safe-area-inset-bottom,0px)}",
    "#app-mount{padding-top:var(--safe-top)!important;padding-bottom:calc(50px + var(--safe-bottom))!important}",

    // ── Text inputs not tiny on iOS ──
    'textarea,input[type=text],input[type=email],input[type=password],[contenteditable]{font-size:16px!important}',

    // ── Touch targets ──
    '[role=button],button,[class*=clickable]{min-height:44px!important;min-width:44px!important}',

    // ── Smooth scrolling ──
    '[class*=scroller]{-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important}',

    // ── Hide Discord banners ──
    '[class*=mobileBanner],[class*=getAppBanner],[class*=mobileWebRTC]{display:none!important}',

    // ── Modals fit screen ──
    '[class*=modal]{max-width:100vw!important;max-height:100vh!important;overflow-y:auto!important}',

    // ═══ LAYOUT STATES ═══
    // All columns except the active one are hidden via CSS.
    // We use data-vemobile-* attributes set by JS.

    // ── HOME: show sidebar (channel list), hide chat & members ──
    '.vemobile-home [data-vemobile-sidebar]{display:flex!important;width:100%!important;flex:1!important;min-width:0!important}',
    '.vemobile-home [data-vemobile-chat]{display:none!important}',
    '.vemobile-home [data-vemobile-members]{display:none!important}',
    '.vemobile-home [data-vemobile-guilds]{display:none!important}',

    // ── CHAT: show chat, hide sidebar & members ──
    '.vemobile-chat [data-vemobile-sidebar]{display:none!important}',
    '.vemobile-chat [data-vemobile-chat]{display:flex!important;width:100%!important;flex:1!important;min-width:0!important}',
    '.vemobile-chat [data-vemobile-members]{display:none!important}',
    '.vemobile-chat [data-vemobile-guilds]{display:none!important}',

    // ── GUILDS: show guild list, hide everything else ──
    '.vemobile-guilds [data-vemobile-sidebar]{display:none!important}',
    '.vemobile-guilds [data-vemobile-chat]{display:none!important}',
    '.vemobile-guilds [data-vemobile-members]{display:none!important}',
    '.vemobile-guilds [data-vemobile-guilds]{display:flex!important;width:100%!important;flex:1!important;flex-direction:column!important;overflow-y:auto!important}',

    // ── Back button in chat view ──
    ".vemobile-back{display:none;position:fixed;top:var(--safe-top,0);left:0;z-index:9999;padding:8px 16px;background:rgba(30,31,34,0.95);color:#fff;border:none;font-size:14px;cursor:pointer;border-radius:0 0 8px 0;align-items:center;gap:4px}",
    ".vemobile-back svg{width:20px;height:20px}",
    ".vemobile-chat .vemobile-back{display:flex}",

    // ── Bottom nav bar ──
    ".vemobile-nav{position:fixed;bottom:0;left:0;right:0;z-index:10000;display:flex;justify-content:space-around;align-items:center;height:50px;background:#1e1f22;border-top:1px solid #2b2d31;padding-bottom:var(--safe-bottom)}",
    ".vemobile-nav button{flex:1;height:100%;border:none;background:none;color:#949ba4;font-size:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2px;cursor:pointer;gap:1px}",
    ".vemobile-nav button.active{color:#5865f2}",
    ".vemobile-nav button svg{width:22px;height:22px}",
  ].join("\n");
  document.head.appendChild(CSS);

  // ═══ DOM TAGGING + NAVIGATION ═══

  var backBtn = null;
  var observerStarted = false;

  function createBackButton() {
    if (backBtn) return;
    backBtn = document.createElement("button");
    backBtn.className = "vemobile-back";
    backBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg> Back';
    backBtn.onclick = function () { goHome(); };
    document.body.appendChild(backBtn);
  }

  function goHome() {
    document.body.classList.remove("vemobile-chat", "vemobile-guilds");
    document.body.classList.add("vemobile-home");
    window.__VEMOBILE__.view = "home";
    highlightNav("channels");
  }

  function goToChat() {
    document.body.classList.remove("vemobile-home", "vemobile-guilds");
    document.body.classList.add("vemobile-chat");
    window.__VEMOBILE__.view = "chat";
    highlightNav("chat");
  }

  function goToGuilds() {
    document.body.classList.remove("vemobile-home", "vemobile-chat");
    document.body.classList.add("vemobile-guilds");
    window.__VEMOBILE__.view = "guilds";
    highlightNav("servers");
  }

  function highlightNav(active) {
    var btns = document.querySelectorAll(".vemobile-nav button");
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove("active");
    var b = document.getElementById("vemobile-btn-" + active);
    if (b) b.classList.add("active");
  }

  // ── DOM Tagger: find Discord's layout elements and tag them ──
  function tagLayoutElements() {
    // Walk the DOM from #app-mount to find the main flex layout
    var app = document.getElementById("app-mount");
    if (!app) return false;

    // Find elements that look like the sidebar, chat, guilds, members
    // Discord's layout: [guilds (72px)] [sidebar (240px)] [chat (flex:1)] [members (240px)]
    // These are direct flex children of a container inside #app-mount

    // Strategy: find the element that contains multiple flex children
    // and has width > 0 and contains channels/messages
    
    // Find all flex containers in the app
    var allElements = app.querySelectorAll("*");
    for (var i = 0; i < allElements.length; i++) {
      var el = allElements[i];
      var cs = getComputedStyle(el);
      if (cs.display !== "flex" && cs.display !== "grid") continue;
      
      var children = el.children;
      if (children.length < 2 || children.length > 5) continue;
      
      // Check if this looks like Discord's layout container
      var hasWideElement = false;
      var hasNarrowElement = false;
      var possibleSidebar = null;
      var possibleChat = null;
      var possibleMembers = null;
      var possibleGuilds = null;
      
      for (var j = 0; j < children.length; j++) {
        var child = children[j];
        var childStyle = getComputedStyle(child);
        var rect = child.getBoundingClientRect();
        
        // Very narrow (under 100px) = guilds list
        if (rect.width > 0 && rect.width <= 100 && childStyle.display !== "none") {
          possibleGuilds = child;
          hasNarrowElement = true;
        }
        // Medium (100-400px) = sidebar or members
        else if (rect.width > 100 && rect.width <= 500 && childStyle.display !== "none") {
          // Check if it has a navigation list inside
          if (child.querySelector('nav') || child.querySelector('[class*=item]')) {
            possibleSidebar = child;
          } else {
            possibleMembers = child;
          }
        }
        // Wide (flex: 1) = chat
        else if (rect.width > 300 && childStyle.flexGrow !== "0" && childStyle.display !== "none") {
          possibleChat = child;
          hasWideElement = true;
        }
      }
      
      // If we found both sidebar and chat, this is probably the layout container
      if (possibleSidebar && possibleChat) {
        if (possibleSidebar && !possibleSidebar.hasAttribute("data-vemobile-sidebar")) {
          possibleSidebar.setAttribute("data-vemobile-sidebar", "true");
        }
        if (possibleChat && !possibleChat.hasAttribute("data-vemobile-chat")) {
          possibleChat.setAttribute("data-vemobile-chat", "true");
        }
        if (possibleMembers && !possibleMembers.hasAttribute("data-vemobile-members")) {
          possibleMembers.setAttribute("data-vemobile-members", "true");
        }
        if (possibleGuilds && !possibleGuilds.hasAttribute("data-vemobile-guilds")) {
          possibleGuilds.setAttribute("data-vemobile-guilds", "true");
        }
        return true; // Found it!
      }
    }
    
    // Fallback: try to find sidebar and chat by their content
    // Sidebar usually has a navigation element with channel list items
    var navCandidates = app.querySelectorAll('nav[class*=sidebar], [class*=sidebar] nav');
    var chatCandidate = app.querySelector('[class*=chat]:not([class*=sidebar])');
    
    if (navCandidates.length > 0) {
      var sidebarEl = navCandidates[0].parentElement || navCandidates[0];
      // Walk up to find the actual sidebar wrapper (the flex child)
      while (sidebarEl && sidebarEl.parentElement && sidebarEl.parentElement.children.length <= 5) {
        sidebarEl = sidebarEl.parentElement;
      }
      if (sidebarEl) sidebarEl.setAttribute("data-vemobile-sidebar", "true");
    }
    
    if (chatCandidate) {
      // Walk up to find the actual chat wrapper
      var chatEl = chatCandidate;
      while (chatEl && chatEl.parentElement && chatEl.parentElement !== app && chatEl.parentElement.children.length <= 5) {
        chatEl = chatEl.parentElement;
      }
      if (chatEl) chatEl.setAttribute("data-vemobile-chat", "true");
    }
    
    return !!(document.querySelector("[data-vemobile-sidebar]") && document.querySelector("[data-vemobile-chat]"));
  }

  // ── Navigation detection ──
  // Watch for: URL hash changes, clicks on sidebar items, DOM mutations in chat
  function setupNavigationDetection() {
    if (observerStarted) return;
    observerStarted = true;

    // 1. URL hash change detection (Discord uses hash routing)
    var lastHash = location.hash;
    setInterval(function () {
      if (location.hash !== lastHash) {
        lastHash = location.hash;
        // If hash contains a channel or DM path, go to chat
        if (location.hash.indexOf("/channels/") >= 0) {
          goToChat();
        } else if (location.hash.indexOf("/channels") >= 0 || location.hash === "" || location.hash === "#/") {
          goHome();
        }
      }
    }, 300);

    // 2. Click detection on sidebar navigation items
    document.addEventListener("click", function (e) {
      var target = e.target;
      // Look for clicks on channel/DM list items inside the sidebar
      var sidebar = document.querySelector("[data-vemobile-sidebar]");
      if (sidebar && sidebar.contains(target)) {
        // Check if the click was on a navigable item (link, list item, etc.)
        var navItem = target.closest('a, [class*=item], [class*=link], li[role], [role=link], [role=button]');
        if (navItem) {
          // Delay to let Discord's router update the URL
          setTimeout(function () {
            if (location.hash.indexOf("/channels/") >= 0) {
              goToChat();
            }
          }, 200);
        }
      }
      
      // Clicks on guild/server icons
      var guildsList = document.querySelector("[data-vemobile-guilds]");
      if (guildsList && guildsList.contains(target)) {
        var guildItem = target.closest('[class*=guild], [class*=wrapper], [class*=item], [data-list-item-id]');
        if (guildItem) {
          setTimeout(function () {
            goHome(); // After selecting a guild, show the channel list
          }, 200);
        }
      }
    }, true);

    // 3. MutationObserver — detect when messages appear in chat
    var chatObserver = new MutationObserver(function () {
      if (window.__VEMOBILE__.view === "home") {
        // Check if messages are visible (Discord might auto-navigate)
        var messages = document.querySelector('[class*=messagesWrapper]');
        if (messages && getComputedStyle(messages.parentElement || messages).display !== "none") {
          // Something navigated, check if we should switch to chat
          if (location.hash.indexOf("/channels/") >= 0) {
            goToChat();
          }
        }
      }
    });
    chatObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  // ── Bottom Navigation Bar ──
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
      // Toggle member list visibility in chat view
      var ml = document.querySelector("[data-vemobile-members]");
      if (ml) {
        var isVisible = ml.style.display !== "none" && getComputedStyle(ml).display !== "none";
        ml.style.display = isVisible ? "none" : "flex";
        ml.style.width = isVisible ? "" : "100%";
        var chat = document.querySelector("[data-vemobile-chat]");
        if (chat) chat.style.display = isVisible ? "flex" : "none";
      }
      highlightNav("members");
    };
    document.getElementById("vemobile-btn-settings").onclick = function () {
      goHome();
      // Try to open Discord settings
      setTimeout(function () {
        var btn = document.querySelector('[class*=sidebar] [aria-label="User Settings"], [aria-label="User Settings"]');
        if (btn) btn.click();
      }, 300);
    };
  }

  // ── Swipe gesture for back navigation ──
  var touchStartX = 0, touchStartY = 0, touchMoved = false;
  document.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchMoved = false;
  }, { passive: true });
  document.addEventListener("touchmove", function (e) {
    touchMoved = true;
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (!touchMoved) return;
    var dx = e.changedTouches[0].clientX - touchStartX;
    var dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) <= Math.abs(dy) || Math.abs(dx) < 80) return;
    // Swipe right from left edge → back to home
    if (dx > 0 && touchStartX < 50 && window.__VEMOBILE__.view === "chat") {
      goHome();
    }
    // Swipe left on home → try to go to chat if there's a current channel
    if (dx < 0 && window.__VEMOBILE__.view === "home") {
      if (location.hash.indexOf("/channels/") >= 0) {
        goToChat();
      }
    }
  }, { passive: true });

  // ── Keyboard handling ──
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () {
      var keyboardOpen = window.visualViewport.height < window.innerHeight * 0.8;
      document.body.classList.toggle("vemobile-keyboard-open", keyboardOpen);
    });
  }

  // ── Call interception ──
  var origAlert = window.alert;
  window.alert = function (msg) {
    if (typeof msg === "string" && /not support|not available|RTC|WebRTC|voice|call|getUserMedia/i.test(msg)) {
      window.__VEMOBILE__.sendToNative("callUnsupported", { message: msg });
      return;
    }
    return origAlert.apply(this, arguments);
  };

  // ── Bootstrap ──
  function bootstrap() {
    createBottomNav();
    createBackButton();
    var tagged = tagLayoutElements();
    setupNavigationDetection();

    if (!tagged) {
      // Retry: DOM might not be fully rendered yet
      var retries = 0;
      var retryInterval = setInterval(function () {
        if (tagLayoutElements() || ++retries > 30) {
          clearInterval(retryInterval);
        }
      }, 500);
    }

    // Set initial view based on URL
    if (location.hash.indexOf("/channels/") >= 0) {
      goToChat();
    } else {
      goHome();
    }
  }

  // Start after a short delay to let Discord render its initial UI
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(bootstrap, 1000); });
  } else {
    setTimeout(bootstrap, 1000);
  }

  console.log("[Vemobile] Prelude v0.1.2 loaded");
})();

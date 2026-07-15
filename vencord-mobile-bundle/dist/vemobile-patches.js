/**
 * Vemobile Patches — Runs after Vencord bundle loads.
 * Adds mobile navigation, call fallback, wake lock, updater.
 */
(function () {
  var Vencord = window.Vencord || {};
  var tryRegister = function (plugin) {
    try {
      if (Vencord.Plugins && Vencord.Plugins.plugins) {
        Vencord.Plugins.plugins[plugin.name] = plugin;
      }
      if (plugin.start) plugin.start();
      console.log("[Vemobile] Registered:", plugin.name);
    } catch (e) {
      console.error("[Vemobile] Failed to register:", plugin.name, e);
    }
  };

  console.log("[Vemobile] Applying mobile patches...");

  // ====================================================================
  // MobileUX — Bottom navigation bar, server/channel toggling, gestures
  // ====================================================================
  function MobileUXPlugin() {
    var navBar = null;
    var styleEl = null;
    var observer = null;

    function createNavBar() {
      if (navBar) return;
      if (document.querySelector(".vemobile-nav")) return;

      navBar = document.createElement("div");
      navBar.className = "vemobile-nav";
      navBar.innerHTML = [
        '<button id="vemobile-btn-servers" title="Servers">',
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
        '<span>Servers</span></button>',
        '<button id="vemobile-btn-channels" title="Channels" class="active">',
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>',
        '<span>Chat</span></button>',
        '<button id="vemobile-btn-members" title="Members">',
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
        '<span>Members</span></button>',
        '<button id="vemobile-btn-settings" title="Settings">',
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L3.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
        '<span>Settings</span></button>',
      ].join("");

      document.body.appendChild(navBar);

      // Button handlers
      function clearActive() {
        navBar.querySelectorAll("button").forEach(function (b) { b.classList.remove("active"); });
      }

      document.getElementById("vemobile-btn-servers").onclick = function () {
        clearActive(); this.classList.add("active");
        document.body.classList.remove("vemobile-show-channels");
        document.body.classList.toggle("vemobile-show-guilds");
        // Find and click server list toggle
        var b = document.querySelector('[class*="guilds"] button, [aria-label="Servers"]');
        if (b) b.click();
      };

      document.getElementById("vemobile-btn-channels").onclick = function () {
        clearActive(); this.classList.add("active");
        document.body.classList.remove("vemobile-show-guilds", "vemobile-show-channels");
      };

      document.getElementById("vemobile-btn-members").onclick = function () {
        clearActive(); this.classList.add("active");
        document.body.classList.remove("vemobile-show-guilds", "vemobile-show-channels");
        var b = document.querySelector('[aria-label="Member List"], [aria-label="Members"]');
        if (b) b.click();
      };

      document.getElementById("vemobile-btn-settings").onclick = function () {
        clearActive(); this.classList.add("active");
        document.body.classList.remove("vemobile-show-guilds", "vemobile-show-channels");
        // Open Discord settings
        var b = document.querySelector('[class*="sidebar"] [class*="userSettings"] button, [aria-label="User Settings"]');
        if (b) b.click();
      };
    }

    function removeNavBar() {
      if (navBar) { navBar.remove(); navBar = null; }
    }

    // Show a banner when calls are attempted — offer to open native Discord
    function overrideCallUnsupported() {
      var origAlert = window.alert;
      window.alert = function (msg) {
        if (typeof msg === "string" && (msg.indexOf("not support") >= 0 || msg.indexOf("not available") >= 0 || msg.indexOf("RTC") >= 0 || msg.indexOf("WebRTC") >= 0 || msg.indexOf("voice") >= 0 || msg.indexOf("call") >= 0)) {
          // Instead of alert, show a native dialog
          window.__VEMOBILE__.sendToNative("callUnsupported", { message: msg });
          return;
        }
        return origAlert.apply(this, arguments);
      };

      // Also intercept Discord's call start error
      var origError = console.error;
      var warned = false;
      console.error = function () {
        var args = Array.prototype.slice.call(arguments);
        var msg = args.join(" ");
        if (!warned && (msg.indexOf("RTC") >= 0 || msg.indexOf("WebRTC") >= 0 || msg.indexOf("getUserMedia") >= 0)) {
          warned = true;
          window.__VEMOBILE__.sendToNative("callUnsupported", { message: "Voice and video calls are not supported in this WebView. Open the native Discord app for calls." });
        }
        return origError.apply(console, args);
      };
    }

    // Intercept call buttons to show fallback
    function interceptCallButtons() {
      setInterval(function () {
        // Find call buttons in the UI
        var callBtns = document.querySelectorAll('[aria-label*="Voice"], [aria-label*="Video"], [aria-label*="Call"], [aria-label*="Start Voice"], [aria-label*="Start Video"]');
        callBtns.forEach(function (btn) {
          if (btn._vemobileIntercepted) return;
          btn._vemobileIntercepted = true;
          btn.addEventListener("click", function (e) {
            // Let the normal flow happen, but also notify
            window.__VEMOBILE__.sendToNative("callAttempted", {});
          }, true);
        });
      }, 2000);
    }

    // Swipe to show/hide channel list
    var touchStartX = 0, touchStartY = 0;
    function onTouchStart(e) {
      if (e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
    function onTouchEnd(e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      var dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) <= Math.abs(dy) || Math.abs(dx) < 100) return;
      if (dx > 0 && touchStartX < 40) {
        document.body.classList.add("vemobile-show-channels");
        var btns = document.querySelectorAll(".vemobile-nav button");
        for (var i = 0; i < btns.length; i++) btns[i].classList.remove("active");
        var cb = document.getElementById("vemobile-btn-channels");
        if (cb) cb.classList.add("active");
      }
    }

    function start() {
      createNavBar();
      overrideCallUnsupported();
      interceptCallButtons();
      document.addEventListener("touchstart", onTouchStart, { passive: true });
      document.addEventListener("touchend", onTouchEnd, { passive: true });
      console.log("[Vemobile] MobileUX started");
    }

    function stop() {
      removeNavBar();
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    }

    return { name: "MobileUX", start: start, stop: stop };
  }

  // ====================================================================
  // WakeLock — Screen stays on during calls
  // ====================================================================
  function WakeLockPlugin() {
    var wakeLock = null;
    var interval = null;

    async function acquire() {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        }
        await window.__VEMOBILE__.callNative("requestWakeLock", []);
      } catch (e) {}
    }

    async function release() {
      try {
        if (wakeLock) { await wakeLock.release(); wakeLock = null; }
        await window.__VEMOBILE__.callNative("releaseWakeLock", []);
      } catch (e) {}
    }

    function watch() {
      interval = setInterval(function () {
        var inCall =
          document.querySelector('[class*="voiceConnected"]') ||
          document.querySelector('[class*="call"]') ||
          document.querySelector('[class*="rtcConnection"]') ||
          document.querySelector('[class*="stage"]');
        if (inCall && !wakeLock) acquire();
        else if (!inCall && wakeLock) release();
      }, 5000);
    }

    return { name: "WakeLock", start: watch, stop: function () { clearInterval(interval); release(); } };
  }

  // ====================================================================
  // NoTrack — Block Discord analytics
  // ====================================================================
  function NoTrackPlugin() {
    var blocked = ["discord.com/api/v*/science", "discord.com/api/v*/track", "sentry.io"];
    var origFetch = window.fetch;
    function start() {
      if (window._vemobileNoTrack) return;
      window._vemobileNoTrack = true;
      window.fetch = function (url, opts) {
        var s = typeof url === "string" ? url : (url && url.url) || "";
        for (var i = 0; i < blocked.length; i++) {
          if (s.indexOf(blocked[i]) >= 0) {
            return Promise.resolve(new Response("{}", { status: 200 }));
          }
        }
        return origFetch.apply(this, arguments);
      };
    }
    function stop() {
      window._vemobileNoTrack = false;
      window.fetch = origFetch;
    }
    return { name: "NoTrack", start: start, stop: stop };
  }

  // ====================================================================
  // MobileUpdater — Check GitHub for new bundle versions
  // ====================================================================
  function MobileUpdaterPlugin() {
    var url = "https://api.github.com/repos/yHugoSoares/VencordMobile/releases/latest";
    var lastCheck = 0;
    function check() {
      var now = Date.now();
      if (now - lastCheck < 3600000) return;
      lastCheck = now;
      fetch(url).then(function (r) { return r.json(); }).then(function (rel) {
        var remote = (rel.tag_name || "").replace(/^v/, "");
        var current = window.__VEMOBILE__.version || "0.0.0";
        if (compareVersions(remote, current) > 0) {
          window.__VEMOBILE__.sendToNative("updateAvailable", { version: remote, url: rel.html_url, notes: rel.body || "" });
        }
      }).catch(function () {});
    }
    function compareVersions(a, b) {
      var pa = a.split(".").map(Number), pb = b.split(".").map(Number);
      for (var i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return 1; if ((pa[i] || 0) < (pb[i] || 0)) return -1; }
      return 0;
    }
    return { name: "MobileUpdater", start: function () { check(); setInterval(check, 3600000); }, stop: function () {} };
  }

  // ====================================================================
  // Register all plugins
  // ====================================================================
  var plugins = [MobileUXPlugin(), WakeLockPlugin(), NoTrackPlugin(), MobileUpdaterPlugin()];

  function registerAll() {
    plugins.forEach(tryRegister);
  }

  // Wait for Vencord webpack to be ready
  if (Vencord.Webpack && Vencord.Webpack.onceReady) {
    Vencord.Webpack.onceReady.then(registerAll);
  } else {
    // Poll for Vencord initialization
    var attempts = 0;
    var poll = setInterval(function () {
      if (window.Vencord && window.Vencord.Webpack && window.Vencord.Webpack.cache) {
        clearInterval(poll);
        registerAll();
      } else if (++attempts > 60) {
        clearInterval(poll);
        console.log("[Vemobile] Vencord not detected after 30s, registering anyway");
        registerAll();
      }
    }, 500);
  }
})();

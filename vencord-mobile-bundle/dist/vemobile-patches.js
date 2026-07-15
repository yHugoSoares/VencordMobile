/**
 * Vemobile Patches — Runs after Vencord bundle is loaded.
 * Adds mobile-specific plugins via Vencord's plugin API.
 */
(function () {
  if (!window.Vencord) {
    console.error("[Vemobile] Vencord not found. Cannot apply mobile patches.");
    return;
  }

  var Vencord = window.Vencord;
  var api = Vencord.Api || {};
  var PluginManager = api.PluginManager || Vencord.Plugins || {};
  var plugins = PluginManager.plugins || {};

  console.log("[Vemobile] Applying mobile patches...");

  // --- Mobile UX Plugin ---
  // Adds bottom navigation, swipe gestures, touch target fixes
  function MobileUXPlugin() {
    var styleEl = null;

    function injectMobileCSS() {
      if (styleEl) return;
      styleEl = document.createElement("style");
      styleEl.id = "vemobile-ux";
      styleEl.textContent = [
        // Safe area padding for notched devices
        ":root {",
        "  --vemobile-safe-top: env(safe-area-inset-top, 0px);",
        "  --vemobile-safe-bottom: env(safe-area-inset-bottom, 0px);",
        "  --vemobile-safe-left: env(safe-area-inset-left, 0px);",
        "  --vemobile-safe-right: env(safe-area-inset-right, 0px);",
        "}",
        // Apply safe areas
        '[class*="app"] {',
        "  padding-top: var(--vemobile-safe-top) !important;",
        "  padding-bottom: var(--vemobile-safe-bottom) !important;",
        "}",
        // Larger touch targets
        '[class*="button"], [class*="clickable"], [role="button"], .vemobile-touch-target {',
        "  min-height: 44px !important;",
        "  min-width: 44px !important;",
        "}",
        // Better text input sizing
        '[class*="textArea"], [class*="textArea"] [contenteditable], textarea[class*="textArea"] {',
        "  font-size: 16px !important; /* prevents iOS zoom on focus */",
        "}",
        // Hide Discord's mobile download banner
        '[class*="mobileWebRTCBanner"], [class*="mobile-actions"], [class*="getAppBanner"] {',
        "  display: none !important;",
        "}",
        // Better scrolling
        '[class*="scroller"] {',
        "  -webkit-overflow-scrolling: touch !important;",
        "  overscroll-behavior: contain;",
        "}",
        // Fix message box positioning for mobile keyboard
        '.vemobile-keyboard-open [class*="chat"] [class*="form"] {',
        "  position: sticky;",
        "  bottom: 0;",
        "}",
      ].join("\n");
      document.head.appendChild(styleEl);
    }

    function removeMobileCSS() {
      if (styleEl) {
        styleEl.remove();
        styleEl = null;
      }
    }

    // Swipe gesture detection
    var touchStartX = 0;
    var touchStartY = 0;
    var swiping = false;

    function onTouchStart(e) {
      if (e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      swiping = true;
    }

    function onTouchEnd(e) {
      if (!swiping) return;
      swiping = false;
      var dx = e.changedTouches[0].clientX - touchStartX;
      var dy = e.changedTouches[0].clientY - touchStartY;

      // Only handle horizontal swipes (more horizontal than vertical)
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 80) {
        // Swipe right: open server list
        if (dx > 0 && touchStartX < 50) {
          var serverListBtn = document.querySelector('[class*="guilds"] button, [aria-label="Servers"], [data-list-id="guildsnav"]');
          if (serverListBtn) serverListBtn.click();
        }
        // Swipe left: open channel/member list
        if (dx < 0) {
          var memberListBtn = document.querySelector('[aria-label="Member List"]');
          if (memberListBtn) memberListBtn.click();
        }
      }
    }

    function addSwipeGestures() {
      document.addEventListener("touchstart", onTouchStart, { passive: true });
      document.addEventListener("touchend", onTouchEnd, { passive: true });
    }

    function removeSwipeGestures() {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    }

    // Keyboard handling
    function onKeyboardChange() {
      var isKeyboardOpen =
        window.visualViewport && window.visualViewport.height < window.innerHeight * 0.8;
      document.body.classList.toggle("vemobile-keyboard-open", isKeyboardOpen);
    }

    function startKeyboardObserver() {
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", onKeyboardChange);
      }
    }

    function stopKeyboardObserver() {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", onKeyboardChange);
      }
    }

    return {
      name: "MobileUX",
      start: function () {
        injectMobileCSS();
        addSwipeGestures();
        startKeyboardObserver();
        console.log("[Vemobile] MobileUX plugin started");
      },
      stop: function () {
        removeMobileCSS();
        removeSwipeGestures();
        stopKeyboardObserver();
      },
    };
  }

  // --- Wake Lock Plugin ---
  // Keeps screen on during voice/video calls
  function WakeLockPlugin() {
    var wakeLock = null;
    var watching = false;

    async function requestWakeLock() {
      try {
        // Try Web Wake Lock API first (works in some WebViews)
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        } else {
          // Fall back to mobile native bridge
          await window.__VEMOBILE__.callNative("requestWakeLock", []);
        }
        console.log("[Vemobile] Wake lock acquired");
      } catch (e) {
        console.warn("[Vemobile] Wake lock failed:", e);
      }
    }

    async function releaseWakeLock() {
      try {
        if (wakeLock) {
          await wakeLock.release();
          wakeLock = null;
        }
        await window.__VEMOBILE__.callNative("releaseWakeLock", []);
        console.log("[Vemobile] Wake lock released");
      } catch (e) {
        console.warn("[Vemobile] Wake lock release failed:", e);
      }
    }

    function watchVoiceState() {
      if (watching) return;
      watching = true;

      // Poll for voice connection state changes
      setInterval(function () {
        try {
          // Check if user is in a voice channel using Discord's stores
          var vcStates = document.querySelectorAll('[class*="voiceConnected"], [class*="call"], [class*="rtcConnection"]');
          if (vcStates && vcStates.length > 0) {
            if (!wakeLock) requestWakeLock();
          } else {
            if (wakeLock) releaseWakeLock();
          }
        } catch (e) {
          // Silently ignore
        }
      }, 5000);
    }

    return {
      name: "WakeLock",
      start: function () {
        watchVoiceState();
        console.log("[Vemobile] WakeLock plugin started");
      },
      stop: function () {
        releaseWakeLock();
        watching = false;
      },
    };
  }

  // --- Analytics Block Plugin ---
  // Blocks Discord tracking and telemetry on mobile
  function NoTrackPlugin() {
    var blockedHosts = [
      "discord.com/api/v*/science",
      "discord.com/api/v*/track",
      "sentry.io",
      "cdn.sentry.io",
    ];

    function setupBlocking() {
      // Intercept fetch
      if (window._vemobileFetchBlocked) return;
      window._vemobileFetchBlocked = true;

      var origFetch = window.fetch;
      window.fetch = function (url, opts) {
        var urlStr = typeof url === "string" ? url : url && url.url ? url.url : "";
        for (var i = 0; i < blockedHosts.length; i++) {
          if (urlStr.indexOf(blockedHosts[i]) >= 0) {
            console.log("[Vemobile] Blocked tracking request:", urlStr);
            return Promise.resolve(new Response("{}", { status: 200 }));
          }
        }
        return origFetch.apply(this, arguments);
      };
    }

    return {
      name: "NoTrack",
      start: function () {
        setupBlocking();
        console.log("[Vemobile] NoTrack plugin started");
      },
      stop: function () {
        window._vemobileFetchBlocked = false;
        window.fetch = window._vemobileOrigFetch || window.fetch;
      },
    };
  }

  // --- Mobile Updater Plugin ---
  // Checks GitHub releases for new mod bundle versions
  function MobileUpdaterPlugin() {
    var UPDATE_URL =
      "https://api.github.com/repos/vencordmobile/vemobile/releases/latest";
    var lastCheck = 0;

    async function checkForUpdate() {
      try {
        var now = Date.now();
        if (now - lastCheck < 3600000) return; // Check at most once per hour
        lastCheck = now;

        var resp = await fetch(UPDATE_URL);
        if (!resp.ok) return;
        var release = await resp.json();
        var remoteVersion = release.tag_name.replace("v", "");
        var currentVersion = window.__VEMOBILE__.version || "0.0.0";

        if (compareVersions(remoteVersion, currentVersion) > 0) {
          window.__VEMOBILE__.sendToNative("updateAvailable", {
            version: remoteVersion,
            url: release.html_url,
            notes: release.body,
          });
        }
      } catch (e) {
        console.warn("[Vemobile] Update check failed:", e);
      }
    }

    function compareVersions(a, b) {
      var pa = a.split(".").map(Number);
      var pb = b.split(".").map(Number);
      for (var i = 0; i < 3; i++) {
        if ((pa[i] || 0) > (pb[i] || 0)) return 1;
        if ((pa[i] || 0) < (pb[i] || 0)) return -1;
      }
      return 0;
    }

    return {
      name: "MobileUpdater",
      start: function () {
        checkForUpdate();
        setInterval(checkForUpdate, 3600000); // Every hour
        console.log("[Vemobile] MobileUpdater plugin started");
      },
      stop: function () {},
    };
  }

  // --- Push Notification Plugin ---
  // Bridges FCM/APNs push notifications
  function PushNotificationsPlugin() {
    var fcmToken = null;

    async function init() {
      try {
        // Request permission
        if ("Notification" in window && Notification.permission === "default") {
          await Notification.requestPermission();
        }
        // Get FCM token from native
        var result = await window.__VEMOBILE__.callNative("getFCMToken", []);
        if (result && result.token) {
          fcmToken = result.token;
          console.log("[Vemobile] FCM token:", fcmToken);
        }
      } catch (e) {
        console.warn("[Vemobile] Push notifications init failed:", e);
      }
    }

    return {
      name: "PushNotifications",
      start: function () {
        init();
        console.log("[Vemobile] PushNotifications plugin started");
      },
      stop: function () {},
    };
  }

  // --- Register mobile plugins with Vencord ---
  function registerMobilePlugins() {
    var mobilePlugins = [
      MobileUXPlugin(),
      WakeLockPlugin(),
      NoTrackPlugin(),
      MobileUpdaterPlugin(),
      PushNotificationsPlugin(),
    ];

    mobilePlugins.forEach(function (plugin) {
      if (plugins[plugin.name]) {
        console.log("[Vemobile] Plugin already registered:", plugin.name);
        return;
      }
      // Register with Vencord's plugin system
      try {
        if (PluginManager.addPlugin) {
          PluginManager.addPlugin(plugin);
        } else {
          // Fallback: add directly to plugins registry
          plugins[plugin.name] = plugin;
        }
        // Auto-start the plugin
        if (plugin.start) plugin.start();
        console.log("[Vemobile] Registered mobile plugin:", plugin.name);
      } catch (e) {
        console.error("[Vemobile] Failed to register plugin:", plugin.name, e);
      }
    });
  }

  // Wait for Vencord to be fully ready, then register
  function waitForVencordReady() {
    if (
      window.Vencord &&
      window.Vencord.Webpack &&
      window.Vencord.Webpack.onceReady
    ) {
      window.Vencord.Webpack.onceReady.then(function () {
        registerMobilePlugins();
      });
    } else {
      // Retry after a delay
      setTimeout(waitForVencordReady, 500);
    }
  }

  // Start immediately — if Vencord's webpack isn't ready, wait
  if (plugins && Object.keys(plugins).length > 0) {
    registerMobilePlugins();
  } else {
    waitForVencordReady();
  }
})();

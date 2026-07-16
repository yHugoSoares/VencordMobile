/**
 * Vemobile Patches v0.2.0 — Sprint 2
 *
 * 2.1: Flux event subscription for navigation (CHANNEL_SELECT, etc.)
 * 2.3: Settings via Vencord API
 * 2.4: Deep call detection (enumerateDevices + RTC module intercept)
 * 2.5: Class-based member toggle (already in prelude CSS)
 */
(function () {
  var V = window.Vencord || {};
  var PK = V.Plugins || {};
  var plugins = PK.plugins || {};

  function reg(plugin) {
    try { plugins[plugin.name] = plugin; if (plugin.start) plugin.start(); }
    catch (e) { console.error("[Vemobile] " + plugin.name + " failed:", e); }
  }

  // ═══════════════════════════════════════════════
  // 2.1 Flux Navigation Plugin
  // Subscribes to Discord's internal Flux events for real navigation detection
  // ═══════════════════════════════════════════════
  reg({
    name: "FluxNav",
    started: false,
    subscriptions: [],

    start: function () {
      if (this.started) return;
      var self = this;

      function onReady() {
        try {
          // Find Discord's Flux dispatcher via Vencord webpack
          var modules = V.Webpack ? V.Webpack.findByProps("dispatch", "subscribe", "unsubscribe") : null;

          if (modules) {
            var dispatcher = modules.dispatch ? modules : (modules.default || modules);

            // Subscribe to CHANNEL_SELECT — Discord fires this when user clicks a channel
            if (dispatcher.subscribe) {
              dispatcher.subscribe("CHANNEL_SELECT", function (e) {
                if (e && e.channelId) {
                  document.body.classList.remove("vemobile-home", "vemobile-guilds", "vemobile-show-members");
                  document.body.classList.add("vemobile-chat");
                  window.__VEMOBILE__.view = "chat";
                  var b = document.getElementById("vemobile-btn-chat");
                  if (b) {
                    document.querySelectorAll(".vemobile-nav button").forEach(function (x) { x.classList.remove("active"); });
                    b.classList.add("active");
                  }
                } else {
                  document.body.classList.remove("vemobile-chat", "vemobile-guilds", "vemobile-show-members");
                  document.body.classList.add("vemobile-home");
                  window.__VEMOBILE__.view = "home";
                  var c = document.getElementById("vemobile-btn-channels");
                  if (c) {
                    document.querySelectorAll(".vemobile-nav button").forEach(function (x) { x.classList.remove("active"); });
                    c.classList.add("active");
                  }
                }
              });
              self.subscriptions.push(function () { dispatcher.unsubscribe("CHANNEL_SELECT"); });
              console.log("[Vemobile] FluxNav: subscribed to CHANNEL_SELECT");
            }

            // Subscribe to VOICE_CHANNEL_SELECT for call detection
            if (dispatcher.subscribe) {
              dispatcher.subscribe("VOICE_CHANNEL_SELECT", function (e) {
                if (e && e.channelId) {
                  // User joined a voice channel — inform native for wake lock
                  window.__VEMOBILE__.callNative("requestWakeLock", []);
                }
              });
              self.subscriptions.push(function () { dispatcher.unsubscribe("VOICE_CHANNEL_SELECT"); });
              console.log("[Vemobile] FluxNav: subscribed to VOICE_CHANNEL_SELECT");
            }

            // Subscribe to RTC connection events for call state
            dispatcher.subscribe && dispatcher.subscribe("RTC_CONNECTION_STATE", function (e) {
              if (e && e.state === "DISCONNECTED") {
                window.__VEMOBILE__.callNative("releaseWakeLock", []);
              }
            });

            self.started = true;
          } else {
            console.log("[Vemobile] FluxNav: dispatcher not found");
          }
        } catch (e) {
          console.warn("[Vemobile] FluxNav: error subscribing:", e);
        }
      }

      // Wait for Vencord webpack to be ready
      if (V.Webpack && V.Webpack.onceReady) {
        V.Webpack.onceReady.then(onReady);
      } else {
        // Fallback: try after a delay
        setTimeout(function () {
          if (V.Webpack && V.Webpack.onceReady) {
            V.Webpack.onceReady.then(onReady);
          } else {
            onReady(); // Try anyway
          }
        }, 2000);
      }
    },

    stop: function () {
      this.subscriptions.forEach(function (fn) { try { fn(); } catch (e) {} });
      this.subscriptions = [];
      this.started = false;
    },
  });

  // ═══════════════════════════════════════════════
  // 2.3 Settings Button Fix
  // Opens Vencord settings directly instead of clicking DOM elements
  // ═══════════════════════════════════════════════
  reg({
    name: "SettingsButton",
    start: function () {
      // Hook the settings nav button
      var self = this;
      self._interval = setInterval(function () {
        var btn = document.getElementById("vemobile-btn-settings");
        if (btn && !btn._vemobilePatched) {
          btn._vemobilePatched = true;
          btn.onclick = function () {
            // Try Vencord settings API first
            if (V.Api && V.Api.Settings && V.Api.Settings.open) {
              V.Api.Settings.open();
              return;
            }
            // Fallback: open Discord settings
            var app = document.getElementById("app-mount");
            if (app) {
              var settingsBtn = app.querySelector('[class*=sidebar] [aria-label="User Settings"], [aria-label="User Settings"]');
              if (settingsBtn) settingsBtn.click();
            }
          };
        }
      }, 1000);
    },
    stop: function () { clearInterval(this._interval); },
  });

  // ═══════════════════════════════════════════════
  // 2.4 Deep Call Detection
  // Overrides more WebRTC detection points for comprehensive call blocking
  // ═══════════════════════════════════════════════
  reg({
    name: "CallDetect",
    start: function () {
      var warned = false;

      // Override MediaStream to catch Discord checking for mic/camera
      if (typeof MediaStream !== "undefined") {
        var origMS = window.MediaStream;
        // Don't override constructor — just track if Discord tries to use it
      }

      // Intercept console.warn/error for RTC-related messages
      var origWarn = console.warn;
      var origError = console.error;
      var keywords = /webrtc|getUserMedia|mediaDevices|enumerateDevices|microphone|camera|permission denied|not allowed/i;

      console.warn = function () {
        var msg = Array.prototype.join.call(arguments, " ");
        if (!warned && keywords.test(msg)) {
          warned = true;
          window.__VEMOBILE__.sendToNative("callUnsupported", { message: "WebRTC not available in WebView" });
        }
        return origWarn.apply(console, arguments);
      };

      console.error = function () {
        var msg = Array.prototype.join.call(arguments, " ");
        if (!warned && keywords.test(msg)) {
          warned = true;
          window.__VEMOBILE__.sendToNative("callUnsupported", { message: "WebRTC error in WebView" });
        }
        return origError.apply(console, arguments);
      };

      // Inject a call warning banner into the voice channel header
      var bannerInterval = setInterval(function () {
        // Find voice channel header — it appears when user is in a voice channel
        var vcHeader = document.querySelector('[class*=voiceChannelEffect], [class*=voiceConnected]');
        if (vcHeader && !document.querySelector(".vemobile-call-warning")) {
          var banner = document.createElement("div");
          banner.className = "vemobile-call-warning";
          banner.style.cssText = "background:#faa61a;color:#000;padding:8px 12px;font-size:12px;text-align:center;border-radius:4px;margin:8px";
          banner.textContent = "Voice/video calls may not work in this WebView. Open the native Discord app for calls.";
          banner.onclick = function () {
            window.__VEMOBILE__.sendToNative("callUnsupported", { message: "Open native Discord for calls?" });
          };
          vcHeader.parentElement && vcHeader.parentElement.insertBefore(banner, vcHeader);
        }
      }, 3000);

      this._bannerInterval = bannerInterval;
    },
    stop: function () {
      clearInterval(this._bannerInterval);
    },
  });

  // ═══════════════════════════════════════════════
  // 3.2 WakeLock — Event-driven via Flux, DOM polling as backup
  // ═══════════════════════════════════════════════
  reg({
    name: "WakeLock",
    active: false,
    wl: null,
    iv: null,

    acquire: async function () {
      if (this.active) return;
      try {
        if ("wakeLock" in navigator) this.wl = await navigator.wakeLock.request("screen");
        await window.__VEMOBILE__.callNative("requestWakeLock", []);
        this.active = true;
      } catch (e) {}
    },

    release: async function () {
      if (!this.active) return;
      try {
        if (this.wl) { await this.wl.release(); this.wl = null; }
        await window.__VEMOBILE__.callNative("releaseWakeLock", []);
        this.active = false;
      } catch (e) {}
    },

    start: function () {
      var self = this;

      // Primary: Flux events (from FluxNav plugin subscriptions)
      // If Vencord webpack is available, listen directly
      function setupFluxWakeLock() {
        try {
          var V = window.Vencord || {};
          var modules = V.Webpack ? V.Webpack.findByProps("dispatch", "subscribe") : null;
          if (modules) {
            var disp = modules.dispatch ? modules : (modules.default || modules);
            if (disp.subscribe) {
              disp.subscribe("VOICE_CHANNEL_SELECT", function (e) {
                if (e && e.channelId) self.acquire();
              });
              disp.subscribe("RTC_CONNECTION_STATE", function (e) {
                if (e && e.state === "DISCONNECTED") self.release();
              });
              disp.subscribe("VOICE_CHANNEL_LEAVE", function () { self.release(); });
              return true;
            }
          }
        } catch (e) {}
        return false;
      }

      // Try Flux first
      if (window.Vencord && window.Vencord.Webpack && window.Vencord.Webpack.onceReady) {
        window.Vencord.Webpack.onceReady.then(function () {
          if (!setupFluxWakeLock()) startFallbackPolling();
        });
      } else {
        // Delay and retry
        setTimeout(function () {
          if (!setupFluxWakeLock()) startFallbackPolling();
        }, 3000);
      }

      // Fallback: DOM-based polling (every 5s, lightweight)
      function startFallbackPolling() {
        self.iv = setInterval(function () {
          var inCall = document.querySelector('[class*=voiceConnected],[class*=call],[class*=rtcConnection],[class*=stage]');
          if (inCall && !self.active) self.acquire();
          else if (!inCall && self.active) self.release();
        }, 5000);
      }
    },

    stop: function () {
      clearInterval(this.iv);
      this.release();
    },
  });

  // ═══════════════════════════════════════════════
  // NoTrack (existing, from Sprint 1)
  // ═══════════════════════════════════════════════
  reg({
    name: "NoTrack",
    start: function () {
      if (window._vnt2) return;
      window._vnt2 = true;
      var orig = window.fetch;
      var patterns = [/\/api\/v\d+\/science/, /\/api\/v\d+\/track/, /sentry\.io/];
      window.fetch = function (url, opts) {
        var s = typeof url === "string" ? url : (url && url.url) || "";
        for (var i = 0; i < patterns.length; i++) {
          if (patterns[i].test(s)) return Promise.resolve(new Response("{}", { status: 200 }));
        }
        return orig.apply(this, arguments);
      };
    },
    stop: function () { window._vnt2 = false; },
  });

  // ═══════════════════════════════════════════════
  // MobileUpdater (existing)
  // ═══════════════════════════════════════════════
  reg({
    name: "MobileUpdater",
    start: function () {
      var url = "https://api.github.com/repos/yHugoSoares/VencordMobile/releases/latest";
      var last = 0;
      function check() {
        var now = Date.now();
        if (now - last < 3600000) return;
        last = now;
        fetch(url).then(function (r) { return r.json(); }).then(function (rel) {
          var remote = (rel.tag_name || "").replace(/^v/, "");
          var current = window.__VEMOBILE__.version || "0.0.0";
          var pa = remote.split(".").map(Number), pb = current.split(".").map(Number);
          var newer = false;
          for (var i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) { newer = true; break; } if ((pa[i] || 0) < (pb[i] || 0)) break; }
          if (newer) window.__VEMOBILE__.sendToNative("updateAvailable", { version: remote, url: rel.html_url, notes: rel.body || "" });
        }).catch(function () {});
      }
      check();
      setInterval(check, 3600000);
    },
    stop: function () {},
  });

  console.log("[Vemobile] Patches v0.2.0 loaded (sprint 2)");
})();

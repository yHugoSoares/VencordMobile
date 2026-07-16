/**
 * Vemobile Patches v0.3.0-alpha
 *
 * FluxNav, WakeLock, NoTrack, MobileUpdater, CallDetect.
 * No DOM tagging needed — Discord's mobile web app handles layout.
 */
(function () {
  var V = window.Vencord || {};
  var P = V.Plugins && V.Plugins.plugins ? V.Plugins.plugins : {};

  function reg(plugin) {
    try { P[plugin.name] = plugin; if (plugin.start) plugin.start(); }
    catch (e) { console.error("[Vemobile]", plugin.name, e); }
  }

  // ── FluxNav: subscribe to Discord Flux events ──
  reg({
    name: "FluxNav",
    subs: [],
    start: function () {
      var self = this;
      function sub() {
        try {
          var disp = (V.Webpack && V.Webpack.findByProps("dispatch", "subscribe")) || {};
          var d = disp.dispatch ? disp : (disp.default || disp);
          if (!d.subscribe) return;
          d.subscribe("VOICE_CHANNEL_SELECT", function (e) {
            if (e && e.channelId) window.__VEMOBILE__.callNative("requestWakeLock", []);
          });
          d.subscribe("VOICE_CHANNEL_LEAVE", function () {
            window.__VEMOBILE__.callNative("releaseWakeLock", []);
          });
          d.subscribe("RTC_CONNECTION_STATE", function (e) {
            if (e && e.state === "DISCONNECTED") window.__VEMOBILE__.callNative("releaseWakeLock", []);
          });
          console.log("[Vemobile] FluxNav subscribed");
        } catch (e) {}
      }
      if (V.Webpack && V.Webpack.onceReady) V.Webpack.onceReady.then(sub);
      else setTimeout(sub, 3000);
    },
    stop: function () { this.subs.forEach(function (f) { try { f(); } catch (e) {} }); },
  });

  // ── WakeLock ──
  reg({
    name: "WakeLock",
    active: false, wl: null,
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
      self._iv = setInterval(function () {
        var c = document.querySelector('[class*=voiceConnected],[class*=call],[class*=rtcConnection],[class*=stage]');
        if (c && !self.active) self.acquire();
        else if (!c && self.active) self.release();
      }, 5000);
    },
    stop: function () { clearInterval(this._iv); this.release(); },
  });

  // ── NoTrack ──
  reg({
    name: "NoTrack",
    start: function () {
      if (window._vnt) return;
      window._vnt = true;
      var orig = window.fetch;
      var re = [/\/api\/v\d+\/science/, /\/api\/v\d+\/track/, /sentry\.io/];
      window.fetch = function (url, opts) {
        var s = typeof url === "string" ? url : (url && url.url) || "";
        for (var i = 0; i < re.length; i++) if (re[i].test(s)) return Promise.resolve(new Response("{}", { status: 200 }));
        return orig.apply(this, arguments);
      };
    },
    stop: function () { window._vnt = false; },
  });

  // ── MobileUpdater ──
  reg({
    name: "MobileUpdater",
    start: function () {
      var url = "https://api.github.com/repos/yHugoSoares/VencordMobile/releases/latest";
      var last = 0;
      function check() {
        var now = Date.now(); if (now - last < 3600000) return; last = now;
        fetch(url).then(function (r) { return r.json(); }).then(function (rel) {
          var rv = (rel.tag_name || "").replace(/^v/, "");
          var cv = window.__VEMOBILE__.version;
          var ra = rv.split(".").map(Number), ca = cv.split(".").map(Number);
          for (var i = 0; i < 3; i++) {
            if ((ra[i] || 0) > (ca[i] || 0)) {
              window.__VEMOBILE__.sendToNative("updateAvailable", { version: rv, url: rel.html_url, notes: rel.body || "" });
              break;
            }
            if ((ra[i] || 0) < (ca[i] || 0)) break;
          }
        }).catch(function () {});
      }
      check(); setInterval(check, 3600000);
    },
    stop: function () {},
  });

  // ── CallDetect: intercept console + inject banner ──
  reg({
    name: "CallDetect",
    start: function () {
      var warned = false;
      var kw = /webrtc|getUserMedia|mediaDevices|enumerateDevices|microphone|camera|permission denied|not allowed/i;
      var ow = console.warn, oe = console.error;
      console.warn = function () { var m = Array.prototype.join.call(arguments, " "); if (!warned && kw.test(m)) { warned = true; window.__VEMOBILE__.sendToNative("callUnsupported", { message: m }); } return ow.apply(console, arguments); };
      console.error = function () { var m = Array.prototype.join.call(arguments, " "); if (!warned && kw.test(m)) { warned = true; window.__VEMOBILE__.sendToNative("callUnsupported", { message: m }); } return oe.apply(console, arguments); };
      this._iv = setInterval(function () {
        var h = document.querySelector('[class*=voiceConnected]');
        if (h && !document.querySelector(".vemobile-call-warn")) {
          var b = document.createElement("div");
          b.className = "vemobile-call-warn";
          b.style.cssText = "background:#faa61a;color:#000;padding:6px 10px;font-size:12px;text-align:center;border-radius:4px;margin:6px;cursor:pointer";
          b.textContent = "Calls may not work in WebView — tap to open Discord app";
          b.onclick = function () { window.__VEMOBILE__.sendToNative("callUnsupported", {}); };
          h.parentElement && h.parentElement.insertBefore(b, h);
        }
      }, 3000);
    },
    stop: function () { clearInterval(this._iv); },
  });

  console.log("[Vemobile] Patches v0.3.0-alpha loaded");
})();

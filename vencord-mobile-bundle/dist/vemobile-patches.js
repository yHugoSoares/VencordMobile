/**
 * Vemobile Patches — Lightweight plugins loaded after Vencord bundle.
 * Navigation/UI is handled by vemobile-prelude.js.
 */
(function () {
  var V = window.Vencord || {};
  var P = V.Plugins && V.Plugins.plugins ? V.Plugins.plugins : {};

  function reg(plugin) {
    try {
      P[plugin.name] = plugin;
      if (plugin.start) plugin.start();
      console.log("[Vemobile] " + plugin.name + " started");
    } catch (e) {
      console.error("[Vemobile] " + plugin.name + " failed:", e);
    }
  }

  // ── WakeLock: keep screen on during calls ──
  reg({
    name: "WakeLock",
    wakeLock: null,
    interval: null,
    start: function () {
      var self = this;
      self.interval = setInterval(function () {
        var inCall = document.querySelector('[class*=voiceConnected],[class*=call],[class*=rtcConnection],[class*=stage]');
        if (inCall && !self.wakeLock) {
          (async function () {
            try {
              if ("wakeLock" in navigator) self.wakeLock = await navigator.wakeLock.request("screen");
              await window.__VEMOBILE__.callNative("requestWakeLock", []);
            } catch (e) {}
          })();
        } else if (!inCall && self.wakeLock) {
          (async function () {
            try {
              if (self.wakeLock) { await self.wakeLock.release(); self.wakeLock = null; }
              await window.__VEMOBILE__.callNative("releaseWakeLock", []);
            } catch (e) {}
          })();
        }
      }, 5000);
    },
    stop: function () { clearInterval(this.interval); },
  });

  // ── NoTrack: block Discord analytics ──
  reg({
    name: "NoTrack",
    start: function () {
      if (window._vnt) return;
      window._vnt = true;
      var orig = window.fetch;
      var blocked = ["discord.com/api/v*/science", "discord.com/api/v*/track", "sentry.io"];
      window.fetch = function (url, opts) {
        var s = typeof url === "string" ? url : (url && url.url) || "";
        for (var i = 0; i < blocked.length; i++) {
          if (s.indexOf(blocked[i]) >= 0) return Promise.resolve(new Response("{}", { status: 200 }));
        }
        return orig.apply(this, arguments);
      };
    },
    stop: function () { window._vnt = false; },
  });

  // ── MobileUpdater: check GitHub releases ──
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

  console.log("[Vemobile] Patches v0.1.2 loaded");
})();

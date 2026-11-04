/* Tom's TV Home: hosted app code.
   This file is served from GitHub Pages and injected into the small local page
   inside the TV app, so PalmServiceBridge works and relative paths (photos/,
   icons/) point at the files bundled in the app on the TV.
   A copy of this file is bundled in the app as a fallback for when the
   internet or GitHub Pages is down. */
(function () {
"use strict";
if (window.TVHOME_STARTED) return;          // only one copy ever runs
window.TVHOME_STARTED = true;

var APP_VERSION = "2.2.0";

/* ---------- Config: apps in priority order ----------
   id     = the webOS app id used to launch the app.
   match  = words looked for in the TV's own app list, which corrects the id
            automatically if the TV allows the launcher to read that list.
   key    = file name to use for a home-made icon in the my-icons folder
            (for example my-icons/netflix.png). */
var APPS = [
  { name: "Netflix",     key: "netflix",     id: "netflix",                    match: ["netflix"],               c: "#e50914", f: "#b1060f" },
  { name: "Prime Video", key: "prime-video", id: "amazon",                     match: ["prime video", "amazon"], c: "#1a98ff", f: "#0f6fcf", z: 1.3 },
  { name: "Apple TV",    key: "apple-tv",    id: "com.apple.appletv",          match: ["apple tv"],              c: "#c9ccd4", f: "#3a3b40", z: 1.1 },
  { name: "YouTube",     key: "youtube",     id: "youtube.leanback.v4",        match: ["youtube"],               c: "#ff3b30", f: "#cc0000", not: ["kids", "music", "tv"] },
  { name: "BBC iPlayer", key: "bbc-iplayer", id: "bbc.iplayer.3.0",            match: ["iplayer"],               c: "#ff4fa3", f: "#c8256f" },
  { name: "NOW",         key: "now",         id: "com.nowtv.nowtv",            match: ["=now", "now tv", "nowtv"], c: "#00c2a8", f: "#00806f", z: 2.05 },
  { name: "Disney+",     key: "disney-plus", id: "com.disney.disneyplus-prod", match: ["disney"],                c: "#3d6bff", f: "#1238b4", z: 1.35 },
  { name: "Peloton",     key: "peloton",     id: "com.onepeloton.callisto",    match: ["peloton"],               c: "#df1c2f", f: "#a8101f" },
  { name: "Channel 4",   key: "channel-4",   id: "channel4",                   match: ["channel 4", "channel4"], c: "#9fe03a", f: "#3f7a12" },
  { name: "Crunchyroll", key: "crunchyroll", id: "crunchyroll",                match: ["crunchyroll"],           c: "#ff7a1a", f: "#d9560b" }
];
var PLACE = "Tynemouth", LAT = 55.0179, LON = -1.4254;
var IDLE_MS = 2 * 60 * 1000;              // ambient mode after 2 minutes idle
var AMBIENT_PHOTO_SECONDS = 30;           // ambient photo change
var AMBIENT_PHOTOS_FOR_MINUTES = 180;     // after this long in ambient, photos fade to black (clock only)
var UPDATE_CHECK_MINUTES = 30;            // look for new hosted code this often (applied only while idle)

/* ---------- Where this code came from ---------- */
var me = document.currentScript ? document.currentScript.src : "";
var BASE = me ? me.replace(/[?#].*$/, "").replace(/[^\/]*$/, "") : "";
var SOURCE = /^https:/.test(BASE) ? "live (GitHub Pages)" : "built-in copy (offline fallback)";
var PHOTOS = (window.TVHOME_PHOTOS || []).slice();
var MY_ICONS = window.TVHOME_ICONS || {};
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ""); }
function myIcon(app) { return MY_ICONS[slug(app.key)] || MY_ICONS[slug(app.name)] || null; }

/* ---------- Diagnostics state (red button) ---------- */
var diag = { bridge: typeof window.PalmServiceBridge !== "undefined", calls: [], points: null, tiles: {}, launches: [] };
APPS.forEach(function (a) { diag.tiles[a.key] = { idFrom: "config", match: "-", icon: "-", iconStatus: "-" }; });

/* ---------- Page structure ---------- */
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
var root = document.getElementById("root");
root.innerHTML =
  '<div id="stage" class="no-photos">' +   // photos are shown only in photo mode (ambient)
  '  <div id="shift">' +
  '    <div class="top">' +
  '      <div class="left">' +
  '        <div class="clock" id="clock">--:--</div>' +
  '        <div class="date" id="date"></div>' +
  '        <div class="weather">' +
  '          <div class="w-now"><span class="w-icon" id="wIcon">·</span><span class="w-temp" id="wTemp">--°</span></div>' +
  '          <div class="w-text"><div class="w-desc" id="wDesc">Loading weather</div><div class="w-place">' + esc(PLACE) + '</div></div>' +
  '        </div>' +
  '      </div>' +
    '    </div>' +
  '    <div class="apps"><div class="row primary" id="row1"></div><div class="row secondary" id="row2"></div></div>' +
  '    <div class="hint"><b>1</b> to <b>0</b> open an app<i></i><b class="k blue"></b> photo mode<i></i><b class="k red"></b> diagnostics</div>' +
  '  </div>' +
  '  <div id="toast"></div>' +
  '  <div id="ambient">' +
  '    <div id="amb-orbs"><div class="orb a"></div><div class="orb b"></div><div class="orb c"></div></div>' +
  '    <div id="amb-photos"></div>' +
  '    <div id="amb-info"><div id="amb-clock">--:--</div><div id="amb-sub"></div></div>' +
  '  </div>' +
  '  <div id="diag"><div id="diag-body"></div></div>' +
  '</div>';
function $(id) { return document.getElementById(id); }

/* ---------- Load the matching stylesheet, then show ---------- */
(function () {
  var l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = BASE + "app.css" + (/^https:/.test(BASE) ? "?t=" + Date.now() : "");
  function show() { document.body.classList.add("ready"); }
  l.onload = show; l.onerror = show; setTimeout(show, 4000);
  document.head.appendChild(l);
})();

/* ---------- Stage scaling ---------- */
var stage = $("stage");
function fit() {
  var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  stage.style.transform = "translate(-50%, -50%) scale(" + s + ")";
}
window.addEventListener("resize", fit); fit();

/* ---------- webOS service bridge ---------- */
var bridges = [];
function luna(uri, params, cb) {
  if (!diag.bridge) { if (cb) cb(null); return; }
  try {
    var b = new PalmServiceBridge();
    bridges.push(b);
    b.onservicecallback = function (msg) {
      var r = null; try { r = JSON.parse(msg); } catch (e) {}
      var i = bridges.indexOf(b); if (i > -1) bridges.splice(i, 1);
      if (cb) cb(r);
    };
    b.call(uri, JSON.stringify(params || {}));
  } catch (e) { if (cb) cb({ returnValue: false, errorText: "bridge error: " + e.message }); }
}

/* ---------- Find installed apps (corrects ids, finds TV icons) ---------- */
var LP_SERVICES = ["luna://com.webos.applicationManager/listLaunchPoints",
                   "luna://com.webos.service.applicationManager/listLaunchPoints"];
function titleHits(app, title) {
  var t = (title || "").toLowerCase().trim();
  if (app.not && app.not.some(function (n) { return (" " + t + " ").indexOf(" " + n + " ") > -1; })) return false;
  return app.match.some(function (m) {
    if (m.charAt(0) === "=") return t === m.slice(1);
    return t.indexOf(m) > -1;
  });
}
function resolveIds(n) {
  n = n || 0;
  if (n >= LP_SERVICES.length) return;
  var uri = LP_SERVICES[n];
  luna(uri, {}, function (r) {
    diag.calls.push({ uri: uri, ok: !!(r && r.launchPoints), info: r ? (r.launchPoints ? r.launchPoints.length + " apps" : (r.errorText || r.errorCode || JSON.stringify(r).slice(0, 160))) : "no reply" });
    if (!r || !r.launchPoints) { resolveIds(n + 1); return; }
    diag.points = r.launchPoints;
    APPS.forEach(function (app) {
      var d = diag.tiles[app.key];
      for (var i = 0; i < r.launchPoints.length; i++) {
        var lp = r.launchPoints[i];
        if (!titleHits(app, lp.title)) continue;
        if (lp.id !== app.id) { d.idFrom = "TV list (config said " + app.id + ")"; app.id = lp.id; }
        else d.idFrom = "config, confirmed by TV";
        d.match = lp.title + " [" + lp.id + "]";
        var ic = lp.largeIcon || lp.mediumLargeIcon || lp.icon;
        if (ic && !myIcon(app)) setIcon(app, ic.charAt(0) === "/" ? "file://" + ic : ic, lp.bgColor || lp.iconColor, "TV");
        return;
      }
      d.match = "NOT FOUND on TV";
    });
    renderDiag();
  });
}

/* ---------- Tile icons ---------- */
function setIcon(app, src, bg, from) {
  var el = tiles[APPS.indexOf(app)], d = diag.tiles[app.key];
  if (!el) return;
  d.icon = from + ": " + src; d.iconStatus = "loading";
  var img = new Image();
  img.onload = function () {
    d.iconStatus = "loaded (" + img.naturalWidth + "x" + img.naturalHeight + ")";
    el.classList.add("has-icon");
    el.classList.toggle("mono", /\/logo-/.test(src));      // official logos, shown in white
    el.classList.toggle("tv-icon", from === "TV");
    if (bg) el.style.setProperty("--icon-bg", bg);
    var old = el.querySelector(".logo"); if (old) old.parentNode.removeChild(old);
    img.className = "logo";
    el.appendChild(img);
    renderDiag();
  };
  img.onerror = function () { d.iconStatus = "ERROR (blocked or missing)"; renderDiag(); };
  img.src = src;
}
function useMyIcons() {
  APPS.forEach(function (app) {
    var f = myIcon(app); if (f) setIcon(app, f, null, "my-icons");
  });
}

function launch(app) {
  if (!diag.bridge) { toast("On the TV this opens " + app.name); return; }
  toast("Opening " + app.name);
  luna("luna://com.webos.applicationManager/launch", { id: app.id }, function (r) {
    var ok = !(r && r.returnValue === false);
    diag.launches.unshift(app.name + " [" + app.id + "]: " + (ok ? "ok" : "FAILED " + (r.errorText || r.errorCode || "")));
    diag.launches = diag.launches.slice(0, 10);
    if (!ok) toast(app.name + " couldn't open (" + (r.errorText || "not installed?") + ")");
    renderDiag();
  });
}

/* ---------- Tiles and remote navigation ---------- */
var tiles = [];
APPS.forEach(function (app, i) {
  var el = document.createElement("div");
  el.className = "tile";
  el.style.setProperty("--c", app.c);
  el.style.setProperty("--f", app.f || app.c);
  el.style.setProperty("--z", app.z || 1);         // optical size of the logo
  el.innerHTML = '<span class="num">' + (i < 9 ? i + 1 : "0") + '</span><span class="name">' + esc(app.name) + '</span>';
  el.addEventListener("mouseenter", function () { setFocus(i); });
  el.addEventListener("click", function () { setFocus(i); launch(app); });
  (i < 5 ? $("row1") : $("row2")).appendChild(el);
  tiles.push(el);
});

var focus = 0;
function setFocus(i) {
  tiles[focus].classList.remove("focus");
  focus = Math.max(0, Math.min(tiles.length - 1, i));
  tiles[focus].classList.add("focus");
}
setFocus(0);

var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13, BACK: 461, RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406 };
var numDown = {};
document.addEventListener("keydown", function (e) {
  var k = e.keyCode;
  if (diagOpen) { diagKey(k); e.preventDefault(); return; }
  if (wake()) { e.preventDefault(); return; }
  if (k === KEY.LEFT) setFocus(focus % 5 === 0 ? focus : focus - 1);
  else if (k === KEY.RIGHT) setFocus(focus % 5 === 4 ? focus : focus + 1);
  else if (k === KEY.UP) setFocus(focus >= 5 ? focus - 5 : focus);
  else if (k === KEY.DOWN) setFocus(focus < 5 ? focus + 5 : focus);
  else if (k === KEY.OK) launch(APPS[focus]);
  else if (k >= 48 && k <= 57) { if (!e.repeat && !(k in numDown)) numDown[k] = Date.now(); }
  else if (k === KEY.RED) { openDiag(); }
  else if (k === KEY.BLUE) { setTimeout(goAmbient, 300); }
  else if (k === KEY.BACK) { /* stay on the launcher */ }
  else return;
  e.preventDefault();
});
// Number keys: a quick tap opens the app; a long hold is left to the TV's Quick Access
document.addEventListener("keyup", function (e) {
  var k = e.keyCode;
  if (!(k in numDown)) return;
  var held = Date.now() - numDown[k];
  delete numDown[k];
  if (held > 500) return;
  var n = k === 48 ? 9 : k - 49;
  if (APPS[n]) { setFocus(n); launch(APPS[n]); }
});
window.addEventListener("blur", function () { numDown = {}; });

/* ---------- Clock ---------- */
var DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function pad(n) { return n < 10 ? "0" + n : "" + n; }
function greeting(h) { return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }
function tick() {
  var d = new Date();
  var t = pad(d.getHours()) + ":" + pad(d.getMinutes());
  var ds = DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()];
  $("clock").textContent = t;
  $("date").textContent = greeting(d.getHours()) + " · " + ds;
  $("amb-clock").textContent = t;
  $("amb-sub").textContent = ds + (lastWeather ? " · " + lastWeather : "");
}

/* ---------- Weather (Open-Meteo, no key needed) ---------- */
var lastWeather = "";
function wInfo(code, isDay) {
  if (code === 0) return [isDay ? "☀" : "☾", "Clear"];
  if (code <= 2) return [isDay ? "⛅" : "☁", "Partly cloudy"];
  if (code === 3) return ["☁", "Overcast"];
  if (code === 45 || code === 48) return ["〰", "Fog"];
  if (code >= 51 && code <= 57) return ["☂", "Drizzle"];
  if (code >= 61 && code <= 67) return ["☂", "Rain"];
  if (code >= 71 && code <= 77) return ["❄", "Snow"];
  if (code >= 80 && code <= 82) return ["☂", "Showers"];
  if (code >= 85 && code <= 86) return ["❄", "Snow showers"];
  if (code >= 95) return ["⚡", "Thunderstorms"];
  return ["·", ""];
}
function loadWeather() {
  var url = "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
    "&current=temperature_2m,weather_code,is_day,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
    "&timezone=Europe%2FLondon&wind_speed_unit=mph&forecast_days=1";
  fetch(url).then(function (r) { return r.json(); }).then(function (j) {
    var c = j.current, d = j.daily, info = wInfo(c.weather_code, c.is_day);
    var t = Math.round(c.temperature_2m);
    $("wIcon").parentNode.style.display = "";
    $("wIcon").textContent = info[0];
    $("wTemp").textContent = t + "°";
    $("wDesc").textContent = info[1] + " · H " + Math.round(d.temperature_2m_max[0]) + "° L " +
      Math.round(d.temperature_2m_min[0]) + "° · " + d.precipitation_probability_max[0] + "% rain · " + Math.round(c.wind_speed_10m) + " mph";
    lastWeather = t + "° " + info[1].toLowerCase();
  }).catch(function () {
    if (!lastWeather) { $("wDesc").textContent = "Weather unavailable right now"; $("wIcon").parentNode.style.display = "none"; }
  });
}

/* ---------- Toast ---------- */
var toastT;
function toast(msg) {
  var t = $("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, 2600);
}

/* ---------- Photos: a crossfading slideshow used in two places ---------- */
function Slideshow(el, seconds, kenBurns, alwaysFill) {
  var layers = [0, 1].map(function () {
    var L = document.createElement("div"); L.className = "ph-layer";
    L.innerHTML = '<div class="ph-bg"></div><img class="ph-fg" alt="">';
    el.appendChild(L); return L;
  });
  var cur = 0, idx = Math.floor(Math.random() * PHOTOS.length), timer = null, failures = 0;
  function show() {
    if (!PHOTOS.length) return;
    idx = (idx + 1) % PHOTOS.length;
    var src = PHOTOS[idx], pre = new Image();
    pre.onload = function () {
      failures = 0;
      var next = layers[1 - cur], fg = next.querySelector(".ph-fg");
      var ratio = pre.naturalWidth / pre.naturalHeight;
      next.querySelector(".ph-bg").style.backgroundImage = "url('" + src + "')";
      fg.src = src;
      fg.className = "ph-fg " + (alwaysFill || (ratio > 1.45 && ratio < 1.95) ? "cover" : "contain");
      if (kenBurns) { next.classList.remove("kb", "kb1", "kb2"); void next.offsetWidth; next.classList.add("kb", Math.random() < .5 ? "kb1" : "kb2"); }
      next.classList.add("on"); layers[cur].classList.remove("on");
      cur = 1 - cur;
    };
    pre.onerror = function () { if (++failures < PHOTOS.length) show(); };
    pre.src = src;
  }
  return {
    start: function () { if (timer || !PHOTOS.length) return; show(); timer = setInterval(show, seconds * 1000); },
    stop: function () { clearInterval(timer); timer = null; }
  };
}
var ambShow = Slideshow($("amb-photos"), AMBIENT_PHOTO_SECONDS, true);
if (PHOTOS.length) $("ambient").classList.add("has-photos");

/* ---------- Burn-in protection: pixel shift + ambient mode ---------- */
var step = 0;
function pixelShift() {
  var offs = [[0,0],[6,4],[-5,6],[4,-6],[-6,-3]];
  step = (step + 1) % offs.length;
  $("shift").style.transform = "translate(" + offs[step][0] + "px," + offs[step][1] + "px)";
}
var idleT, ambOn = false, ambSince = 0;
function moveAmbientInfo() {
  var info = $("amb-info");
  info.style.left = (120 + Math.random() * 1250) + "px";
  info.style.top = (120 + Math.random() * 700) + "px";
}
function goAmbient() {
  if (ambOn) return;
  ambOn = true; ambSince = Date.now(); moveAmbientInfo();
  $("ambient").classList.remove("sleep");
  $("ambient").classList.add("on");
  ambShow.start();
}
function resetIdle() { clearTimeout(idleT); idleT = setTimeout(goAmbient, IDLE_MS); }
function wake() {
  var was = ambOn;
  if (ambOn) { ambOn = false; $("ambient").classList.remove("on"); ambShow.stop(); }
  resetIdle();
  return was;
}
function ambientTick() {
  if (!ambOn) return;
  moveAmbientInfo();
  if (Date.now() - ambSince > AMBIENT_PHOTOS_FOR_MINUTES * 60000 && !$("ambient").classList.contains("sleep")) {
    $("ambient").classList.add("sleep"); ambShow.stop();
  }
}
["mousemove", "click", "touchstart"].forEach(function (ev) {
  document.addEventListener(ev, function () { if (!diagOpen) wake(); }, { passive: true });
});

/* ---------- Pick up new hosted code while idle (no reinstall needed) ---------- */
var REMOTE = window.TVHOME_REMOTE || "";
var loadedHash = null;
function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
function checkForUpdate() {
  if (!REMOTE) return;
  fetch(REMOTE + "app.js?t=" + Date.now(), { cache: "no-store" }).then(function (r) {
    if (!r.ok) throw 0; return r.text();
  }).then(function (txt) {
    var h = hash(txt);
    if (/^https:/.test(BASE)) {
      if (loadedHash === null) { loadedHash = h; return; }
      if (h !== loadedHash && ambOn) location.reload();
    } else if (ambOn && txt.indexOf("TVHOME_STARTED") > -1) {
      location.reload();   // running the offline copy but the internet is back
    }
  }).catch(function () {});
}

/* ---------- Diagnostics overlay (red button) ---------- */
var diagOpen = false;
function openDiag() { diagOpen = true; renderDiag(); $("diag").classList.add("on"); $("diag").scrollTop = 0; }
function closeDiag() { diagOpen = false; $("diag").classList.remove("on"); resetIdle(); }
function diagKey(k) {
  var box = $("diag");
  if (k === KEY.RED || k === KEY.BACK || k === KEY.OK) closeDiag();
  else if (k === KEY.DOWN) box.scrollTop += 300;
  else if (k === KEY.UP) box.scrollTop -= 300;
  else if (k === KEY.GREEN) { diag.calls = []; resolveIds(); toast("Re-checking the TV app list"); }
}
function row(cells, cls) {
  return "<tr" + (cls ? ' class="' + cls + '"' : "") + ">" + cells.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>";
}
function renderDiag() {
  if (!diagOpen) return;
  var h = '<h1>Diagnostics</h1><p class="d-help">Up/Down to scroll · Green: check again · Red, Back or OK: close · Take a photo of each page and send it to Claude</p>';
  h += "<h2>Basics</h2><table>" +
    row(["App code", "v" + APP_VERSION + ", " + SOURCE]) +
    row(["Loaded from", BASE || "(unknown)"]) +
    row(["Live address", REMOTE || "(not set)"]) +
    row(["Shell", "v" + (window.TVHOME_SHELL || "?")]) +
    row(["PalmServiceBridge", diag.bridge ? "present" : "MISSING"]) +
    row(["Page address", location.href]) +
    row(["Photos bundled", PHOTOS.length + ""]) +
    row(["My icons bundled", Object.keys(MY_ICONS).join(", ") || "none"]) +
    row(["Screen", window.innerWidth + "x" + window.innerHeight]) + "</table>";
  h += "<h2>App list requests</h2><table>";
  diag.calls.forEach(function (c) { h += row([c.uri, c.ok ? "OK" : "FAILED", c.info], c.ok ? "" : "bad"); });
  if (!diag.calls.length) h += row(["(waiting for reply)"]);
  h += "</table><h2>Tiles</h2><table>" + row(["Tile", "Launch id", "Id source", "Matched TV app", "Icon", "Icon result"], "head");
  APPS.forEach(function (a) {
    var d = diag.tiles[a.key];
    h += row([a.name, a.id, d.idFrom, d.match, d.icon, d.iconStatus], /NOT FOUND|ERROR/.test(d.match + d.iconStatus) ? "bad" : "");
  });
  h += "</table><h2>Recent launches</h2><table>";
  diag.launches.forEach(function (l) { h += row([l], /FAILED/.test(l) ? "bad" : ""); });
  if (!diag.launches.length) h += row(["(none yet)"]);
  h += "</table><h2>All apps the TV reported (" + (diag.points ? diag.points.length : 0) + ")</h2><table>" + row(["Title", "Id", "Icon path"], "head");
  (diag.points || []).forEach(function (p) { h += row([p.title || "", p.id || "", p.largeIcon || p.icon || ""]); });
  h += "</table>";
  $("diag-body").innerHTML = h;
}

/* ---------- Start ---------- */
tick(); setInterval(tick, 1000);
loadWeather(); setInterval(loadWeather, 15 * 60 * 1000);
setInterval(pixelShift, 60 * 1000);
setInterval(ambientTick, 45 * 1000);
setInterval(checkForUpdate, UPDATE_CHECK_MINUTES * 60 * 1000); checkForUpdate();
resetIdle();
useMyIcons();
resolveIds();
document.addEventListener("visibilitychange", function () {
  if (!document.hidden) { loadWeather(); wake(); }
});
})();

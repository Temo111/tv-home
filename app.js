/* Tom's TV Home: hosted app code ("Haar" design).
   This file is served from GitHub Pages and injected into the small local page
   inside the TV app, so PalmServiceBridge works and relative paths (photos/,
   icons/) point at the files bundled in the app on the TV.
   A copy of this file is bundled in the app as a fallback for when the
   internet or GitHub Pages is down. */
(function () {
"use strict";
if (window.TVHOME_STARTED) return;          // only one copy ever runs
window.TVHOME_STARTED = true;

var APP_VERSION = "3.0.0";

/* ---------- Config: apps in priority order ----------
   id     = the webOS app id used to launch the app.
   match  = words looked for in the TV's own app list, which corrects the id
            automatically if the TV allows the launcher to read that list.
   key    = file name to use for a home-made icon in the my-icons folder.
   c      = brand colour (mixed into the dark tile when selected).
   w,h,z  = optical size of the logo: max width, max height (px) and zoom. */
var APPS = [
  { name: "Netflix",     key: "netflix",     id: "netflix",                    match: ["netflix"],                 c: "#e50914", h: 70 },
  { name: "Prime Video", key: "prime-video", id: "amazon",                     match: ["prime video", "amazon"],   c: "#1a98ff", w: 170, h: 60, z: 1.15 },
  { name: "Apple TV",    key: "apple-tv",    id: "com.apple.appletv",          match: ["apple tv"],                c: "#8e8e93", h: 60, z: 1.35 },
  { name: "YouTube",     key: "youtube",     id: "youtube.leanback.v4",        match: ["youtube"],                 c: "#ff0000", h: 72, z: 1.15, not: ["kids", "music", "tv"] },
  { name: "BBC iPlayer", key: "bbc-iplayer", id: "bbc.iplayer.3.0",            match: ["iplayer"],                 c: "#ff4c98", w: 190, h: 64 },
  { name: "NOW",         key: "now",         id: "com.nowtv.nowtv",            match: ["=now", "now tv", "nowtv"], c: "#00c2a8", w: 170, h: 80, z: 2.0 },
  { name: "Disney+",     key: "disney-plus", id: "com.disney.disneyplus-prod", match: ["disney"],                  c: "#1f4fd8", w: 170, h: 80, z: 1.15 },
  { name: "Peloton",     key: "peloton",     id: "com.onepeloton.callisto",    match: ["peloton"],                 c: "#df1c2f", h: 66 },
  { name: "Channel 4",   key: "channel-4",   id: "channel4",                   match: ["channel 4", "channel4"],   c: "#6bbf2a", h: 70 },
  { name: "Crunchyroll", key: "crunchyroll", id: "crunchyroll",                match: ["crunchyroll"],             c: "#ff7a1a", h: 68 }
];
var LAT = 55.0179, LON = -1.4254;           // Tynemouth
var DIM_MS = 60 * 1000;                     // home screen dims after 1 minute idle
var IDLE_MS = 2 * 60 * 1000;                // photo mode after 2 minutes idle
var PHOTO_SECONDS = 20;                     // each photo (pairs get 25)
var PHOTOS_FOR_MINUTES = 90;                // then photos fade out, dim clock only
var NIGHT_FROM = 22, NIGHT_TO = 7;          // dimmer everything at night
var UPDATE_CHECK_MINUTES = 30;              // look for new hosted code (applied only while idle)

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
document.getElementById("root").innerHTML =
  '<div id="stage">' +
  '  <div id="shift">' +
  '    <div class="clock" id="clock">--:--</div>' +
  '    <div class="date" id="date"></div>' +
  '    <div class="wx"><div class="wx-t" id="wTemp"></div><div class="wx-c" id="wCond">Weather loading</div><div class="wx-d" id="wDetail"></div></div>' +
  '    <div class="sky" id="sky"><div class="sky-base"></div><div class="sky-day" id="skyDay"></div>' +
  '      <div class="sky-sun" id="skySun"></div><div class="sky-lab" id="skyRise"></div><div class="sky-lab" id="skySet"></div></div>' +
  '    <div class="grid" id="grid"></div>' +
  '  </div>' +
  '  <div id="toast"></div>' +
  '  <div id="ambient">' +
  '    <div id="amb-photos"></div><div class="amb-scrim"></div>' +
  '    <div id="amb-info"><div id="amb-clock">--:--</div><div id="amb-sub"></div></div>' +
  '  </div>' +
  '  <div id="diag"><div id="diag-body"></div></div>' +
  '</div>';
function $(id) { return document.getElementById(id); }

/* ---------- Font and stylesheet, then show ---------- */
(function () {
  var f = document.createElement("link");
  f.rel = "stylesheet";
  f.href = "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap";
  document.head.appendChild(f);
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

/* ---------- Tiles ---------- */
function mix(hex, a) {           // brand colour mixed into the tile colour, for a muted selection
  var base = [0x16, 0x18, 0x1a];
  var c = [1, 3, 5].map(function (i) { return parseInt(hex.substr(i, 2), 16); });
  return "rgb(" + c.map(function (v, i) { return Math.round(base[i] * (1 - a) + v * a); }).join(",") + ")";
}
var tiles = [];
APPS.forEach(function (app, i) {
  var el = document.createElement("div");
  el.className = "tile";
  el.style.setProperty("--fc", mix(app.c, 0.45));
  el.style.setProperty("--w", (app.w || 150) + "px");
  el.style.setProperty("--h", (app.h || 56) + "px");
  el.style.setProperty("--z", app.z || 1);
  el.innerHTML = '<span class="name">' + esc(app.name) + '</span>';
  el.addEventListener("mouseenter", function () { setFocus(i); });
  el.addEventListener("click", function () { setFocus(i); launch(app); });
  $("grid").appendChild(el);
  tiles.push(el);
});

function setIcon(app, src, bg, from) {
  var el = tiles[APPS.indexOf(app)], d = diag.tiles[app.key];
  if (!el) return;
  d.icon = from + ": " + src; d.iconStatus = "loading";
  var img = new Image();
  img.onload = function () {
    d.iconStatus = "loaded (" + img.naturalWidth + "x" + img.naturalHeight + ")";
    el.classList.add("has-icon");
    el.classList.toggle("mono", /\/logo-/.test(src));      // official logos, shown in soft white
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
  APPS.forEach(function (app) { var f = myIcon(app); if (f) setIcon(app, f, null, "my-icons"); });
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

var focus = 0;
function setFocus(i) {
  tiles[focus].classList.remove("focus");
  focus = Math.max(0, Math.min(tiles.length - 1, i));
  tiles[focus].classList.add("focus");
}
setFocus(0);

/* ---------- Remote control ---------- */
var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13, BACK: 461, RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406 };
var numDown = {};
document.addEventListener("keydown", function (e) {
  var k = e.keyCode;
  if (diagOpen) { diagKey(k); e.preventDefault(); return; }
  if (wake()) { e.preventDefault(); return; }       // first press only wakes the screen
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
// Number keys 1 to 0: a quick tap opens the app; a long hold is left to the TV's Quick Access
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

/* ---------- Clock, date and the daylight line ---------- */
var DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function pad(n) { return n < 10 ? "0" + n : "" + n; }
function hm(mins) { mins = Math.round(mins); return pad(Math.floor(mins / 60) % 24) + ":" + pad(mins % 60); }
function isNight(d) { var h = d.getHours(); return h >= NIGHT_FROM || h < NIGHT_TO; }

// Sunrise and sunset in local minutes after midnight (NOAA approximation)
function sunTimes(d) {
  var start = new Date(d.getFullYear(), 0, 0), day = Math.floor((d - start) / 86400000);
  var g = 2 * Math.PI / 365 * (day - 1);
  var decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) +
             0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  var eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  var lat = LAT * Math.PI / 180;
  var cosH = Math.cos(90.833 * Math.PI / 180) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl);
  var ha = Math.acos(Math.max(-1, Math.min(1, cosH))) * 180 / Math.PI;
  var offset = -d.getTimezoneOffset();          // local time, including British Summer Time
  return { rise: 720 - 4 * (LON + ha) - eq + offset, set: 720 - 4 * (LON - ha) - eq + offset };
}
var SKY_W = 1760;
function drawSky(d) {
  var t = sunTimes(d), now = d.getHours() * 60 + d.getMinutes();
  var x = function (m) { return (m / 1440) * SKY_W; };
  var day = now >= t.rise && now <= t.set;
  $("skyDay").style.left = x(t.rise) + "px";
  $("skyDay").style.width = (x(t.set) - x(t.rise)) + "px";
  $("skySun").style.left = x(now) + "px";
  $("sky").classList.toggle("night", !day);
  $("skyRise").style.left = x(t.rise) + "px"; $("skyRise").textContent = hm(t.rise);
  $("skySet").style.left = x(t.set) + "px";   $("skySet").textContent = hm(t.set);
}
var lastMinute = -1;
function tick() {
  var d = new Date();
  var t = pad(d.getHours()) + ":" + pad(d.getMinutes());
  var ds = DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()];
  $("clock").textContent = t;
  $("date").textContent = ds;
  $("amb-clock").textContent = t;
  $("amb-sub").textContent = ds + (lastWeather ? " · " + lastWeather : "");
  if (d.getMinutes() !== lastMinute) {
    lastMinute = d.getMinutes();
    drawSky(d);
    stage.classList.toggle("night", isNight(d));
  }
}

/* ---------- Weather (Open-Meteo, no key needed) ---------- */
var lastWeather = "";
function wWord(code) {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorms";
  return "";
}
function loadWeather() {
  var url = "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
    "&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
    "&timezone=Europe%2FLondon&wind_speed_unit=mph&forecast_days=1";
  fetch(url).then(function (r) { return r.json(); }).then(function (j) {
    var c = j.current, d = j.daily, word = wWord(c.weather_code), t = Math.round(c.temperature_2m);
    $("wTemp").textContent = t + "°";
    $("wCond").textContent = word;
    $("wDetail").textContent = Math.round(d.temperature_2m_min[0]) + "° to " + Math.round(d.temperature_2m_max[0]) + "° · Rain " +
      d.precipitation_probability_max[0] + "% · Wind " + Math.round(c.wind_speed_10m) + " mph";
    lastWeather = t + "° " + word.toLowerCase();
  }).catch(function () {
    if (!lastWeather) { $("wTemp").textContent = ""; $("wCond").textContent = ""; $("wDetail").textContent = "Weather unavailable"; }
  });
}

/* ---------- Toast ---------- */
var toastT;
function toast(msg) {
  var t = $("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, 2600);
}

/* ---------- Photo mode: landscape fills the screen, portraits come in pairs ---------- */
var ratios = {};                                   // photo -> width/height, learned as they load
function loadPhoto(src, cb) {
  var im = new Image();
  im.onload = function () { ratios[src] = im.naturalWidth / im.naturalHeight; cb(true); };
  im.onerror = function () { cb(false); };
  im.src = src;
}
var Photos = (function () {
  var box = $("amb-photos"), layers = [0, 1].map(function () {
    var L = document.createElement("div"); L.className = "ph-layer"; box.appendChild(L); return L;
  });
  var cur = 0, idx = Math.floor(Math.random() * PHOTOS.length), timer = null, running = false, fails = 0;
  function next() { idx = (idx + 1) % PHOTOS.length; return PHOTOS[idx]; }
  function render(list) {
    var L = layers[1 - cur], html;
    if (list.length === 2) {
      html = '<div class="ph-pair"><img src="' + list[0] + '" alt=""><img src="' + list[1] + '" alt=""></div>';
    } else {
      var r = ratios[list[0]];
      html = '<img class="ph-one ' + (r > 1.45 && r < 1.95 ? "cover" : "contain") + '" src="' + list[0] + '" alt="">';
    }
    L.innerHTML = html;
    L.classList.remove("kb1", "kb2"); void L.offsetWidth; L.classList.add(Math.random() < .5 ? "kb1" : "kb2");
    L.classList.add("on"); layers[cur].classList.remove("on");
    cur = 1 - cur;
    timer = setTimeout(step, (list.length === 2 ? PHOTO_SECONDS + 5 : PHOTO_SECONDS) * 1000);
  }
  function step() {
    if (!running || !PHOTOS.length) return;
    var a = next();
    loadPhoto(a, function (ok) {
      if (!ok) { if (++fails < PHOTOS.length) step(); return; }
      fails = 0;
      if (ratios[a] >= 1 || PHOTOS.length < 2) { render([a]); return; }
      // a portrait: look ahead for a second portrait to pair with it
      var look = 0, i0 = idx;
      (function seek() {
        if (look++ >= Math.min(6, PHOTOS.length - 1)) { idx = i0; render([a]); return; }
        var j = (i0 + look) % PHOTOS.length, b = PHOTOS[j];
        loadPhoto(b, function (ok2) {
          if (ok2 && ratios[b] < 1 && b !== a) {
            if (look === 1) idx = j;                   // only skip ahead if it was the very next photo
            render([a, b]);
          } else seek();
        });
      })();
    });
  }
  return {
    start: function () { if (running || !PHOTOS.length) return; running = true; step(); },
    stop: function () { running = false; clearTimeout(timer); }
  };
})();
if (PHOTOS.length) $("ambient").classList.add("has-photos");

/* ---------- Burn-in protection, dimming and photo mode ---------- */
var step = 0;
function pixelShift() {
  var offs = [[0,0],[6,4],[-5,6],[4,-6],[-6,-3]];
  step = (step + 1) % offs.length;
  $("shift").style.transform = "translate(" + offs[step][0] + "px," + offs[step][1] + "px)";
}
var corner = 0;
function moveAmbientInfo(newCorner) {
  var info = $("amb-info");
  if (newCorner) {
    corner = 1 - corner;
    info.classList.add("fade");
    setTimeout(function () { info.classList.toggle("right", corner === 1); info.classList.remove("fade"); }, 900);
  }
  info.style.transform = "translate(" + Math.round(Math.random() * 24 - 12) + "px," + Math.round(Math.random() * 24 - 12) + "px)";
}
var dimT, idleT, ambOn = false, ambSince = 0;
function goAmbient() {
  if (ambOn) return;
  ambOn = true; ambSince = Date.now();
  $("ambient").classList.remove("sleep");
  $("ambient").classList.add("on");
  Photos.start();
}
function resetIdle() {
  stage.classList.remove("dim");
  clearTimeout(dimT); clearTimeout(idleT);
  dimT = setTimeout(function () { stage.classList.add("dim"); }, DIM_MS);
  idleT = setTimeout(goAmbient, IDLE_MS);
}
function wake() {
  var was = ambOn;
  if (ambOn) { ambOn = false; $("ambient").classList.remove("on"); Photos.stop(); }
  resetIdle();
  return was;
}
var ambTicks = 0;
function ambientTick() {
  if (!ambOn) return;
  ambTicks++;
  moveAmbientInfo(ambTicks % 4 === 0);            // small drift each minute, other corner every 4 minutes
  if (Date.now() - ambSince > PHOTOS_FOR_MINUTES * 60000 && !$("ambient").classList.contains("sleep")) {
    $("ambient").classList.add("sleep"); Photos.stop();
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
    row(["Icons bundled", Object.keys(MY_ICONS).join(", ") || "none"]) +
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
setInterval(pixelShift, 3 * 60 * 1000);
setInterval(ambientTick, 60 * 1000);
setInterval(checkForUpdate, UPDATE_CHECK_MINUTES * 60 * 1000); checkForUpdate();
resetIdle();
useMyIcons();
resolveIds();
document.addEventListener("visibilitychange", function () {
  if (!document.hidden) { loadWeather(); wake(); }
});
})();

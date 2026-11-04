/* Tom's TV Home: local loader (part of the app installed on the TV).
   Loads the live app code from Tom's own GitHub Pages address only, over HTTPS.
   If that does not arrive within a few seconds, it runs the copy bundled in the app. */
(function () {
  "use strict";
  window.TVHOME_SHELL = "__SHELL_VERSION__";
  var REMOTE = "__REMOTE_BASE__";            // filled in by build-and-install.ps1
  var PINNED = /^https:\/\/[a-z0-9-]+\.github\.io\/[A-Za-z0-9._-]+\/$/;
  var started = false;

  function inject(src, onfail) {
    var s = document.createElement("script");
    s.src = src;
    if (onfail) s.onerror = onfail;
    document.body.appendChild(s);
  }
  function fallback() {
    if (started || window.TVHOME_STARTED) return;
    started = true;
    inject("fallback/app.js");
  }

  if (PINNED.test(REMOTE)) {
    window.TVHOME_REMOTE = REMOTE;
    inject(REMOTE + "app.js?t=" + Date.now(), fallback);
    setTimeout(fallback, 8000);   // slow or no network: use the built-in copy
  } else {
    fallback();
  }
})();

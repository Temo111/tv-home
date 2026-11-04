# TV Home

A custom home screen for an LG webOS TV, installed as a Developer Mode web app.

* `app.js`, `app.css`: the live app code, served by GitHub Pages and loaded by the TV app on start.
  Push a change here and the TV picks it up next time it starts, or within 30 minutes while idle.
* `shell/`: the small local page packaged into the TV app. It only accepts code from this
  repository's own GitHub Pages address over HTTPS, and falls back to a bundled copy when offline.
* `.github/workflows/devmode-renew.yml`: resets the Developer Mode session timer every 12 hours.
  The session token is kept only in the `DEVMODE_TOKEN` Actions secret.
* `tools/`, `*.bat`: Windows scripts to set up, build, and install with LG's official webOS CLI.

Personal photos and any downloaded app icons are kept on the PC and bundled into the TV app only;
they are excluded from this repository by `.gitignore`.

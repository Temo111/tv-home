# Security notes (version 2.0.0 / shell 1.1.0)

What changed and how each risk is handled.

1. **Live code from the internet.** The TV app now runs code from GitHub Pages.
   * The loader only accepts an address of the form `https://<user>.github.io/<repo>/` and the
     address is fixed when the app is built. The page's Content Security Policy only allows
     scripts from the app itself and that one address, so other websites cannot inject code.
   * Whoever controls the GitHub account controls the code on the TV. Setup checks two-factor
     sign-in and opens the settings page if it cannot confirm it.
   * If Pages is down or the network is slow (8 seconds), the bundled copy runs instead.
2. **Personal photos.** Kept in `photos-inbox/` on the PC, excluded by `.gitignore`, and setup
   refuses to publish if any photo, icon, build or settings file is staged. Photos are rebuilt as
   new JPEGs from pixels only (no camera, date or GPS details), shrunk to fit 1920x1080, and renamed
   p001.jpg and so on so original file names are not kept.
3. **Developer Mode token.** Read from the TV and passed straight to `gh secret set`. It is never
   printed, written to a file, committed, or pasted into chat. The workflow passes it to curl through
   an environment variable and GitHub masks secret values in logs. The workflow has read-only access
   to code; its only write permission is to keep its own schedule switched on.
4. **Key Server.** The install script asks for it to be switched on just before installing and
   reminds you to switch it off afterwards.
5. **Brand logos.** None are drawn or included. Tiles show the TV's own installed icons if webOS
   allows it, otherwise icons you download yourself, which stay on the PC (`my-icons/`, not published).
6. **Tools.** Only LG's official `@webos-tools/cli`, Git, and GitHub's own CLI (`gh`) are used.
   The workflow uses no third-party GitHub Actions.
7. **Location.** The public code contains Tynemouth's town-level coordinates for the weather (no address).

Unverified until tested on the TV: the token file location (`/var/luna/preferences/devmode_enabled`)
and LG's `ResetDevModeSession.dev` endpoint are community-documented, not in LG's official docs. The
first setup run tests them and shows LG's reply.

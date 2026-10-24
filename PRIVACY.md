# Privacy Policy — OpenAltKeys

Last updated: 2026-10-24

OpenAltKeys is a browser extension that displays Office-style key-tip overlays in
Google Sheets, Google Docs and Google Slides and runs the matching commands.

**In short: it collects nothing, sends nothing, and talks to no servers.**

## What it stores

- Your on/off toggles (master switch, per-app switches, F4/Ctrl±/F10 extras)
  and your disabled-sequences list in `chrome.storage.sync`, so your settings
  follow your browser profile. Nothing else is stored.
- There is no account system, no sign-in, no trial, no license check, no
  analytics, no telemetry, no error reporting.

## What it accesses

- The extension injects a content script only into `docs.google.com` spreadsheet,
  document and presentation pages, because that is where it must draw the key-tip
  overlay and dispatch the commands you type. There are no host permissions
  beyond those pages, no `<all_urls>` access, and no remote code — everything
  ships inside the extension package.
- It reads the page's DOM (menus, toolbar buttons) solely to click the Google
  command that matches your key sequence.
- **The power tools read and write document data inside the page, on your
  command only:** Trace Precedents reads the selected cell's formula text;
  Goal Seek reads the selected cells' values via the status bar and **writes
  trial values into the "by changing" cell you name** (restoring the original
  value when it fails or is cancelled; a successful solve keeps the solution
  it found — that is the point of the tool); the symbol palette types the
  symbol you pick into the active cell. All of this happens locally in the
  tab — nothing is stored by the extension and nothing leaves your browser.
- It does not read, store or transmit the contents of your documents beyond
  the cells and formulas you explicitly target with those tools.

## What it sends

- Nothing. There are no network calls of any kind. You can verify this in the
  source (all of it is open, and shipped in the package) or with your
  browser's network inspector.

## Permissions

- `storage` — for the settings toggles described above. That is the only
  permission the extension requests. The browser's install notice about
  "read and change your data on docs.google.com" comes from the content
  script needing to run on those pages — it cannot read any other site.

## Contact

OpenAltKeys is community-maintained, MIT-licensed open source. File issues at
the project's repository (see the README in this package for the source tree
and test suite).

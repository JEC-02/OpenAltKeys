/*
 * OpenAltKeys — background.js
 * Deliberately tiny: OpenAltKeys has no accounts, no tracking and no
 * network calls. The service worker exists only to show a short "Alt"
 * hint badge after installation. The badge is cleared by a message from
 * the content script or popup (durable — no MV3-killed timers), never by
 * a setTimeout the worker may not survive (P3).
 *
 * Part of OpenAltKeys (MIT License).
 */

async function clearBadge() {
  try {
    await chrome.action.setBadgeText({ text: "" });
  } catch (e) {
    /* badge API not critical */
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Chrome's chrome.action returns a promise; Firefox's chrome.* porting
    // namespace is callback-based and may return undefined. Support both
    // (audit §5) — the badge still gets set either way.
    try {
      const r = chrome.action.setBadgeText({ text: "Alt" });
      if (r && typeof r.catch === "function") r.catch(() => {});
    } catch (e) {
      /* callback-based namespace — nothing to await */
    }
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && (msg.type === "oak-activated" || msg.type === "oak-popup-opened")) {
    clearBadge();
  }
});

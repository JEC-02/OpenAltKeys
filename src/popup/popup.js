/*
 * OpenAltKeys — popup.js
 * Settings toggles + searchable cheat sheet (rendering shared with the
 * options page via src/shared/cheatsheet.js). Remembers the last-open tab.
 * Part of OpenAltKeys (MIT License). Original independent implementation.
 */
(function () {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    sheets: true,
    docs: true,
    slides: true,
    f4Repeat: true,
    ctrlRowCol: true,
    f10Modes: true,
    disabledSeqs: "",
  };
  let settings = { ...DEFAULTS };
  let app = "sheets";

  const $ = (id) => document.getElementById(id);

  function renderList() {
    window.OAKCheat.renderList({
      searchEl: $("search"),
      listEl: $("list"),
      countEl: $("count"),
      getApp: () => app,
    });
  }

  function bindToggles() {
    $("master").addEventListener("change", (e) => {
      settings.enabled = e.target.checked;
      save();
    });
    const map = {
      "app-sheets": "sheets",
      "app-docs": "docs",
      "app-slides": "slides",
      "opt-f4": "f4Repeat",
      "opt-ctrlrc": "ctrlRowCol",
      "opt-f10": "f10Modes",
    };
    for (const [id, key] of Object.entries(map)) {
      $(id).addEventListener("change", (e) => {
        settings[key] = e.target.checked;
        save();
      });
    }
  }

  function applyUI() {
    $("master").checked = settings.enabled !== false;
    $("app-sheets").checked = settings.sheets !== false;
    $("app-docs").checked = settings.docs !== false;
    $("app-slides").checked = settings.slides !== false;
    $("opt-f4").checked = settings.f4Repeat !== false;
    $("opt-ctrlrc").checked = settings.ctrlRowCol !== false;
    $("opt-f10").checked = settings.f10Modes !== false;
  }

  function save() {
    chrome.storage.sync.set(settings, () => {
      void chrome.runtime.lastError; // never swallow silently (P3)
    });
  }

  // Remember the last-open app tab (P2.14).
  function rememberApp(a) {
    try {
      chrome.storage.local.set({ lastApp: a }, () => { void chrome.runtime.lastError; });
    } catch (e) { /* local storage unavailable — non critical */ }
  }

  function selectApp(a, saveIt) {
    document.querySelectorAll("#tabs button").forEach((x) => x.classList.remove("active"));
    const btn = document.querySelector(`#tabs button[data-app="${a}"]`);
    if (btn) btn.classList.add("active");
    app = a;
    if (saveIt) rememberApp(a);
    renderList();
  }

  document.querySelectorAll("#tabs button").forEach((b) => {
    b.addEventListener("click", () => selectApp(b.dataset.app, true));
  });
  $("search").addEventListener("input", renderList);
  $("open-options").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Clear the install badge as soon as the popup is opened (P2.14).
  try { chrome.runtime.sendMessage({ type: "oak-popup-opened" }); } catch (e) { /* ignore */ }

  chrome.storage.local.get({ lastApp: "sheets" }, (local) => {
    const startApp = local && local.lastApp && window.OAK_DATA[local.lastApp]
      ? local.lastApp : "sheets";
    chrome.storage.sync.get(DEFAULTS, (res) => {
      if (chrome.runtime.lastError) res = {};
      settings = { ...DEFAULTS, ...(res || {}) };
      applyUI();
      bindToggles();
      selectApp(startApp, false);
    });
  });
})();

/*
 * OpenAltKeys — options.js
 * Full settings (per-app switches, F4 / Ctrl± / F10 toggles, disabled
 * sequences) + the shared searchable cheat sheet.
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

  function applyUI() {
    $("master").checked = settings.enabled !== false;
    $("app-sheets").checked = settings.sheets !== false;
    $("app-docs").checked = settings.docs !== false;
    $("app-slides").checked = settings.slides !== false;
    $("opt-f4").checked = settings.f4Repeat !== false;
    $("opt-ctrlrc").checked = settings.ctrlRowCol !== false;
    $("opt-f10").checked = settings.f10Modes !== false;
    $("disabled-seqs").value = settings.disabledSeqs || "";
  }

  function save() {
    chrome.storage.sync.set(settings, () => {
      void chrome.runtime.lastError; // never swallow silently (P3)
    });
  }

  function bind() {
    const map = {
      master: "enabled",
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
    $("disabled-seqs").addEventListener("change", (e) => {
      // normalize: commas / spaces / semicolons → comma-separated uppercase
      const v = e.target.value
        .split(/[\s,;]+/)
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean)
        .join(", ");
      e.target.value = v;
      settings.disabledSeqs = v;
      save();
    });
    document.querySelectorAll("#tabs button").forEach((b) => {
      b.addEventListener("click", () => {
        document.querySelectorAll("#tabs button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        app = b.dataset.app;
        renderList();
      });
    });
    $("search").addEventListener("input", renderList);
  }

  chrome.storage.sync.get(DEFAULTS, (res) => {
    if (chrome.runtime.lastError) res = {};
    settings = { ...DEFAULTS, ...(res || {}) };
    applyUI();
    bind();
    renderList();
  });
})();

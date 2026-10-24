/*
 * OpenAltKeys — shared/cheatsheet.js
 * One renderer for the searchable cheat sheet, used by BOTH the toolbar
 * popup and the options page (no more duplicated rendering logic, P2.22).
 * Renders sequences spaced ("Alt H V V") with digits highlighted and marks
 * guidance-only entries ("guide") so the counts are honest (P2.3/P2.4).
 *
 * Part of OpenAltKeys (MIT License). Original independent implementation.
 */
(function () {
  "use strict";

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // "HVV" → "Alt H V V" with digit badges styled (P2.5).
  function spacedSeqHTML(seq) {
    const parts = String(seq).split("").map((ch) =>
      /^[0-9]$/.test(ch)
        ? `<span class="plus">${esc(ch)}</span>`
        : esc(ch)
    );
    return "Alt " + parts.join(" ");
  }

  function isGuide(entry) {
    return !!(entry.action && entry.action[0] === "t");
  }

  function countsFor(app) {
    const data = (window.OAK_DATA && window.OAK_DATA[app]) || [];
    let shortcuts = 0, guides = 0, tabs = 0;
    for (const e of data) {
      if (!e.action) { tabs++; continue; }
      if (isGuide(e)) guides++; else shortcuts++;
    }
    return { shortcuts, guides, tabs, total: data.length };
  }

  // Render the list into `listEl`; search input `searchEl`; count into `countEl`.
  // getApp() returns the current app key; onCount(counts) optional.
  function renderList(opts) {
    const { searchEl, listEl, countEl, getApp, onCount } = opts;
    const q = String(searchEl.value || "").trim().toLowerCase();
    const data = (window.OAK_DATA && window.OAK_DATA[getApp()]) || [];
    const rows = [];
    for (const e of data) {
      if (!e.action) continue; // tab headings
      const hay = (e.seq + " " + e.label + " " + (e.group || "")).toLowerCase();
      if (q && !hay.includes(q)) continue;
      rows.push(e);
    }
    if (countEl) {
      const c = countsFor(getApp());
      countEl.textContent = q
        ? rows.length + " of " + c.shortcuts + " shortcuts shown"
        : c.shortcuts + " shortcuts · " + c.guides + " guides";
    }
    if (onCount) onCount(countsFor(getApp()));
    listEl.innerHTML = rows
      .map((e) => {
        const guide = isGuide(e);
        return (
          '<div class="row' + (guide ? " guide" : "") + '">' +
          '<span class="seq">' + spacedSeqHTML(e.seq) + "</span>" +
          '<span class="lbl">' + esc(e.label) + "</span>" +
          '<span class="grp">' + esc(e.group || "") + (guide ? " · guide" : "") + "</span>" +
          "</div>"
        );
      })
      .join("");
  }

  window.OAKCheat = { esc, spacedSeqHTML, isGuide, countsFor, renderList };
})();

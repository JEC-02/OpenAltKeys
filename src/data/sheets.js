/*
 * OpenAltKeys — data/sheets.js
 * Excel Alt key sequences → Google Sheets actions.
 *
 * Action specs (see dispatch.js):
 *   ["k","ctrl+shift+v"]            native keyboard shortcut
 *   ["m","data","Item","Sub","Sub"] native menu navigation
 *   ["c","Aria|Candidates"]         toolbar button click (+ optional search fallback)
 *   ["s","query"]                   tool finder (Alt+/) search
 *   ["x","handler", …args]          custom handler from window.OAK_CUSTOM
 *   ["t","message"]                 guidance toast
 * Sequences are Excel's public ribbon key-tips.
 *
 * Part of OpenAltKeys (MIT License). Original independent implementation.
 */
window.OAK_DATA = window.OAK_DATA || {};
window.OAK_CUSTOM = window.OAK_CUSTOM || {};
(function () {
  "use strict";
  const D = [];
  const E = (seq, label, group, action, mode) => D.push({ seq, label, group, action, mode });

  /* ---------- ribbon tabs ---------- */
  E("F", "File", "Tabs");
  E("H", "Home", "Tabs");
  E("N", "Insert", "Tabs");
  E("P", "Page Layout", "Tabs");
  E("A", "Data", "Tabs");
  E("M", "Formulas", "Tabs");
  E("R", "Review", "Tabs");
  E("W", "View", "Tabs");
  E("E", "Edit (classic)", "Tabs");
  E("I", "Insert (classic)", "Tabs");
  E("O", "Format (classic)", "Tabs");

  /* ---------- File ---------- */
  E("FP", "Print", "File", ["x", "printPage"]);  // real window.print(), not a synthetic Ctrl+P
  E("FI", "Version History", "File", ["m", "file", "Version history", "See version history"]);
  E("FS", "Download", "File", ["m", "file", "Download"], "open");
  E("FH", "Share", "File", ["m", "file", "Share", "Share with others"]);
  E("FT", "Settings", "File", ["m", "file", "Settings|Spreadsheet settings"]);
  E("FN", "New Spreadsheet", "File", ["m", "file", "New", "Spreadsheet|Blank spreadsheet"]);

  /* ---------- Home ▸ Clipboard ---------- */
  E("HX", "Cut", "Clipboard", ["k", "ctrl+x"]);
  E("HC", "Copy", "Clipboard", ["k", "ctrl+c"]);
  E("HVP", "Paste", "Clipboard", ["k", "ctrl+v"]);
  E("HVK", "Paste (Keep Source)", "Clipboard", ["k", "ctrl+v"]);
  E("HVV", "Paste Values", "Clipboard", ["k", "ctrl+shift+v"]);
  E("HVF", "Paste Formulas", "Clipboard", ["m", "edit", "Paste special", "Formulas only|Paste formulas only"]);
  E("HVT", "Paste Transpose", "Clipboard", ["m", "edit", "Paste special", "Transposed|Paste transposed"]);
  E("HVB", "Paste All Except Borders", "Clipboard", ["m", "edit", "Paste special", "All except borders|Paste all except borders"]);
  E("HVR", "Paste Formatting", "Clipboard", ["m", "edit", "Paste special", "Format only|Paste format only"]);
  E("HFP", "Format Painter", "Clipboard", ["c", "Paint format|Format painter"]);

  /* ---------- Home ▸ Font ---------- */
  E("H1", "Bold", "Font", ["k", "ctrl+b"]);
  E("H2", "Italic", "Font", ["k", "ctrl+i"]);
  E("H3", "Underline", "Font", ["k", "ctrl+u"]);
  E("HFF", "Font", "Font", ["c", "Font|Font style|More fonts"], "open");
  E("HFS", "Font Size", "Font", ["c", "Font size|Font size (points)|Font size (pt)"], "open");
  E("HFC", "Font Color", "Font", ["c", "Text color|Font color"], "open");
  E("HH", "Fill Color", "Font", ["c", "Fill color|Background color"], "open");
  E("HHN", "No Fill (Reset)", "Font", ["x", "sheetsFillReset"]);

  /* ---------- Home ▸ Borders ---------- */
  E("HBA", "All Borders", "Borders", ["x", "sheetsAllBorders"]);
  E("HBS", "Outer Borders", "Borders", ["k", "alt+shift+7"]);
  E("HBO", "Bottom Border", "Borders", ["k", "alt+shift+3"]);
  E("HBP", "Top Border", "Borders", ["k", "alt+shift+1"]);
  E("HBL", "Left Border", "Borders", ["k", "alt+shift+4"]);
  E("HBR", "Right Border", "Borders", ["k", "alt+shift+2"]);
  E("HBN", "No Border", "Borders", ["k", "alt+shift+6"]);

  /* ---------- Home ▸ Alignment ---------- */
  E("HAL", "Align Left", "Alignment", ["k", "ctrl+shift+l"]);
  E("HAC", "Center", "Alignment", ["k", "ctrl+shift+e"]);
  E("HAR", "Align Right", "Alignment", ["k", "ctrl+shift+r"]);
  E("HAT", "Top Align", "Alignment", ["m", "format", "Alignment", "Top"]);
  E("HAM", "Middle Align", "Alignment", ["m", "format", "Alignment", "Middle"]);
  E("HAB", "Bottom Align", "Alignment", ["m", "format", "Alignment", "Bottom"]);
  E("HW", "Wrap Text", "Alignment", ["x", "sheetsWrap", "Wrap"]);
  E("HFQO", "Angle Counterclockwise", "Alignment", ["m", "format", "Rotation", "Rotate up|Rotate counterclockwise"]);
  E("HFQL", "Angle Clockwise", "Alignment", ["m", "format", "Rotation", "Rotate down|Rotate clockwise"]);
  E("HFQV", "Vertical Text", "Alignment", ["m", "format", "Rotation", "Stack vertically|Vertical text"]);
  E("HFQU", "Rotate Text Up", "Alignment", ["m", "format", "Rotation", "Rotate up"]);
  E("HFQD", "Rotate Text Down", "Alignment", ["m", "format", "Rotation", "Rotate down"]);

  /* ---------- Home ▸ Merge ---------- */
  E("HMC", "Merge & Center", "Merge", ["x", "sheetsMerge", "center"]);
  E("HMA", "Merge Across", "Merge", ["x", "sheetsMerge", "horiz"]);
  E("HMM", "Merge Cells", "Merge", ["x", "sheetsMerge", "all"]);
  E("HMV", "Merge Vertically", "Merge", ["x", "sheetsMerge", "vert"]);
  E("HMU", "Unmerge Cells", "Merge", ["x", "sheetsMerge", "unmerge"]);

  /* ---------- Home ▸ Number ---------- */
  E("HN", "Number Format", "Number", ["m", "format", "Number"], "open");
  E("HAN", "Accounting Format", "Number", ["k", "ctrl+shift+4"]);
  E("HP", "Percent Style", "Number", ["k", "ctrl+shift+5"]);
  E("HK", "Comma Style", "Number", ["k", "ctrl+shift+1"]);
  E("HFM", "More Number Formats", "Number", ["m", "format", "Number", "Custom number format|Custom currency"]);
  E("=", "AutoSum", "Number", ["m", "insert", "Function", "SUM"]);

  /* ---------- Home ▸ Styles ---------- */
  E("HL", "Conditional Formatting", "Styles", ["m", "format", "Conditional formatting"]);
  E("HT", "Format as Table", "Styles", ["k", "ctrl+alt+t"]);

  /* ---------- Home ▸ Insert & Delete ---------- */
  // The row/column is SELECTED first (Shift+Space / Ctrl+Space), because
  // Google's Ctrl+Alt+= / − act on the selection — without it they often
  // just open the Insert menu instead (P1.14).
  E("HIR", "Insert Sheet Rows", "Cells", ["x", "sheetsInsertDelete", "row", "insert"]);
  E("HIC", "Insert Sheet Columns", "Cells", ["x", "sheetsInsertDelete", "col", "insert"]);
  E("HIS", "Insert Sheet", "Cells", ["k", "shift+f11"]);
  E("HDR", "Delete Sheet Rows", "Cells", ["x", "sheetsInsertDelete", "row", "delete"]);
  E("HDC", "Delete Sheet Columns", "Cells", ["x", "sheetsInsertDelete", "col", "delete"]);
  E("HDD", "Delete Cells", "Cells", ["t", "Select rows/columns then Ctrl+Alt+Minus, or right-click"]);
  E("HDS", "Delete Sheet", "Cells", ["t", "Right-click the sheet tab ▸ Delete"]);

  /* ---------- Home ▸ Row Height & Column Width ---------- */
  E("HOI", "AutoFit Column Width", "Cells", ["x", "sheetsResize", "col", "fit"]);
  E("HOA", "AutoFit Row Height", "Cells", ["x", "sheetsResize", "row", "fit"]);
  E("HOW", "Column Width…", "Cells", ["x", "sheetsResize", "col", "specify"]);
  E("HOH", "Row Height…", "Cells", ["x", "sheetsResize", "row", "specify"]);
  E("HOD", "Default Width", "Cells", ["t", "Right-click the column header ▸ Resize columns"]);

  /* ---------- Home ▸ Hide & Unhide ---------- */
  // Select the full rows/columns first so the context menu always offers
  // the Hide/Unhide/Group items (P2.6).
  E("HOUR", "Hide Rows", "Cells", ["x", "sheetsCtx", "Hide row|Hide rows", "row"]);
  E("HOUC", "Hide Columns", "Cells", ["x", "sheetsCtx", "Hide column|Hide columns", "col"]);
  E("HOUO", "Unhide Rows", "Cells", ["x", "sheetsCtx", "Unhide rows|Unhide row", "row"]);
  E("HOUL", "Unhide Columns", "Cells", ["x", "sheetsCtx", "Unhide columns|Unhide column", "col"]);
  E("HOUS", "Hide Sheet", "Cells", ["t", "Right-click the sheet tab ▸ Hide sheet"]);
  E("HOUH", "Unhide Sheet", "Cells", ["t", "Right-click any sheet tab ▸ Unhide"]);

  /* ---------- Home ▸ Organize Sheet ---------- */
  E("HOR", "Rename Sheet", "Sheet", ["k", "alt+1"]);
  E("HOM", "Move or Copy Sheet", "Sheet", ["t", "Right-click the sheet tab ▸ Copy to / Move"]);
  E("HOT", "Tab Color", "Sheet", ["t", "Right-click the sheet tab ▸ Change color"]);
  E("HOP", "Protect Sheet", "Sheet", ["m", "data", "Protect sheets and ranges"]);
  E("HOL", "Lock Cell", "Sheet", ["t", "Use Data ▸ Protect sheets and ranges"]);

  /* ---------- Home ▸ Fill & Clear ---------- */
  E("HFID", "Fill Down", "Editing", ["k", "ctrl+d"]);
  E("HFIR", "Fill Right", "Editing", ["k", "ctrl+r"]);
  E("HFIS", "Fill Series…", "Editing", ["t", "Select the range and use Edit ▸ Fill (or drag the fill handle)"]);
  E("HEA", "Clear All", "Editing", ["k", "delete, ctrl+\\"]);
  E("HEF", "Clear Formats", "Editing", ["k", "ctrl+\\"]);
  E("HEC", "Clear Contents", "Editing", ["k", "delete"]);
  E("HEM", "Clear Comments/Notes", "Editing", ["x", "sheetsCtx", "Clear notes|Delete note"]);
  E("HER", "Remove Hyperlinks", "Editing", ["t", "Select and press Delete, or right-click ▸ Remove link"]);

  /* ---------- Home ▸ Sort & Filter ---------- */
  E("HSS", "Sort A to Z", "Sort & Filter", ["m", "data", "Sort sheet", "A to Z|Sort sheet A to Z"]);
  E("HSO", "Sort Z to A", "Sort & Filter", ["m", "data", "Sort sheet", "Z to A|Sort sheet Z to A"]);
  E("HSU", "Custom Sort…", "Sort & Filter", ["m", "data", "Sort sheet", "Advanced range sort options"]);
  E("HSF", "Filter", "Sort & Filter", ["m", "data", "Create a filter"]);
  E("HSC", "Clear Filter", "Sort & Filter", ["m", "data", "Remove filter|Turn off filter"]);
  E("HSY", "Reapply Filter", "Sort & Filter", ["t", "Click any filter icon ▸ OK"]);

  /* ---------- Insert tab ---------- */
  E("NV", "PivotTable", "Insert", ["m", "insert", "Pivot table"]);
  E("NR", "Recommended Charts", "Insert", ["m", "insert", "Chart"]);
  E("NC1", "Column Chart", "Insert", ["x", "sheetsChartEditor", "Column"]);
  E("NN1", "Line Chart", "Insert", ["x", "sheetsChartEditor", "Line"]);
  E("NQ", "Pie Chart", "Insert", ["x", "sheetsChartEditor", "Pie"]);
  E("ND", "Scatter Chart", "Insert", ["x", "sheetsChartEditor", "Scatter"]);
  E("NP", "Insert Picture", "Insert", ["m", "insert", "Image", "Insert image in cell|Image in cell"]);
  E("NSL", "Line Sparkline", "Insert", ["t", "Type =SPARKLINE(range) in a cell"]);
  E("NSO", "Column Sparkline", "Insert", ["t", "Type =SPARKLINE(range, {\"charttype\",\"column\"})"]);
  E("NSW", "Win/Loss Sparkline", "Insert", ["t", "Type =SPARKLINE(range, {\"charttype\",\"winloss\"})"]);
  E("NT", "Table", "Insert", ["k", "ctrl+alt+t"]);
  E("NSH", "Drawing", "Insert", ["m", "insert", "Drawing"]);
  E("NU", "Symbol…", "Insert", ["x", "symbolPicker"]);
  E("NI2", "Insert Link", "Insert", ["k", "ctrl+k"]);
  E("NC2", "Insert Comment", "Insert", ["k", "ctrl+alt+m"]);
  E("NSF", "Add Slicer", "Insert", ["m", "data", "Add a slicer"]);
  E("NAS", "Get Add-ons", "Insert", ["m", "extensions", "Add-ons", "Get add-ons"]);
  E("NAP", "Manage Add-ons", "Insert", ["m", "extensions", "Add-ons", "Manage add-ons"]);

  /* ---------- Page Layout ---------- */
  E("PSZ", "Page Size", "Page Layout", ["t", "File ▸ Print ▸ Print settings ▸ Paper size"]);
  E("PVG", "View Gridlines", "Page Layout", ["m", "view", "Show gridlines|Gridlines"]);
  E("PO", "Orientation", "Page Layout", ["t", "File ▸ Print ▸ Print settings ▸ Orientation"]);
  E("PW", "Margins", "Page Layout", ["t", "File ▸ Print ▸ Print settings ▸ Margins"]);

  /* ---------- Formulas ---------- */
  E("MH", "Show Formulas", "Formulas", ["k", "ctrl+`"]);
  E("MF", "Insert Function", "Formulas", ["m", "insert", "Function"], "open");
  E("MN", "Name Manager", "Formulas", ["m", "data", "Named ranges"]);
  E("MMD", "Define Name", "Formulas", ["m", "data", "Named ranges"]);
  E("MI", "Financial Functions", "Formulas", ["m", "insert", "Function", "Financial"], "open");
  E("ML", "Logical Functions", "Formulas", ["m", "insert", "Function", "Logical"], "open");
  E("MT", "Text Functions", "Formulas", ["m", "insert", "Function", "Text"], "open");
  E("ME", "Date & Time Functions", "Formulas", ["m", "insert", "Function", "Date"], "open");
  E("MO", "Lookup & Reference Functions", "Formulas", ["m", "insert", "Function", "Lookup"], "open");
  E("MG", "Math & Trig Functions", "Formulas", ["m", "insert", "Function", "Math"], "open");
  E("MP", "Trace Precedents", "Formula audit", ["x", "tracePrec"]);
  E("MD", "Trace Dependents", "Formula audit", ["x", "traceDep"]);
  E("MAA", "Remove Arrows / Close Audit", "Formula audit", ["x", "traceClear"]);

  /* ---------- Data ---------- */
  E("ASA", "Sort Ascending", "Data", ["m", "data", "Sort sheet", "A to Z|Sort sheet A to Z"]);
  E("ASD", "Sort Descending", "Data", ["m", "data", "Sort sheet", "Z to A|Sort sheet Z to A"]);
  E("ASS", "Sort…", "Data", ["m", "data", "Sort sheet", "Advanced range sort options"]);
  E("AT", "Filter", "Data", ["m", "data", "Create a filter"]);
  E("AC", "Clear Filter", "Data", ["m", "data", "Remove filter|Turn off filter"]);
  E("AE", "Text to Columns", "Data", ["m", "data", "Split text to columns"]);
  E("AM", "Remove Duplicates", "Data", ["m", "data", "Data cleanup", "Remove duplicates"]);
  E("AWG", "Goal Seek…", "Forecast", ["x", "goalSeek"]);
  E("AVV", "Data Validation…", "Data", ["m", "data", "Data validation"]);
  E("AGG", "Group", "Data", ["x", "sheetsCtx", "Group rows|Group columns|Group", "row"]);
  E("AUU", "Ungroup", "Data", ["x", "sheetsCtx", "Ungroup rows|Ungroup columns|Ungroup", "row"]);

  /* ---------- Review ---------- */
  E("RS", "Spelling", "Review", ["m", "tools", "Spelling|Spell check"]);
  E("RC", "New Comment", "Review", ["k", "ctrl+alt+m"]);
  E("RTN", "New Note", "Review", ["x", "sheetsCtx", "Note|Insert note|New note"]);
  E("RPS", "Protect Sheet", "Review", ["m", "data", "Protect sheets and ranges"]);
  E("RV", "Comments", "Review", ["c", "Comments|Open comment history"]);

  /* ---------- View ---------- */
  E("WFF", "Freeze Panes", "View", ["x", "sheetsFreezeBoth"]);
  E("WFR", "Freeze Top Row", "View", ["m", "view", "Freeze", "1 row"]);
  E("WFC", "Freeze First Column", "View", ["m", "view", "Freeze", "1 column"]);
  E("WQ", "Zoom", "View", ["m", "view", "Zoom"], "open");
  E("WJ", "Zoom to 100%", "View", ["m", "view", "Zoom", "100%"]);
  E("WVG", "Gridlines", "View", ["m", "view", "Show gridlines|Gridlines"]);
  E("WVF", "Formula Bar", "View", ["m", "view", "Show formula bar|Formula bar"]);
  E("WN", "New Window", "View", ["t", "Use Ctrl+N for a new browser window and reopen the sheet"]);
  E("WP", "Print Preview", "View", ["x", "printPage"]);

  /* ---------- classic menus ---------- */
  E("ESV", "Paste Special: Values", "Classic", ["k", "ctrl+shift+v"]);
  E("ESF", "Paste Special: Formulas", "Classic", ["m", "edit", "Paste special", "Formulas only"]);
  E("EST", "Paste Special: Transposed", "Classic", ["m", "edit", "Paste special", "Transposed"]);
  E("ESX", "Paste Special: Except Borders", "Classic", ["m", "edit", "Paste special", "All except borders"]);
  E("ESA", "Paste Special: All", "Classic", ["k", "ctrl+v"]);
  E("IR", "Insert Row", "Classic", ["x", "sheetsInsertDelete", "row", "insert"]);
  E("IC", "Insert Column", "Classic", ["x", "sheetsInsertDelete", "col", "insert"]);
  E("IS", "Insert Sheet", "Classic", ["k", "shift+f11"]);
  E("OI", "AutoFit Column", "Classic", ["x", "sheetsResize", "col", "fit"]);
  E("OA", "AutoFit Row", "Classic", ["x", "sheetsResize", "row", "fit"]);
  E("OW", "Column Width", "Classic", ["x", "sheetsResize", "col", "specify"]);
  E("OH", "Row Height", "Classic", ["x", "sheetsResize", "row", "specify"]);

  window.OAK_DATA.sheets = D;

  /* ================= custom handlers ================= */

  const M = () => window.OAKMenus;
  const W = () => window.OAKDispatch;

  // Fire a comma-separated combo sequence.
  window.OAK_CUSTOM.sheetsSeq = async function (ctx, args) {
    await W().pressCombos(String(args[0]).split(/\s*,\s*/).filter(Boolean));
    return true;
  };

  // Open a context menu at the active cell (Shift+F10) and click an item.
  async function ctxMenuClick(labels) {
    const cands = String(labels).split("|");
    const before = M().visibleMenus().length;
    W().sendKey("shift+f10", document);
    const deadline = Date.now() + 900;
    let menus = M().visibleMenus();
    while (!menus.length && Date.now() < deadline) {
      await W().wait(60);
      menus = M().visibleMenus();
    }
    if (!menus.length && !before) {
      W().toast("Couldn't open the context menu — right-click works too");
      return true; // guidance shown — not a silent failure
    }
    // find item
    for (let i = 0; i < 12; i++) {
      let found = null;
      for (const m of menus) {
        for (const item of m.querySelectorAll(".goog-menuitem")) {
          if (item.closest(".goog-menu") !== m) continue;
          if (item.classList.contains("goog-menuitem-disabled")) continue;
          const aria = (item.querySelector("[aria-label]")?.getAttribute("aria-label") ||
            item.innerText || "").trim().toLowerCase();
          if (cands.some((c) => aria === c.toLowerCase() || aria.startsWith(c.toLowerCase() + " "))) {
            found = item;
            break;
          }
        }
        if (found) break;
      }
      if (found) {
        M().realClick(found);
        return true;
      }
      await W().wait(80);
    }
    M().pressEscape();
    W().toast("Not in the context menu here — try right-clicking");
    return true; // guidance shown
  }

  window.OAK_CUSTOM.sheetsCtx = async function (ctx, args) {
    // args: ["item|candidates", "row"|"col"?] — optionally select the full
    // rows/columns first so the context menu exposes the item (P2.6).
    const pre = args[1];
    if (pre === "row" || pre === "col") {
      W().pressCombo(pre === "row" ? "shift+space" : "ctrl+space");
      await W().wait(180);
    }
    return ctxMenuClick(args[0]);
  };

  // Excel-parity insert/delete: select the row/column first, then Google's
  // Ctrl+Alt+= / − (which act on the selection). Used by HIR/HIC/HDR/HDC and
  // the Ctrl+Plus/Minus picker (P1.14).
  window.OAK_CUSTOM.sheetsInsertDelete = async function (ctx, args) {
    const axis = args[0] === "col" ? "col" : "row";
    const mode = args[1] === "delete" ? "delete" : "insert";
    W().pressCombo(axis === "row" ? "shift+space" : "ctrl+space");
    await W().wait(180);
    W().pressCombo(mode === "insert" ? "ctrl+alt+equal" : "ctrl+alt+minus");
    return true;
  };

  // Fill color palette → Reset / none. If the palette is already open
  // (Alt H H), clicking the toolbar button again would TOGGLE it closed —
  // so look for Reset in the open palette first, and only open a fresh one
  // otherwise (P1.11).
  window.OAK_CUSTOM.sheetsFillReset = async function () {
    const cands = ["Reset", "None", "No fill", "Default"];
    const findReset = () => {
      for (const scope of document.querySelectorAll(
        ".goog-toolbar-menu-button-popup, .goog-menu, [role='menu'], [role='dialog']"
      )) {
        const r = scope.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        for (const el of scope.querySelectorAll("[role='menuitem'], button, div")) {
          const t = (el.getAttribute("aria-label") || el.textContent || "").trim();
          if (cands.includes(t)) return el;
        }
      }
      return null;
    };
    let el = findReset(); // palette may already be open from Alt H H
    if (!el) {
      if (!W().clickToolbar("Fill color|Background color")) {
        W().toast("Fill color button not found");
        return true; // guidance shown
      }
      await W().wait(450);
      el = findReset();
    }
    if (el) {
      M().realClick(el);
      return true;
    }
    M().pressEscape();
    W().toast("Pick “Reset” in the fill palette");
    return true; // guidance shown
  };

  // Border picker → All borders.
  window.OAK_CUSTOM.sheetsAllBorders = async function () {
    if (!W().clickToolbar("Borders|Border|Select borders")) {
      W().toast("Borders button not found");
      return true; // guidance shown
    }
    await W().wait(400);
    const cands = ["All borders", "All Borders", "all borders"];
    for (const scope of document.querySelectorAll(
      ".goog-toolbar-menu-button-popup, .goog-menu, [role='menu']"
    )) {
      for (const el of scope.querySelectorAll("[role='menuitem'], button, div")) {
        const t = (el.getAttribute("aria-label") || el.textContent || "").trim();
        if (cands.includes(t)) {
          M().realClick(el);
          return true;
        }
      }
    }
    // fallback: outer borders natively
    W().pressCombo("alt+shift+7");
    W().toast("Applied outer borders (Alt+Shift+7)");
    return true;
  };

  // Text wrapping via toolbar.
  window.OAK_CUSTOM.sheetsWrap = async function (ctx, args) {
    const want = (args[0] || "Wrap").toLowerCase();
    if (!W().clickToolbar("Text wrapping|Wrap text|Wrapping")) {
      W().toast("Text wrapping button not found");
      return true; // guidance shown
    }
    await W().wait(400);
    for (const scope of document.querySelectorAll(
      ".goog-toolbar-menu-button-popup, .goog-menu, [role='menu']"
    )) {
      for (const el of scope.querySelectorAll("[role='menuitem'], button, div")) {
        const t = (el.getAttribute("aria-label") || el.textContent || "").trim().toLowerCase();
        if (t === want) {
          M().realClick(el);
          return true;
        }
      }
    }
    M().pressEscape();
    W().toast("Pick “" + want + "” in the wrapping menu");
    return true; // guidance shown
  };

  // Merge dropdown.
  window.OAK_CUSTOM.sheetsMerge = async function (ctx, args) {
    const kind = args[0];
    if (!W().clickToolbar("Merge cells|Merge selected cells|Merge all")) {
      W().toast("Merge cells button not found");
      return true; // guidance shown
    }
    await W().wait(400);
    const want =
      kind === "center" || kind === "all" ? ["merge all", "merge cells"]
      : kind === "horiz" ? ["merge horizontally", "merge across"]
      : kind === "vert" ? ["merge vertically"]
      : ["unmerge"];
    for (const scope of document.querySelectorAll(
      ".goog-toolbar-menu-button-popup, .goog-menu, [role='menu']"
    )) {
      for (const el of scope.querySelectorAll("[role='menuitem'], button, div")) {
        const t = (el.getAttribute("aria-label") || el.textContent || "").trim().toLowerCase();
        if (want.some((w) => t === w || t.startsWith(w + " "))) {
          M().realClick(el);
          if (kind === "center") W().pressCombo("ctrl+shift+e");
          return true;
        }
      }
    }
    M().pressEscape();
    W().toast("Pick merge mode in the dropdown");
    return true; // guidance shown
  };

  // Freeze both up-to-current row and column (Excel freeze panes).
  window.OAK_CUSTOM.sheetsFreezeBoth = async function () {
    const a = await M().runMenuPath("view", ["Freeze", "^Up to current row"]);
    await W().wait(120);
    const b = await M().runMenuPath("view", ["Freeze", "^Up to current column"]);
    if (!a && !b) {
      W().toast("View ▸ Freeze not available");
      return true; // guidance shown
    }
    return true;
  };

  // Column width / row height via context menu dialog.
  window.OAK_CUSTOM.sheetsResize = async function (ctx, args) {
    const axis = args[0]; // col | row
    const mode = args[1]; // fit | specify
    const selectCombo = axis === "col" ? "ctrl+space" : "shift+space";
    W().pressCombo(selectCombo);
    await W().wait(120);
    const ok = await ctxMenuClick(
      axis === "col" ? "Resize column|Resize columns" : "Resize row|Resize rows"
    );
    if (!ok) return false;
    // wait for the resize dialog
    const deadline = Date.now() + 1500;
    let dlg = null;
    while (!dlg && Date.now() < deadline) {
      dlg =
        document.querySelector(".modal-dialog [role='dialog'], .modal-dialog") || null;
      await W().wait(80);
    }
    if (!dlg) return true; // maybe inline — user can proceed
    if (mode === "fit") {
      for (const el of dlg.querySelectorAll("input[type='radio'], [role='radio'], label, div")) {
        const t = (el.getAttribute("aria-label") || el.textContent || "").trim().toLowerCase();
        if (t.includes("fit to data") || t.includes("fit")) {
          M().realClick(el);
          break;
        }
      }
    }
    await W().wait(150);
    for (const b of dlg.querySelectorAll("button, [role='button']")) {
      const t = (b.getAttribute("aria-label") || b.textContent || "").trim().toLowerCase();
      if (t === "ok" || t === "update" || t === "confirm" || t === "resize") {
        M().realClick(b);
        return true;
      }
    }
    M().pressEscape();
    return true;
  };

  // Insert ▸ Chart, then actually pick the chart type in the editor when a
  // type is requested ("Column", "Line", "Pie", "Scatter") — falling back
  // honestly when the editor's dropdown can't be driven (P1.12).
  window.OAK_CUSTOM.sheetsChartEditor = async function (ctx, args) {
    const type = args && args[0];
    const ok = await M().runMenuPath("insert", ["Chart"]);
    if (!ok) {
      W().toast("Insert ▸ Chart not available");
      return false;
    }
    if (!type) {
      W().toast("Chart editor opened — pick the chart type");
      return true;
    }
    await W().wait(900); // the chart editor side panel loads asynchronously
    // find the "Chart type" dropdown inside the editor panel
    let drop = null;
    for (const el of document.querySelectorAll("div[role='button'], [role='combobox'], [aria-haspopup]")) {
      const t = el.getAttribute("aria-label") || "";
      const own = el.textContent || "";
      if (/chart type/i.test(t) && el.getBoundingClientRect().width > 0) { drop = el; break; }
      if (!drop && /chart type/i.test(own) && el.getBoundingClientRect().width > 0 && own.length < 40) drop = el;
    }
    if (!drop) {
      W().toast("Chart editor opened — pick " + type + " manually in the Chart type dropdown");
      return false;
    }
    M().realClick(drop);
    await W().wait(500);
    for (const m of M().visibleMenus()) {
      for (const item of m.querySelectorAll(".goog-menuitem, [role='menuitem'], [role='option'], div")) {
        const t = (item.querySelector("[aria-label]")?.getAttribute("aria-label") ||
          item.getAttribute("aria-label") || item.innerText || "").trim();
        if (t.toLowerCase().startsWith(String(type).toLowerCase())) {
          M().realClick(item);
          W().toast(type + " chart applied");
          return true;
        }
      }
    }
    M().pressEscape();
    W().toast("Chart editor opened — pick " + type + " manually in the Chart type dropdown");
    return false;
  };
})();

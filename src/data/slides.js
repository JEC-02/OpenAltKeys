/*
 * OpenAltKeys — data/slides.js
 * PowerPoint Alt key sequences → Google Slides actions.
 *
 * Part of OpenAltKeys (MIT License). Original independent implementation.
 * Sequences are PowerPoint's public ribbon key-tips; Google-side commands
 * use Slides' own documented shortcuts and menus.
 */
window.OAK_DATA = window.OAK_DATA || {};
window.OAK_CUSTOM = window.OAK_CUSTOM || {};
(function () {
  "use strict";
  const D = [];
  const E = (seq, label, group, action, mode) => D.push({ seq, label, group, action, mode });

  /* ---------- ribbon tabs (PowerPoint 365 key letters, P2.7) ---------- */
  E("F", "File", "Tabs");
  E("H", "Home", "Tabs");
  E("N", "Insert", "Tabs");
  E("G", "Design", "Tabs");
  E("K", "Transitions", "Tabs");
  E("A", "Animations", "Tabs");
  E("D", "Draw", "Tabs");
  E("S", "Slide Show", "Tabs");
  E("J", "Shape Format", "Tabs");
  E("O", "Format", "Tabs");
  E("R", "Review", "Tabs");
  E("W", "View", "Tabs");

  /* ---------- File ---------- */
  E("FP", "Print", "File", ["x", "printPage"]);  // real window.print(), not a synthetic Ctrl+P
  E("FA", "Make a Copy", "File", ["m", "file", "Make a copy"]);
  E("FR", "Rename", "File", ["m", "file", "Rename"]);
  E("FI", "Version History", "File", ["m", "file", "Version history", "See version history"]);
  E("FS", "Download", "File", ["m", "file", "Download"], "open");
  E("FT", "Page Setup", "File", ["m", "file", "Page setup"]);

  /* ---------- Home ▸ Clipboard ---------- */
  E("HX", "Cut", "Clipboard", ["k", "ctrl+x"]);
  E("HC", "Copy", "Clipboard", ["k", "ctrl+c"]);
  E("HVP", "Paste", "Clipboard", ["k", "ctrl+v"]);
  E("HVS", "Paste Without Formatting", "Clipboard", ["k", "ctrl+shift+v"]);
  E("HFP", "Format Painter", "Clipboard", ["c", "Paint format|Format painter"]);

  /* ---------- Home ▸ Text ---------- */
  E("H1", "Bold", "Text", ["k", "ctrl+b"]);
  E("H2", "Italic", "Text", ["k", "ctrl+i"]);
  E("H3", "Underline", "Text", ["k", "ctrl+u"]);
  E("H4", "Strikethrough", "Text", ["k", "alt+shift+5"]);
  E("HSP", "Superscript", "Text", ["k", "ctrl+."]);
  E("HSB", "Subscript", "Text", ["k", "ctrl+,"]);
  E("HFF", "Select Font", "Text", ["c", "Font|Font family"], "open");
  E("HFS", "Font Size", "Text", ["c", "Font size|Font size (points)"], "open");
  E("HFG", "Font Size +", "Text", ["k", "ctrl+shift+."]);
  E("HFK", "Font Size −", "Text", ["k", "ctrl+shift+,"]);
  E("HFC", "Font Color", "Text", ["c", "Text color|Font color"], "open");
  E("HH", "Highlight Color", "Text", ["c", "Highlight color|Text background color"], "open");
  E("HU", "Bullets", "Text", ["k", "ctrl+shift+8"]);
  E("HN", "Numbering", "Text", ["k", "ctrl+shift+7"]);
  E("H5", "Decrease Indent", "Text", ["k", "ctrl+["]);
  E("H6", "Increase Indent", "Text", ["k", "ctrl+]"]);
  E("HEA", "Clear Formatting", "Text", ["k", "ctrl+\\"]);

  /* ---------- Home ▸ Alignment ---------- */
  E("HAL", "Align Left", "Align", ["k", "ctrl+shift+l"]);
  E("HAC", "Align Center", "Align", ["k", "ctrl+shift+e"]);
  E("HAR", "Align Right", "Align", ["k", "ctrl+shift+r"]);
  E("HAJ", "Justify", "Align", ["k", "ctrl+shift+j"]);

  /* ---------- Home ▸ Shapes & Slides ---------- */
  E("HI", "New Slide", "Slide", ["k", "ctrl+m"]);
  E("HD", "Duplicate Slide", "Slide", ["k", "ctrl+d"]);
  E("HL", "Slide Layout", "Slide", ["c", "Layout|Slide layout"], "open");
  E("HSF", "Shape Fill", "Shapes", ["c", "Fill color"], "open");
  E("HSO", "Shape Outline", "Shapes", ["c", "Border color|Line color|Border weight"], "open");
  E("HSE", "Shape Effects (Format Options)", "Shapes", ["s", "Format options"]);
  E("HSH", "Insert Shape", "Shapes", ["c", "Shape|Insert shape"], "open");
  E("HSL", "Line Spacing", "Paragraph", ["m", "format", "Line & paragraph spacing|Line spacing"], "open");
  E("HGG", "Group", "Arrange", ["k", "ctrl+alt+g"]);
  E("HGU", "Ungroup", "Arrange", ["k", "ctrl+alt+shift+g"]);
  E("HFD", "Find", "Find", ["k", "ctrl+f"]);
  E("HFO", "Find & Replace", "Find", ["k", "ctrl+h"]);
  E("HR", "Replace", "Find", ["k", "ctrl+h"]);
  /* ---------- Insert ---------- */
  E("NSL", "New Slide", "Insert", ["k", "ctrl+m"]);
  E("NX", "Text Box", "Insert", ["c", "Text box|Insert text box"]);
  E("NSH", "Shape", "Insert", ["c", "Shape|Insert shape"], "open");
  E("NL", "Link", "Insert", ["k", "ctrl+k"]);
  E("NC2", "Comment", "Insert", ["k", "ctrl+alt+m"]);
  E("NR", "Line", "Insert", ["c", "Select line|Line"]);
  E("NP", "Image", "Insert", ["m", "insert", "Image"], "open");
  E("NT", "Table", "Insert", ["m", "insert", "Table"], "open");
  E("NCH", "Chart", "Insert", ["m", "insert", "Chart"], "open");
  E("NM", "Diagram", "Insert", ["m", "insert", "Diagram"]);
  E("NW", "Word Art", "Insert", ["m", "insert", "Word Art|WordArt"]);
  E("NV", "Video", "Insert", ["m", "insert", "Video"]);
  E("NU", "Audio", "Insert", ["m", "insert", "Audio"]);
  E("NSN", "Slide Numbers", "Insert", ["m", "insert", "Slide numbers"]);
  E("NA", "Animation", "Insert", ["m", "insert", "Animation"]);
  E("NSC", "Special Characters", "Insert", ["m", "insert", "Special characters"]);
  E("NE", "Equation", "Insert", ["m", "insert", "Equation"]);

  /* ---------- Design ---------- */
  E("GH", "Theme", "Design", ["c", "Theme|Change theme|Apply a theme", "theme"]);
  E("GB", "Background", "Design", ["m", "slide", "Change background"]);
  E("GS", "Slide Size / Page Setup", "Design", ["m", "file", "Page setup"]);

  /* ---------- Transitions ---------- */
  E("KT", "Transition", "Transitions", ["m", "slide", "Change transition|Transition"]);

  /* ---------- Animations (PowerPoint Alt A, P2.7) ---------- */
  // Google Slides has no animations ribbon — the Motion pane (Insert ▸
  // Animation) is the closest real feature; the rest are honest guides.
  E("AA", "Animation (Motion pane)", "Animations", ["m", "insert", "Animation"]);
  E("AO", "Effect Options", "Animations", ["t", "Pick the effect in the Motion pane (Alt A A opens it)"]);
  E("AP", "Animation Pane", "Animations", ["m", "insert", "Animation"]);
  E("AT", "Transition", "Animations", ["m", "slide", "Change transition|Transition"]);
  E("AX", "Remove Animation", "Animations", ["t", "Remove the effect in the Motion pane (Alt A A opens it)"]);

  /* ---------- Draw (PowerPoint Alt D, P2.7) ---------- */
  // Google Slides has no Draw tab — closest real features via Insert ▸ Line.
  E("DP", "Pen / Line", "Draw", ["m", "insert", "Line"], "open");
  E("DSC", "Scribble (free draw)", "Draw", ["s", "scribble"]);
  E("DPC", "Convert to Shape", "Draw", ["t", "Google Slides converts scribbles to shapes automatically — no manual command"]);
  E("DIN", "Ink Equation", "Draw", ["m", "insert", "Equation"]);

  /* ---------- Slide Show (PowerPoint Alt S, P2.7) ---------- */
  E("SB", "Present From Beginning", "Slide Show", ["x", "slidesPresent"]);
  E("SC", "Present From Current", "Slide Show", ["x", "slidesPresent"]);
  E("SP", "Presenter View", "Slide Show", ["t", "Click ▸ Present ▸ Presenter view (top-right of Google Slides)"]);
  E("SR", "Rehearse Timings", "Slide Show", ["t", "Google Slides has no rehearse-timings — use Presenter view with speaker notes"]);
  E("SH", "Hide / Skip Slide", "Slide Show", ["m", "slide", "Skip slide"]);

  /* ---------- Shape Format (Alt + J) — PowerPoint's real home for ----------
   * ---------- arrange tools (align / distribute / group / rotate) ------- */
  E("JDAEK", "Send to Back", "Shape Format", ["k", "ctrl+shift+down"]);
  E("JDAFF", "Bring to Front", "Shape Format", ["k", "ctrl+shift+up"]);
  E("JDAFW", "Bring Forward", "Shape Format", ["k", "ctrl+up"]);
  E("JDAEB", "Send Backward", "Shape Format", ["k", "ctrl+down"]);
  E("JDAAL", "Align Left", "Shape Format", ["s", "Align left"]);
  E("JDAAR", "Align Right", "Shape Format", ["s", "Align right"]);
  E("JDAAC", "Align Center", "Shape Format", ["s", "Align center"]);
  E("JDAAT", "Align Top", "Shape Format", ["s", "Align top"]);
  E("JDAAB", "Align Bottom", "Shape Format", ["s", "Align bottom"]);
  E("JDAAM", "Align Middle", "Shape Format", ["s", "Align middle"]);
  E("JDAH", "Distribute Horizontally", "Shape Format", ["s", "Distribute horizontally"]);
  E("JDAV", "Distribute Vertically", "Shape Format", ["s", "Distribute vertically"]);
  E("JDR", "Rotate", "Shape Format", ["m", "arrange", "Rotate"], "open");
  E("JDSF", "Shape Fill", "Shape Format", ["c", "Fill color"], "open");
  E("JDSOW", "Outline Weight", "Shape Format", ["c", "Border weight|Line weight"], "open");
  E("JDSOS", "Outline Dash", "Shape Format", ["c", "Border dash|Border style"], "open");
  E("JDSE", "Shape Effects (Format Options)", "Shape Format", ["s", "Format options"]);
  E("JDPI", "Replace Image", "Image", ["s", "Replace image"]);
  E("JDPC", "Crop Image", "Image", ["c", "Crop|Crop image"]);
  E("JDPR", "Reset Image", "Image", ["s", "Reset image|Reset"]);

  /* ---------- Review ---------- */
  E("RS", "Spelling", "Review", ["m", "tools", "Spelling|Spell check"]);
  E("RC", "Comment", "Review", ["k", "ctrl+alt+m"]);

  /* ---------- View ---------- */
  E("WQ", "Zoom", "View", ["c", "Zoom|Zoom level"], "open");
  E("WG", "Snap to Guides", "View", ["m", "view", "Snap to guides|Snap to grid"]);
  E("WS", "Guides", "View", ["m", "view", "Show guides|Guides"]);
  E("WF", "Full Screen", "View", ["m", "view", "Full screen"]);
  E("WT", "Theme Builder", "View", ["m", "view", "Theme builder"]);
  E("WP", "Present", "View", ["x", "slidesPresent"]);
  E("WD", "Grid View (Slide Sorter)", "View", ["m", "view", "Grid view"]);
  E("WN", "Show Speaker Notes", "View", ["m", "view", "Show speaker notes"]);

  /* ---------- Format (Alt + O) ---------- */
  E("OT", "Format Options", "Format", ["s", "Format options"]);
  E("OE", "Clear Formatting", "Format", ["k", "ctrl+\\"]);
  E("ON", "Bullets & Numbering", "Format", ["m", "format", "Bullets & numbering"], "open");
  E("OI", "Align & Indent", "Format", ["m", "format", "Align & indent"], "open");
  E("OL", "Line & Paragraph Spacing", "Format", ["m", "format", "Line & paragraph spacing"], "open");

  window.OAK_DATA.slides = D;

  /* ================= custom handlers ================= */

  const M = () => window.OAKMenus;
  const W = () => window.OAKDispatch;

  // Present the deck (toolbar Present button).
  window.OAK_CUSTOM.slidesPresent = async function () {
    const cands = ["Present", "Start presentation", "Present from beginning", "Present from start"];
    for (const c of cands) {
      if (W().clickToolbar(c)) return true;
    }
    W().toast("Use the ▸ Present button (top right)");
    return true; // guidance shown — not a silent failure
  };
})();

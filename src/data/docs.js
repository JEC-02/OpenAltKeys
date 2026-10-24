/*
 * OpenAltKeys — data/docs.js
 * Word Alt key sequences → Google Docs actions.
 *
 * Part of OpenAltKeys (MIT License). Original independent implementation.
 * Sequences are Word's public ribbon key-tips; Google-side commands use
 * Docs' own documented shortcuts and menus.
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
  E("S", "References", "Tabs");
  E("R", "Review", "Tabs");
  E("W", "View", "Tabs");
  E("M", "Mailings", "Tabs");

  /* ---------- File ---------- */
  E("FP", "Print", "File", ["x", "printPage"]);  // real window.print(), not a synthetic Ctrl+P
  E("FI", "Version History", "File", ["m", "file", "Version history", "See version history"]);
  E("FA", "Make a Copy", "File", ["m", "file", "Make a copy"]);
  E("FR", "Rename", "File", ["m", "file", "Rename"]);
  E("FM", "Move", "File", ["m", "file", "Move"]);
  E("FH", "Share", "File", ["m", "file", "Share", "Share with others"]);
  E("FT", "Page Setup", "File", ["m", "file", "Page setup"]);
  E("FND", "Blank Document", "File", ["m", "file", "New", "Google Docs|Document"]);
  E("FNT", "From a Template", "File", ["m", "file", "New", "From a template|Template gallery"]);
  E("FS", "Download", "File", ["m", "file", "Download"], "open");
  E("FEX", "Word (.docx)", "File", ["m", "file", "Download", "Microsoft Word (.docx)"]);
  E("FEP", "PDF (.pdf)", "File", ["m", "file", "Download", "PDF Document (.pdf)"]);
  E("FET", "Plain Text (.txt)", "File", ["m", "file", "Download", "Plain Text (.txt)"]);
  E("FEO", "OpenDocument (.odt)", "File", ["m", "file", "Download", "OpenDocument Text (.odt)"]);
  E("FER", "Rich Text (.rtf)", "File", ["m", "file", "Download", "Rich Text Format (.rtf)|Rich Text (.rtf)"]);
  E("FEH", "Web Page (.html)", "File", ["m", "file", "Download", "Web Page (.html, zipped)|Web Page (.html)"]);
  E("FEE", "EPUB (.epub)", "File", ["m", "file", "Download", "EPUB Publication (.epub)|EPUB (.epub)"]);
  E("FEM", "Markdown (.md)", "File", ["m", "file", "Download", "Markdown (.md)"]);

  /* ---------- Home ▸ Clipboard ---------- */
  E("HX", "Cut", "Clipboard", ["k", "ctrl+x"]);
  E("HC", "Copy", "Clipboard", ["k", "ctrl+c"]);
  E("HVK", "Paste", "Clipboard", ["k", "ctrl+v"]);
  E("HVT", "Paste Text Only", "Clipboard", ["k", "ctrl+shift+v"]);
  E("HFP", "Format Painter", "Clipboard", ["c", "Paint format|Format painter"]);

  /* ---------- Home ▸ Font ---------- */
  E("HFF", "Select Font", "Font", ["c", "Font|Font family|Normal font"], "open");
  E("HFS", "Font Size", "Font", ["c", "Font size|Font size (points)"], "open");
  E("HFG", "Grow Font", "Font", ["k", "ctrl+shift+."]);
  E("HFK", "Shrink Font", "Font", ["k", "ctrl+shift+,"]);
  E("HFC", "Font Color", "Font", ["c", "Text color|Font color"], "open");
  E("HH", "Highlight Color", "Font", ["c", "Highlight color|Text background color"], "open");
  E("HI", "Text Highlight", "Font", ["c", "Highlight color|Text background color"], "open");

  /* ---------- Home ▸ Text ---------- */
  E("H1", "Bold", "Text", ["k", "ctrl+b"]);
  E("H2", "Italic", "Text", ["k", "ctrl+i"]);
  E("H3", "Underline", "Text", ["k", "ctrl+u"]);
  E("H4", "Strikethrough", "Text", ["k", "alt+shift+5"]);
  E("H5", "Subscript", "Text", ["k", "ctrl+,"]);
  E("H6", "Superscript", "Text", ["k", "ctrl+."]);

  /* ---------- Home ▸ Paragraph ---------- */
  E("HU", "Bullet Points", "Paragraph", ["k", "ctrl+shift+8"]);
  E("HN", "Numbered List", "Paragraph", ["k", "ctrl+shift+7"]);
  E("H9", "Checklist", "Paragraph", ["k", "ctrl+shift+9"]);
  E("HAL", "Align Left", "Paragraph", ["k", "ctrl+shift+l"]);
  E("HAC", "Align Center", "Paragraph", ["k", "ctrl+shift+e"]);
  E("HAR", "Align Right", "Paragraph", ["k", "ctrl+shift+r"]);
  E("HAJ", "Justify", "Paragraph", ["k", "ctrl+shift+j"]);
  E("HAI", "Increase Indent", "Paragraph", ["k", "ctrl+]"]);
  E("HAO", "Decrease Indent", "Paragraph", ["k", "ctrl+["]);
  E("HKD", "Line Spacing: Double", "Paragraph", ["m", "format", "Line & paragraph spacing|Line & paragraph spacing", "Double"]);
  E("HKS", "Line Spacing: Single", "Paragraph", ["m", "format", "Line & paragraph spacing|Line & paragraph spacing", "Single"]);
  E("HK", "Line Spacing", "Paragraph", ["m", "format", "Line & paragraph spacing|Line & paragraph spacing"], "open");
  E("HL1", "Heading 1", "Paragraph", ["k", "ctrl+alt+1"]);
  E("HL2", "Heading 2", "Paragraph", ["k", "ctrl+alt+2"]);
  E("HL3", "Heading 3", "Paragraph", ["k", "ctrl+alt+3"]);
  E("HL0", "Normal Text", "Paragraph", ["k", "ctrl+alt+0"]);
  E("HEA", "Clear Formatting", "Paragraph", ["k", "ctrl+\\"]);

  /* ---------- Insert ---------- */
  E("NP", "Page Break", "Insert", ["k", "ctrl+enter"]);
  E("NB", "Page Break (Word style)", "Insert", ["k", "ctrl+enter"]);
  E("NL", "Link", "Insert", ["k", "ctrl+k"]);
  E("NC2", "Comment", "Insert", ["k", "ctrl+alt+m"]);
  E("NF", "Footnote", "Insert", ["m", "insert", "Footnote"]);
  E("NG", "Image", "Insert", ["m", "insert", "Image"], "open");
  E("NT", "Table", "Insert", ["m", "insert", "Table"], "open");
  E("ND", "Drawing", "Insert", ["m", "insert", "Drawing", "+ New|New"]);
  E("NV", "Chart", "Insert", ["m", "insert", "Chart"], "open");
  E("NW", "Watermark", "Insert", ["m", "insert", "Watermark"]);
  E("NH", "Header & Footer", "Insert", ["m", "insert", "Headers & footers|Header & footers", "Header|Headers & footers"]);
  E("NS", "Special Characters", "Insert", ["m", "insert", "Special characters"]);
  E("NU", "Symbol", "Insert", ["m", "insert", "Special characters"]);
  E("NE", "Equation", "Insert", ["m", "insert", "Equation"]);
  E("NDB", "Date", "Insert", ["m", "insert", "Date"]);

  /* ---------- References ---------- */
  E("ST", "Table of Contents", "References", ["m", "insert", "Table of contents|Building blocks"], "open");

  /* ---------- Mailings (P2.7) ---------- */
  // Word's Alt M tab. Google Docs has no built-in mail merge — these are
  // honest guides (marked as guides in the cheat sheet), not fake commands.
  E("ML", "Labels…", "Mailings", ["t", "Google Docs has no label merge — use a Labels add-on (Extensions ▸ Add-ons) or a Google Docs template"]);
  E("ME", "Envelopes…", "Mailings", ["t", "Google Docs has no envelope merge — use an add-on or a template"]);
  E("MM", "Start Mail Merge…", "Mailings", ["t", "No mail merge in Google Docs — use a Google Sheets list + a merge add-on (Extensions ▸ Add-ons)"]);

  /* ---------- Page Layout ---------- */
  E("PM", "Margins", "Page Layout", ["m", "file", "Page setup"]);
  E("PO", "Orientation", "Page Layout", ["m", "file", "Page setup"]);
  E("PC", "Columns", "Page Layout", ["m", "format", "Columns"], "open");

  /* ---------- Review ---------- */
  E("RS", "Spelling & Grammar", "Review", ["m", "tools", "Spelling and grammar|Spelling"]);
  E("RC", "New Comment", "Review", ["k", "ctrl+alt+m"]);
  E("RV", "Comments", "Review", ["c", "Comments|Open comment history"]);
  E("RW", "Word Count", "Review", ["k", "ctrl+shift+c"]);

  /* ---------- View ---------- */
  E("WR", "Show Ruler", "View", ["m", "view", "Show ruler|Ruler"]);
  E("WO", "Show Outline", "View", ["m", "view", "Show outline|Outline"]);
  E("WF", "Full Screen", "View", ["m", "view", "Full screen"]);
  E("WZR", "Compact Controls", "View", ["k", "ctrl+shift+f"]);
  E("WQ", "Zoom", "View", ["t", "Zoom with Ctrl + / Ctrl − / Ctrl 0"]);

  window.OAK_DATA.docs = D;
})();

#!/usr/bin/env python3
"""Build the Firefox variant + package the release ZIPs.

This is the canonical packager — it ships inside both ZIPs, so
`npm run package` works straight out of the unzipped package.

Store-compliance (audit P0 fixes, kept green ever since):
  - manifest.json sits at the ZIP ROOT in both packages (CWS + AMO)
  - both ZIPs ship the full tree (src, icons, docs, tests, scripts,
    package.json, README, PRIVACY, LICENSE) so every documented test
    command works
  - Firefox manifest declares data_collection_permissions (AMO, since
    Nov 2025)
  - versions must agree everywhere: manifest.json == package.json ==
    README zip reference == ZIP file names — asserted, not hoped

Override destinations with env vars: OAK_DIST (ZIP output dir),
OAK_FF (Firefox working tree). Defaults sit next to the package.

Cross-platform determinism (v1.1.4 audit nits 1+2): every file is read
and written with explicit encoding="utf8" (Windows defaults to cp1252
and crashes on non-ASCII data files), the Firefox manifest is written
with newline="\n" (text mode otherwise emits CRLF on Windows), and test
output is decoded UTF-8-first — so a rebuild on any OS produces
byte-identical ZIPs.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # the package root (manifest.json lives here)
DIST = os.environ.get("OAK_DIST") or os.path.join(os.path.dirname(ROOT), "download")
FF = os.environ.get("OAK_FF") or os.path.join(os.path.dirname(ROOT), "openaltkeys-firefox")

os.makedirs(DIST, exist_ok=True)

# ---------- version consistency gate (P0.5) ----------
m = json.load(open(os.path.join(ROOT, "manifest.json"), encoding="utf8"))
VERSION = m["version"]
pkg = json.load(open(os.path.join(ROOT, "package.json"), encoding="utf8"))
readme = open(os.path.join(ROOT, "README.md"), encoding="utf8").read()
problems = []
if pkg["version"] != VERSION:
    problems.append(f"package.json version {pkg['version']} != manifest {VERSION}")
if f"openaltkeys-v{VERSION}.zip" not in readme:
    problems.append(f"README does not reference openaltkeys-v{VERSION}.zip")
if len(m["description"]) > 132:
    problems.append(f"Chrome description is {len(m['description'])} chars (>132)")
if "short_name" not in m:
    problems.append("manifest lacks short_name")
if problems:
    sys.exit("VERSION/STORE GATES FAILED:\n  " + "\n  ".join(problems))
print(f"version gates OK: {VERSION}, description {len(m['description'])} chars")

# ---------- Firefox variant ----------
if os.path.exists(FF):
    shutil.rmtree(FF)
shutil.copytree(
    ROOT, FF,
    # tests/docs are re-added from ROOT below; dot-dirs (test profiles) and
    # node_modules/ (from `npm install`) must never leak into the variant.
    ignore=shutil.ignore_patterns(
        "tests", "docs", "tests-output", ".git", ".gitignore", "*.zip", ".*",
        "node_modules"),
)

manifest_path = os.path.join(FF, "manifest.json")
mff = json.load(open(manifest_path, encoding="utf8"))

# Firefox MV3: event page instead of service worker
mff.pop("background", None)
mff.pop("minimum_chrome_version", None)  # Chrome-only key
mff["background"] = {"scripts": ["src/background.js"]}
# Firefox requires an extension id for signing; AMO also requires the
# data-collection declaration (none — we collect nothing).
mff["browser_specific_settings"] = {
    "gecko": {
        "id": "openaltkeys@openaltkeys.org",
        "strict_min_version": "109.0",
        "data_collection_permissions": {"required": ["none"]},
    }
}
# newline="\n": text mode would emit CRLF on Windows (audit nit 2) and
# make the FF ZIP 94 bytes bigger than the Linux build — LF keeps the
# variant byte-identical on every OS. encoding: manifest name has an
# em dash; cp1252 would write invalid UTF-8 back out on Windows.
json.dump(mff, open(manifest_path, "w", encoding="utf8", newline="\n"),
          indent=2, ensure_ascii=False)

# sanity: json valid + js files still parse
subprocess.run(["node", "--check", os.path.join(FF, "src/background.js")], check=True)

# ---------- re-run the unit tests before packaging ----------
for suite in ("engine.test.mjs", "extras.test.mjs"):
    r = subprocess.run(
        ["node", os.path.join(ROOT, "tests", suite)],
        capture_output=True, text=True,
        encoding="utf8", errors="replace",  # test output has ✓/✗ glyphs
    )
    print(r.stdout.strip().splitlines()[-1])
    if r.returncode != 0:
        sys.exit(f"{suite} failed")

# ---------- package ----------
INCLUDE = ["manifest.json", "src", "icons", "docs", "tests", "scripts",
           "package.json", "README.md", "PRIVACY.md", "LICENSE"]

def make_zip(src_dir, dest_zip):
    """ZIP with the extension at the ROOT — no nested folder (P0.1)."""
    dest = os.path.join(DIST, dest_zip)
    stage = tempfile.mkdtemp(prefix="oak-zipstage-")
    try:
        for item in INCLUDE:
            s = os.path.join(src_dir, item)
            d = os.path.join(stage, item)
            if not os.path.exists(s):
                continue
            if os.path.isdir(s):
                shutil.copytree(s, d, ignore=shutil.ignore_patterns(".git", ".*"))
            else:
                shutil.copy2(s, d)
        # Firefox tree is built without docs/tests by the copy above — copy
        # them from the Chromium tree so both packages carry the full
        # documented tree (P2.15: screenshots in Firefox too; P0.7: shipped
        # test suite).
        for item in ("docs", "tests"):
            if not os.path.exists(os.path.join(stage, item)):
                shutil.copytree(os.path.join(ROOT, item), os.path.join(stage, item),
                                ignore=shutil.ignore_patterns(".git", ".*"))
        # Pure-stdlib zipping (v1.1.3): no InfoZIP `zip` CLI dependency, so
        # `npm run package` also works on machines without one (Windows).
        with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for base, dirs, files in os.walk(stage):
                dirs.sort()
                for f in sorted(files):
                    full = os.path.join(base, f)
                    z.write(full, os.path.relpath(full, stage))
    finally:
        shutil.rmtree(stage, ignore_errors=True)
    # verify: manifest at zip root
    with zipfile.ZipFile(dest) as z:
        names = z.namelist()
        roots = set(n.split("/")[0] for n in names)
        assert "manifest.json" in roots, f"{dest_zip}: manifest.json not at ZIP root!"
        assert "tests" in roots and "docs" in roots, f"{dest_zip}: tests/ or docs/ missing"
        assert not any(n.startswith("openaltkeys/") for n in names), "nested root regressed"
    print("wrote", dest, os.path.getsize(dest), "bytes",
          f"({len(names)} entries, manifest at root OK)")

make_zip(ROOT, f"openaltkeys-v{VERSION}.zip")
make_zip(FF, f"openaltkeys-firefox-v{VERSION}.zip")

# count entries for the summary
for app in ("sheets", "docs", "slides"):
    src = open(os.path.join(ROOT, "src/data", app + ".js"),
               encoding="utf8").read()
    print(app, "entries:", src.count('E("'))
print("packaging done")

#!/usr/bin/env python3
"""Build a single-file GitHub Pages index.html from the maintainable sources."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE_HTML = ROOT / "source" / "index.modular.html"
OUTPUT_HTML = ROOT / "index.html"

html = SOURCE_HTML.read_text(encoding="utf-8")
css = (ROOT / "styles.css").read_text(encoding="utf-8")
html = re.sub(
    r'\s*<link\s+rel="stylesheet"\s+href="styles\.css"\s*/?>',
    f"\n  <style>\n{css}\n  </style>",
    html,
    count=1,
)

script_paths = [
    "vendor/jszip.min.js",
    "config.js",
    "js/vendor-loader.js",
    "js/catalog.js",
    "js/generator.js",
    "js/export.js",
    "js/profile.js",
    "js/map3d.js",
    "js/app.js",
]

for relative_path in script_paths:
    pattern = rf'\s*<script\s+defer\s+src="{re.escape(relative_path)}"></script>'
    source = (ROOT / relative_path).read_text(encoding="utf-8")
    # Prevent accidental termination of the surrounding inline script element.
    source = source.replace("</script", "<\\/script")
    replacement = f"\n  <script data-bundled-source=\"{relative_path}\">\n{source}\n  </script>"
    html, count = re.subn(pattern, lambda _: replacement, html, count=1)
    if count != 1:
        raise SystemExit(f"Could not inline {relative_path}")

banner = "<!-- Grand Tour Stage Lab v1.2 standalone: CSS, generator, viewers and ZIP exporter are bundled in this file. -->\n"
OUTPUT_HTML.write_text(banner + html, encoding="utf-8")
print(f"Built {OUTPUT_HTML} ({OUTPUT_HTML.stat().st_size:,} bytes)")

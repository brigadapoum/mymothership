"""План палуб «Пеликана»: src/ship/pelican-plan.svg → assets/vp/ship/plan.webp (3200×1800).

Шрифты — из assets/fonts модуля, рисует Chrome через Playwright:
    python3 tools/render_plan.py
"""
import io
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SVG = ROOT / "src" / "ship" / "pelican-plan.svg"
OUT = ROOT / "assets" / "vp" / "ship" / "plan.webp"
FONTS = ROOT / "assets" / "fonts"

FACES = [
    ("Fira Sans Extra Condensed", 600, "fira-sans-extra-condensed-{}-600-normal.woff2"),
    ("Fira Sans Extra Condensed", 800, "fira-sans-extra-condensed-{}-800-normal.woff2"),
    ("IBM Plex Mono", 400, "ibm-plex-mono-{}-400-normal.woff2"),
    ("IBM Plex Mono", 600, "ibm-plex-mono-{}-600-normal.woff2"),
]


def font_css():
    rules = []
    for family, weight, pattern in FACES:
        for subset, rng in (("cyrillic", "U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116"), ("latin", "U+0000-00FF,U+2000-206F,U+2190-21FF")):
            url = (FONTS / pattern.format(subset)).as_uri()
            rules.append(f'@font-face{{font-family:"{family}";font-weight:{weight};src:url("{url}") format("woff2");unicode-range:{rng}}}')
    return "\n".join(rules)


def main():
    svg = SVG.read_text(encoding="utf-8")
    html = f"<!doctype html><html><head><meta charset='utf-8'><style>{font_css()}\nhtml,body{{margin:0;background:#16191a}}svg{{display:block}}</style></head><body>{svg}</body></html>"
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/google-chrome")
        page = browser.new_page(viewport={"width": 1600, "height": 900}, device_scale_factor=2)
        page.set_content(html, wait_until="load")
        page.evaluate("document.fonts.ready")
        page.wait_for_timeout(300)
        png = page.screenshot(clip={"x": 0, "y": 0, "width": 1600, "height": 900})
        browser.close()
    img = Image.open(io.BytesIO(png)).convert("RGB")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, "WEBP", quality=90, method=6)
    print(f"{OUT.relative_to(ROOT)}: {img.size[0]}×{img.size[1]}, {OUT.stat().st_size // 1024} КБ")


if __name__ == "__main__":
    main()

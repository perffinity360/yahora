"""
Rasterise the master chat wallpaper into the three mobile PNGs.

    pip install playwright && python -m playwright install chromium
    python export_pngs.py

Reads  chat-pattern.svg        (the master, next to this file)
Writes chat-pattern.png        420 x 420   (@1x)
       chat-pattern@2x.png     840 x 840
       chat-pattern@3x.png     1260 x 1260

Why a real browser and not a generic converter: the website draws the SVG with Chrome's
engine, so rendering the PNGs with the same engine is what keeps the two platforms
identical. The background stays transparent: each platform supplies its own ground colour.
"""
import pathlib
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
SVG = HERE / "chat-pattern.svg"
TILE = 420  # units. Must match the web's background-size and the mobile tiling.

page_html = HERE / "_render.html"
page_html.write_text(
    '<!doctype html><html><body style="margin:0;background:transparent">'
    f'<img id="t" src="{SVG.as_uri()}" width="{TILE}" height="{TILE}" style="display:block">'
    "</body></html>"
)
with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, scale in [("chat-pattern.png", 1), ("chat-pattern@2x.png", 2), ("chat-pattern@3x.png", 3)]:
        page = browser.new_page(viewport={"width": TILE, "height": TILE}, device_scale_factor=scale)
        page.goto(page_html.as_uri())
        page.wait_for_function("document.getElementById('t').complete && document.getElementById('t').naturalWidth > 0")
        page.screenshot(path=str(HERE / name), omit_background=True,
                        clip={"x": 0, "y": 0, "width": TILE, "height": TILE})
        page.close()
        print(f"wrote {name}  ({TILE * scale} x {TILE * scale})")
    browser.close()
page_html.unlink()

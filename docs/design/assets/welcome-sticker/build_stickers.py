"""
Build the welcome stickers: every source -> out/<id>.webp (+ out/<id>-still.webp).

    python3 build_stickers.py            # all of them
    python3 build_stickers.py bee mishti # just these

Sources, two kinds, one output format:
    drawn/<id>.html   drawn in-house: a `draw(ctx, t)` page (open it to watch)
    lottie/<id>.json  from LottieFiles, rendered by render_lottie.html (credits and
                      licence: lottie/SOURCES.md)

Needs Google Chrome only — no pip packages. Chrome renders each frame and encodes it
as a still WebP; this script stitches the stills into one looping animated WebP
(RIFF: VP8X + ANIM + one ANMF per frame) and writes frame one alone as the still
(the web swaps to it under prefers-reduced-motion; mobile holds frame one itself).
It also writes out/stickers.json, which preview.html reads.

Why Chrome, as with the wallpaper's export_pngs.py: the website draws with Chrome's
engine, so rendering with it keeps the two platforms identical.

Shipping: copy the CHOSEN out/<id>.webp files to mobile/assets/stickers/ and
frontend/public/stickers/ (plus the -still files, web only) in one commit. Never edit
a .webp by hand — change the source and rebuild.
"""
import base64
import json
import pathlib
import re
import struct
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT = HERE / "out"

# Display names and credits for the preview and the manifest.
DRAWN_NAMES = {
    "bagsy": "Bagsy (drawn in-house)",
    "gift": "Bagsy's Gift (drawn in-house)",
    "mishti": "Mishti (drawn in-house)",
}


def chunks(riff: bytes):
    """Yield (fourcc, payload) for every chunk in a RIFF WEBP file."""
    assert riff[:4] == b"RIFF" and riff[8:12] == b"WEBP", "not a WebP"
    i = 12
    while i < len(riff):
        fourcc, size = riff[i:i + 4], struct.unpack("<I", riff[i + 4:i + 8])[0]
        yield fourcc, riff[i + 8:i + 8 + size]
        i += 8 + size + (size & 1)


def chunk(fourcc: bytes, payload: bytes) -> bytes:
    pad = b"\0" if len(payload) & 1 else b""
    return fourcc + struct.pack("<I", len(payload)) + payload + pad


def u24(n: int) -> bytes:
    return struct.pack("<I", n)[:3]


def render(url: str) -> dict:
    dom = subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--allow-file-access-from-files",
         "--force-device-scale-factor=1", "--virtual-time-budget=60000", "--dump-dom", url],
        capture_output=True, text=True, check=True,
    ).stdout
    raw = re.search(r'<pre id="frames"[^>]*>(.*?)</pre>', dom, re.S).group(1)
    if not raw.strip():
        raise RuntimeError(f"no frames rendered for {url}")
    return json.loads(raw.replace("&quot;", '"').replace("&amp;", "&"))


def mux(data: dict) -> tuple[bytes, bytes]:
    size, frames = data["size"], data["frames"]
    duration = data.get("frame_ms") or round(1000 / data["fps"])
    body = b""
    for url in frames:
        still = base64.b64decode(url.split(",", 1)[1])
        # Keep the image chunks (ALPH + VP8, or VP8L); drop the still's own VP8X.
        image = b"".join(chunk(f, p) for f, p in chunks(still) if f in (b"ALPH", b"VP8 ", b"VP8L"))
        assert image, "Chrome did not return WebP data"
        # x/2, y/2, w-1, h-1, duration, flags (bit 1 = do not blend: every frame is whole).
        header = u24(0) + u24(0) + u24(size - 1) + u24(size - 1) + u24(duration) + b"\x02"
        body += chunk(b"ANMF", header + image)
    vp8x = bytes([0x10 | 0x02, 0, 0, 0]) + u24(size - 1) + u24(size - 1)  # alpha + animation
    anim = struct.pack("<IH", 0x00000000, 0)  # transparent background, loop forever
    payload = b"WEBP" + chunk(b"VP8X", vp8x) + chunk(b"ANIM", anim) + body
    animated = b"RIFF" + struct.pack("<I", len(payload)) + payload
    first = base64.b64decode(frames[0].split(",", 1)[1])
    return animated, first


def sources() -> dict:
    found = {p.stem: ("drawn", p) for p in sorted((HERE / "drawn").glob("*.html"))}
    found.update({p.stem: ("lottie", p) for p in sorted((HERE / "lottie").glob("*.json"))})
    return found


def credits() -> dict:
    """id -> (title, creator, page) from lottie/SOURCES.md's table."""
    out = {}
    table = (HERE / "lottie" / "SOURCES.md").read_text()
    for m in re.finditer(r"^\| `(\w+)` \| (.*?) \| (.*?) \| \[.*?\]\((.*?)\) \|$", table, re.M):
        out[m.group(1)] = (m.group(2), m.group(3), m.group(4))
    return out


def main(only: list[str]):
    OUT.mkdir(exist_ok=True)
    all_sources = sources()
    unknown = set(only) - set(all_sources)
    if unknown:
        sys.exit(f"unknown sticker id(s): {', '.join(sorted(unknown))}")
    credit = credits()
    manifest_path = OUT / "stickers.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}

    for sid, (kind, path) in all_sources.items():
        if only and sid not in only:
            continue
        url = path.as_uri() + "?export" if kind == "drawn" else \
            (HERE / "render_lottie.html").as_uri() + f"?id={sid}"
        data = render(url)
        animated, first = mux(data)
        (OUT / f"{sid}.webp").write_bytes(animated)
        (OUT / f"{sid}-still.webp").write_bytes(first)
        seconds = len(data["frames"]) * (data.get("frame_ms") or round(1000 / data["fps"])) / 1000
        if kind == "drawn":
            name, by, page = DRAWN_NAMES.get(sid, sid), "Yahora", ""
        else:
            name, by, page = credit.get(sid, (sid, "?", ""))
        manifest[sid] = {
            "name": name, "by": by, "page": page, "source": kind,
            "frames": len(data["frames"]), "seconds": round(seconds, 1),
            "kb": round(len(animated) / 1024),
        }
        print(f"{sid:8} {kind:6} {len(data['frames']):3} frames  {seconds:4.1f}s  "
              f"{len(animated) / 1024:5.0f} KB")

    manifest_path.write_text(json.dumps(dict(sorted(manifest.items())), indent=1))


if __name__ == "__main__":
    main(sys.argv[1:])

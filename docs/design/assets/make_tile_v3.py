"""Yahora chat wallpaper, v3 -- built against the reference wallpapers.

What the references do that v2 did not:
  - doodles are LARGE. The hero drawing is roughly a third of the screen wide.
  - lines are clearly visible, not a faint texture.
  - strong hierarchy: two or three heroes, a handful of medium objects,
    then small objects, then tiny marks. Not 150 tiny marks.
  - sketchy detail: hatching, radiating lines, spiral scribbles, a shooting star.

Tile is 420x420 and is displayed at 420 units, 1:1. On a phone you see about one
tile across; the pattern repeats every 420 points vertically, which is the same
order of repetition as the WhatsApp and Telegram wallpapers.
"""

import math
import random

W = 420
random.seed(20260917)


# ─────────────────────────── hand-drawn primitives ───────────────────────────

def wcircle(cx, cy, r, bumps=8, amt=0.06):
    pts = []
    for i in range(bumps):
        a = (i / bumps) * math.tau
        rr = r * (1 + random.uniform(-amt, amt))
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
    for i in range(bumps):
        p0, p1 = pts[i], pts[(i + 1) % bumps]
        mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
        nx, ny = mx - cx, my - cy
        n = math.hypot(nx, ny) or 1
        k = r * 0.2
        d += f" Q{mx + nx / n * k:.1f},{my + ny / n * k:.1f} {p1[0]:.1f},{p1[1]:.1f}"
    return f'<path d="{d} Z"/>'


def wline(x1, y1, x2, y2, bow=0.05):
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    off = L * random.uniform(-bow, bow)
    return (f'<path d="M{x1:.1f},{y1:.1f} Q{mx - dy / L * off:.1f},'
            f'{my + dx / L * off:.1f} {x2:.1f},{y2:.1f}"/>')


def hatch(x, y, w, h, n=4, angle=-30):
    """Short parallel strokes inside a box -- the shading in the references."""
    out = []
    for i in range(n):
        t = (i + 0.5) / n
        cx = x + w * t
        cy = y + h * 0.5
        dx = math.cos(math.radians(angle)) * h * 0.42
        dy = math.sin(math.radians(angle)) * h * 0.42
        out.append(wline(cx - dx, cy - dy, cx + dx, cy + dy, bow=0.08))
    return "".join(out)


def rays(cx, cy, r_in, r_out, n=10, jitter=0.25):
    """Radiating strokes, like the sun in the space reference."""
    out = []
    for i in range(n):
        a = (i / n) * math.tau + random.uniform(-0.12, 0.12)
        ro = r_out * (1 + random.uniform(-jitter, jitter))
        out.append(wline(cx + r_in * math.cos(a), cy + r_in * math.sin(a),
                         cx + ro * math.cos(a), cy + ro * math.sin(a), bow=0.03))
    return "".join(out)


# ───────────────────────────── object glyphs (24-box) ────────────────────────

def g_bike():
    R, F, B, S, H = (6, 16), (18, 16), (12, 16), (10.2, 8.2), (15.8, 7.4)
    frame = (wline(*R, *B) + wline(*B, *S) + wline(*R, *S) +
             wline(*B, *H) + wline(*S, *H) + wline(*H, *F))
    seat = '<path d="M8.4 7.6 C9.6 6.9 11.2 7.2 11.9 7.9"/>'
    bar = '<path d="M14.2 6.2 C15.4 5.6 16.8 6.1 17.4 7.1"/>'
    spokes = ""
    for (cx, cy) in (R, F):
        for k in range(4):
            a = k * math.pi / 4 + 0.3
            spokes += wline(cx - 4.6 * math.cos(a), cy - 4.6 * math.sin(a),
                            cx + 4.6 * math.cos(a), cy + 4.6 * math.sin(a), bow=0.02)
    return (wcircle(*R, 5.1) + wcircle(*F, 5.1) + wcircle(*R, 1.0, bumps=5) +
            wcircle(*F, 1.0, bumps=5) + spokes + frame + seat + bar)


def g_book():
    return ('<path d="M2.4 6.2 C6.2 4.1 9.8 4.2 12 6.3 C14.2 4.1 17.9 4.0 21.7 6.1 '
            'L21.4 19.2 C17.7 17.2 14.1 17.3 12 19.4 C9.9 17.2 6.2 17.1 2.5 19.1 Z"/>'
            '<path d="M12 6.3 C12.2 10 11.9 15.5 12 19.4"/>' +
            wline(4.6, 9.4, 9.8, 8.6, bow=0.1) + wline(4.7, 12.1, 9.9, 11.3, bow=0.1) +
            wline(4.8, 14.8, 10, 14.0, bow=0.1) +
            wline(14.2, 8.6, 19.4, 9.4, bow=0.1) + wline(14.1, 11.3, 19.3, 12.1, bow=0.1) +
            wline(14, 14.0, 19.2, 14.8, bow=0.1))


def g_bag():
    return ('<path d="M5.1 10.4 C5 5.9 8.2 3.1 12 3.2 C15.8 3.3 19 6.1 18.9 10.5 '
            'L19.1 21.1 L4.9 20.9 Z"/>'
            '<path d="M9.1 10.2 L9 6.2 C9 4.1 15 4.1 15 6.1 L15.1 10.3"/>'
            '<path d="M7.6 14.4 L16.4 14.5 L16.2 20.9 L7.8 20.8 Z"/>' +
            wline(7.6, 17.2, 16.3, 17.3) +
            hatch(8.2, 15, 7.8, 2.0, n=5, angle=-40))


def g_headphones():
    return ('<path d="M3.9 16.1 C3.7 13.4 3.4 11.2 5.6 8.4 C9.4 3.6 15.2 3.8 18.6 8.6 '
            'C20.4 11.1 20.2 13.6 20.1 16.2"/>'
            '<rect x="1.9" y="14.8" width="4.6" height="7.4" rx="2.2"/>'
            '<rect x="17.4" y="14.9" width="4.6" height="7.4" rx="2.2"/>' +
            hatch(2.6, 16.2, 3.2, 4.6, n=3, angle=-50) +
            hatch(18.1, 16.3, 3.2, 4.6, n=3, angle=-50))


def g_laptop():
    return ('<path d="M6.2 5.2 L17.8 5.2 L18.4 15.1 L5.6 15.1 Z"/>'
            '<path d="M7.6 6.8 L16.4 6.8 L16.9 13.5 L7.1 13.5 Z"/>'
            '<path d="M3.4 15.4 L20.6 15.4 L22.1 18.9 L1.9 18.9 Z"/>' +
            wline(9.4, 17.2, 14.6, 17.2) +
            wline(8.6, 8.4, 12.2, 8.4, bow=0.1) + wline(8.8, 10.2, 14.6, 10.2, bow=0.1))


def g_cup():
    return ('<path d="M5.1 9.8 L19.2 10.1 L17.4 21.2 L6.6 20.9 Z"/>'
            '<path d="M19.1 12.2 C22.7 12 22.6 17.2 18.9 16.9"/>'
            '<path d="M8.6 7.1 C8.2 5.4 10.2 5 9.8 3.2"/>'
            '<path d="M12.1 7.3 C11.7 5.6 13.7 5.2 13.3 3.4"/>'
            '<path d="M15.5 7.1 C15.1 5.4 17.1 5 16.7 3.2"/>' +
            wline(5.6, 13.1, 18.6, 13.4, bow=0.06))


def g_bulb():
    return ('<path d="M12 2.9 C16.1 2.8 19 6.2 18.6 9.9 C18.3 12.6 16.2 13.4 16.1 '
            '15.1 L16 17.1 L8 16.9 L7.9 15 C7.8 13.3 5.7 12.5 5.4 9.8 '
            'C5 6.1 7.9 3 12 2.9 Z"/>' + wline(8.9, 19.4, 15.1, 19.6) +
            wline(10.1, 21.4, 13.9, 21.6) +
            '<path d="M10.2 13.6 L11.1 9.8 L12.9 10.2 L13.8 13.7"/>')


def g_calc():
    body = '<rect x="5" y="2.9" width="14" height="18.2" rx="2.2"/>' \
           '<rect x="7.9" y="5.9" width="8.2" height="3.6" rx="1"/>'
    for r in range(3):
        for c in range(3):
            body += wcircle(9 + c * 3, 12.4 + r * 3.2, 0.95, bumps=5, amt=0.12)
    return body


def g_ball():
    body = wcircle(12, 12, 8.4, bumps=9, amt=0.05)
    pent = []
    for i in range(5):
        a = -math.pi / 2 + i * math.tau / 5
        pent.append((12 + 3.4 * math.cos(a), 12 + 3.4 * math.sin(a)))
    body += '<path d="M' + " L".join(f"{x:.1f},{y:.1f}" for x, y in pent) + ' Z"/>'
    for x, y in pent:
        dx, dy = x - 12, y - 12
        n = math.hypot(dx, dy)
        body += wline(x, y, x + dx / n * 3.6, y + dy / n * 3.6, bow=0.06)
    return body


def g_plant():
    pot = ('<path d="M7.6 14.2 L16.4 14.3 L15.1 21.3 L8.9 21.2 Z"/>'
           + wline(7.2, 14.2, 16.8, 14.3) + hatch(9, 16.5, 6, 3.6, n=3, angle=-45))
    leaf_l = '<path d="M12 14.2 C11.6 10.4 9.2 7.4 5.4 6.1 C5.2 10.4 8.1 13.4 12 14.2 Z"/>'
    leaf_r = '<path d="M12 14.2 C12.4 9.8 15.2 6.8 19.1 5.6 C19.2 10.2 16.1 13.5 12 14.2 Z"/>'
    leaf_t = '<path d="M12 14.2 C10.9 10.6 11.4 6.4 12.4 3.1 C14.2 6.2 13.8 10.8 12 14.2 Z"/>'
    veins = wline(12, 14, 7.4, 8.4, bow=0.1) + wline(12, 14, 16.9, 8, bow=0.1)
    return pot + leaf_l + leaf_r + leaf_t + veins


def g_pencil():
    return ('<path d="M3.8 20.4 L6.1 14.9 L17.1 3.9 L20.2 7.1 L9.1 18.1 Z"/>'
            '<path d="M14.9 6.1 L18.1 9.2"/>' + wline(3.8, 20.4, 6.9, 18.9) +
            wline(7.6, 16.4, 16.1, 7.9, bow=0.02))


def g_note():
    return ('<path d="M9 18.1 C8.8 13.5 9.1 8.4 9 5 L19.1 3 C19.2 7 18.9 11.5 19 15"/>'
            '<path d="M9 8.2 L19.1 6.2"/>'
            + wcircle(6.4, 18.6, 2.9, bumps=6, amt=0.1)
            + wcircle(16.5, 15.6, 2.9, bumps=6, amt=0.1))


def g_heart():
    return ('<path d="M12 20.2 C3.9 14.4 3.1 9.9 5.6 7.1 C8.1 4.4 11.1 6 12 8.3 '
            'C12.9 6 15.9 4.4 18.4 7.1 C20.9 9.9 20.1 14.4 12 20.2 Z"/>' +
            hatch(6.2, 9, 5, 3.5, n=3, angle=-45))


def g_camera():
    return ('<rect x="2" y="7" width="20" height="13.1" rx="2.6"/>'
            '<path d="M8.4 7 L10 3.9 L14.1 4 L15.6 7.1"/>' +
            wcircle(12, 13.6, 4.0, bumps=8, amt=0.06) +
            wcircle(12, 13.6, 2.0, bumps=6, amt=0.1) +
            wcircle(18.6, 9.8, 0.8, bumps=5, amt=0.15))


def g_shirt():
    return ('<path d="M8.9 3.9 L4 6.9 L6.1 11.1 L8 10.1 L7.9 20.1 L16.1 20.2 '
            'L16 10.2 L18 11.2 L20.1 7 L15.1 4 C14 6.1 10 6.1 8.9 3.9 Z"/>' +
            wline(8, 10.1, 16, 10.2, bow=0.05))


def g_clock():
    return (wcircle(12, 12, 8.6, bumps=10, amt=0.05) +
            wline(12, 12, 12, 6.6) + wline(12, 12, 15.8, 14.1) +
            wline(12, 3.9, 12, 5.2) + wline(12, 18.8, 12, 20.1) +
            wline(3.9, 12, 5.2, 12) + wline(18.8, 12, 20.1, 12))


def g_lamp():
    return ('<path d="M5.9 11.1 L18.1 11.2 L14.6 4.1 L9.4 4 Z"/>' +
            wline(12, 11.2, 12, 19.1) +
            '<path d="M8.4 21.1 C8.4 18.9 15.6 18.9 15.6 21.2 Z"/>' +
            hatch(7, 5.5, 10, 4.5, n=4, angle=-60))


def g_phone():
    return ('<rect x="7" y="2.4" width="10" height="19.2" rx="2.4"/>' +
            wline(10.4, 4.6, 13.6, 4.6) +
            wcircle(12, 19.1, 0.9, bumps=5, amt=0.15) +
            '<rect x="8.4" y="6.2" width="7.2" height="11" rx="0.6"/>')


def g_bottle():
    return ('<path d="M9.4 6.4 L14.6 6.4 L15.4 9.4 C16.2 11 16.2 19 15.4 20.8 '
            'L8.6 20.8 C7.8 19 7.8 11 8.6 9.4 Z"/>'
            '<rect x="9.6" y="2.8" width="4.8" height="3.6" rx="0.8"/>' +
            wline(8.6, 12.4, 15.4, 12.4) + wline(8.6, 17.4, 15.4, 17.4))


def g_notebook():
    return ('<rect x="5" y="3" width="14" height="18" rx="1.6"/>' +
            wline(5, 3, 5, 21, bow=0) +
            wline(8.6, 8, 16.2, 8, bow=0.1) + wline(8.6, 11.4, 16.2, 11.4, bow=0.1) +
            wline(8.6, 14.8, 16.2, 14.8, bow=0.1) + wline(8.6, 18.2, 13.6, 18.2, bow=0.1) +
            "".join(wcircle(5, 5.5 + i * 3.6, 0.7, bumps=5) for i in range(4)))


# ─────────────────────────────── tiny marks ──────────────────────────────────

def f_sparkle(s=1.0):
    a, b = 4.6 * s, 1.2 * s
    return (f'<path d="M0,{-a:.1f} Q{b:.1f},{-b:.1f} {a:.1f},0 Q{b:.1f},{b:.1f} 0,{a:.1f} '
            f'Q{-b:.1f},{b:.1f} {-a:.1f},0 Q{-b:.1f},{-b:.1f} 0,{-a:.1f} Z"/>')


def f_star(s=1.0):
    r1, r2 = 4.6 * s, 1.9 * s
    pts = []
    for i in range(10):
        r = r1 if i % 2 == 0 else r2
        a = -math.pi / 2 + i * math.pi / 5
        pts.append(f"{r * math.cos(a):.1f},{r * math.sin(a):.1f}")
    return f'<path d="M{" L".join(pts)} Z"/>'


def f_dot(s=1.0):
    return wcircle(0, 0, 0.9 * s, bumps=5, amt=0.2)


def f_ring(s=1.0):
    return wcircle(0, 0, 2.6 * s, bumps=6, amt=0.14)


def f_cross(s=1.0):
    a = 2.6 * s
    return wline(-a, -a, a, a, bow=0.12) + wline(a, -a, -a, a, bow=0.12)


def f_spiral(s=1.0):
    """The scribbled galaxy spiral from the third reference."""
    pts = []
    for i in range(46):
        t = i / 45
        a = t * math.tau * 2.4
        r = 8.5 * s * t
        pts.append(f"{r * math.cos(a):.1f},{r * math.sin(a):.1f}")
    return f'<path d="M{" L".join(pts)}"/>'


def f_burst(s=1.0):
    return rays(0, 0, 1.4 * s, 5.2 * s, n=8, jitter=0.3)


def f_tinyheart(s=1.0):
    a = 3.2 * s
    return (f'<path d="M0,{a:.1f} C{-a * 1.35:.1f},{a * 0.1:.1f} {-a * 0.95:.1f},'
            f'{-a * 0.95:.1f} 0,{-a * 0.3:.1f} C{a * 0.95:.1f},{-a * 0.95:.1f} '
            f'{a * 1.35:.1f},{a * 0.1:.1f} 0,{a:.1f} Z"/>')


FILLERS = [f_sparkle, f_sparkle, f_star, f_star, f_dot, f_dot, f_ring,
           f_cross, f_tinyheart, f_burst]


def shooting_star(x, y, ang, length=54):
    """Star head plus three trailing strokes, like the comet in the space reference."""
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    head = (f'<g transform="translate({x:.1f},{y:.1f}) rotate({ang + 15:.0f})">'
            f'{f_star(1.5)}</g>')
    tail = ""
    for off in (-3.6, 0, 3.6):
        px, py = x - sa * off, y + ca * off
        L = length * (0.72 if off else 1.0)
        tail += wline(px - ca * 8, py - sa * 8, px - ca * L, py - sa * L, bow=0.06)
    return head + tail


def dotted_trail(pts, n=22, r=1.05):
    out = []
    (x0, y0), (cx, cy), (x1, y1) = pts
    for i in range(n):
        t = i / (n - 1)
        x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1
        y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1
        rr = r * (0.7 + 0.5 * math.sin(t * math.pi))
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rr:.2f}" '
                   f'fill="currentColor" stroke="none"/>')
    return "".join(out)


# ─────────────────────────────────── layout ──────────────────────────────────
# (glyph, cx, cy, rotation, scale). Scale 4 = about 96 units wide on screen.

HERO = [
    (g_bike,  118, 120,  -6, 4.4),
    (g_book,  318, 322,   7, 4.1),
    (g_bag,   350,  96,  -9, 3.6),
]

MEDIUM = [
    (g_headphones, 244, 210,   8, 2.5),
    (g_laptop,      74, 318,  -8, 2.6),
    (g_cup,        220,  46,  12, 2.2),
    (g_bulb,       420, 236,  -6, 2.3),   # wraps across the right edge
    (g_plant,      180, 420, -10, 2.4),   # wraps across the bottom edge
    (g_ball,       112, 222,   0, 2.0),
    (g_camera,     346, 214,  -8, 2.1),
]

SMALL = [
    (g_calc,      30,  30,   9, 1.5),     # wraps the corner
    (g_pencil,   260, 132,  24, 1.5),
    (g_note,     404, 340, -12, 1.5),
    (g_shirt,     30, 218,  -7, 1.5),
    (g_clock,    186, 300,   5, 1.4),
    (g_lamp,     420, 400,   8, 1.4),
    (g_phone,    262, 400, -14, 1.4),
    (g_bottle,   208, 130,  10, 1.4),
    (g_notebook,   8, 400,  -6, 1.4),
    (g_heart,    164, 210, -10, 1.2),
]

TRAILS = [
    [(150, 40), (250, 90), (300, 30)],
    [(380, 300), (330, 380), (240, 350)],
    [(20, 140), (60, 210), (30, 290)],
]

SHOOTING = [(330, 160, 200)]


def scatter_fillers(n=62, keep_out=None, margin=23):
    """Scatter tiny marks, staying clear of the objects."""
    placed = []
    tries = 0
    while len(placed) < n and tries < n * 80:
        tries += 1
        x, y = random.uniform(0, W), random.uniform(0, W)
        if any((x - px) ** 2 + (y - py) ** 2 < (pr + margin * 0.35) ** 2
               for px, py, pr in keep_out):
            continue
        if any((x - px) ** 2 + (y - py) ** 2 < margin ** 2 for px, py, *_ in placed):
            continue
        placed.append((x, y, random.choice(FILLERS),
                       random.uniform(0, 360), random.uniform(0.9, 1.6)))
    return placed


def build(color="#800080", opacity=0.40, stroke=2.0):
    layers = []

    def emit(inner, cx, cy, rot, sc, op, sw, extent):
        e = extent * sc
        xs = [0] + ([-W] if cx + e > W else []) + ([W] if cx - e < 0 else [])
        ys = [0] + ([-W] if cy + e > W else []) + ([W] if cy - e < 0 else [])
        for dx in xs:
            for dy in ys:
                layers.append(
                    f'<g transform="translate({cx + dx:.1f},{cy + dy:.1f}) '
                    f'rotate({rot:.1f}) scale({sc:.3f})" stroke-opacity="{op:.3f}" '
                    f'stroke-width="{sw:.2f}">{inner}</g>')

    keep_out = []
    for tier, sw_mul, op_mul in ((HERO, 1.0, 0.92), (MEDIUM, 0.92, 1.0), (SMALL, 0.85, 1.0)):
        for fn, cx, cy, rot, sc in tier:
            emit(f'<g transform="translate(-12,-12)">{fn()}</g>',
                 cx, cy, rot, sc, opacity * op_mul, stroke * sw_mul / sc, 13)
            keep_out.append((cx, cy, 13 * sc))

    for x, y, ang in SHOOTING:
        for dx in (-W, 0, W):
            for dy in (-W, 0, W):
                layers.append(f'<g stroke-opacity="{opacity:.3f}" stroke-width="{stroke * 0.85:.2f}">'
                              f'{shooting_star(x + dx, y + dy, ang)}</g>')
        keep_out.append((x - 26, y + 10, 34))

    for pts in TRAILS:
        for dx in (-W, 0, W):
            for dy in (-W, 0, W):
                if abs(dx) and all(0 < x + dx < W for x, _ in pts):
                    continue
                if abs(dy) and all(0 < y + dy < W for _, y in pts):
                    continue
                shifted = [(x + dx, y + dy) for x, y in pts]
                layers.append(f'<g color="{color}" opacity="{opacity * 0.85:.3f}">'
                              f'{dotted_trail(shifted)}</g>')

    for x, y, fn, rot, sc in scatter_fillers(keep_out=keep_out):
        emit(fn(), x, y, rot, sc, opacity * random.uniform(0.85, 1.1),
             stroke * 0.8 / sc, 6)

    inner = "\n    ".join(layers)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{W}" viewBox="0 0 {W} {W}">
  <title>Yahora chat wallpaper tile</title>
  <desc>Seamless 420x420 doodle tile. Display at 420 units (1:1) on every platform.</desc>
  <defs><clipPath id="t"><rect width="{W}" height="{W}"/></clipPath></defs>
  <g clip-path="url(#t)" fill="none" stroke="{color}" stroke-width="{stroke}"
     stroke-linecap="round" stroke-linejoin="round">
    {inner}
  </g>
</svg>
'''


if __name__ == "__main__":
    open("/home/claude/chat-pattern.svg", "w").write(build())
    print("written")

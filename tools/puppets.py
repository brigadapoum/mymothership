"""Токены и портреты-марионетки: assets/vp/tokens/<имя>.webp → assets/vp/tokens/puppet/<имя>.webp,
assets/vp/portraits/<имя>.webp → assets/vp/portraits/puppet/<имя>.webp (портрет — для крупного арта при наведении).

Вайб — неоновая бирюза на чёрном (референс автора 2026-11-27): негатив — линии светятся, кожа
в черноте; лицо поплыло волной и сорванными строками, сдвиг каналов, сверху свисают кабели-нити марионетки,
впиваются в голову (на стыках — красные точки), неоновое кольцо.
Тед — андроид, его не едят: марионетки нет.
    python3 tools/puppets.py
"""
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "vp" / "tokens"
OUT = SRC / "puppet"
SKIP = {"ted"}

SIZE = 400
C = SIZE / 2
INNER = 184          # внутри кольца
RING = (30, 240, 200)  # неоновое кольцо марионетки
NEON = (16, 240, 200)
JOINT = (255, 56, 92)


def radial(size=SIZE):
    y, x = np.mgrid[0:size, 0:size]
    return np.hypot(x - C + 0.5, y - C + 0.5)


def warp(gray, rng):
    """Волна по строкам и несколько «сорванных» полос."""
    h, w = gray.shape
    out = np.empty_like(gray)
    amp, lam, ph = rng.uniform(3, 6), rng.uniform(70, 120), rng.uniform(0, 2 * math.pi)
    shift = np.round(amp * np.sin(2 * math.pi * np.arange(h) / lam + ph)).astype(int)
    for _ in range(rng.randint(4, 7)):
        y0 = rng.randint(90, 330)
        hh = rng.randint(4, 14)
        shift[y0:y0 + hh] += rng.choice([-1, 1]) * rng.randint(8, 22)
    for y in range(h):
        out[y] = np.roll(gray[y], shift[y])
    return out


def colorize(g):
    """Негатив: тушь линий светится неоновой бирюзой, светлая кожа уходит в черноту — как на референсе."""
    t = 1.0 - np.clip((g.astype(float) - 18) * 1.12, 0, 255) / 255.0
    t = np.clip(t, 0, 1) ** 1.25
    lo = np.array([10, 13, 12], float)
    mid = np.array([16, 66, 60], float)
    hi = np.array([60, 244, 206], float)
    t = t[..., None]
    return np.where(t < 0.5, lo + (mid - lo) * (t / 0.5), mid + (hi - mid) * ((t - 0.5) / 0.5))


def bezier(p0, p1, p2, n=40):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in (i / n for i in range(n + 1))]


def threads(rng):
    """Кабели-нити сверху: тёмное тело, неоновая кромка, свечение; конец впивается в голову."""
    body = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d, dg = ImageDraw.Draw(body), ImageDraw.Draw(glow)
    n = rng.randint(5, 7)
    for i in range(n):
        ang = math.radians(-150 + 120 * (i + rng.uniform(0.15, 0.85)) / n)
        p0 = (C + (INNER + 8) * math.cos(ang), C + (INNER + 8) * math.sin(ang))
        loose = rng.random() < 0.2
        end = (C + rng.uniform(-85, 85), rng.uniform(95, 215) if not loose else rng.uniform(230, 300))
        mid = ((p0[0] + end[0]) / 2 + rng.uniform(-40, 40), (p0[1] + end[1]) / 2 + rng.uniform(10, 50))
        pts = bezier(p0, mid, end)
        w = rng.randint(5, 9)
        dg.line(pts, fill=NEON + (110,), width=w + 8, joint="curve")
        d.line(pts, fill=(6, 12, 12, 255), width=w, joint="curve")
        rim = [(x + w * 0.32, y - w * 0.1) for x, y in pts]
        d.line(rim, fill=NEON + (230,), width=2, joint="curve")
        if not loose:
            ex, ey = end
            r = w * 0.75
            d.ellipse([ex - r, ey - r, ex + r, ey + r], fill=(6, 12, 12, 255), outline=NEON + (255,), width=2)
            d.ellipse([ex - 2.5, ey - 2.5, ex + 2.5, ey + 2.5], fill=JOINT + (255,))
            dg.ellipse([ex - 7, ey - 7, ex + 7, ey + 7], fill=JOINT + (150,))
    glow = glow.filter(ImageFilter.GaussianBlur(4))
    return Image.alpha_composite(glow, body)


def puppet(path, seed):
    rng = random.Random(seed)
    src = Image.open(path).convert("RGBA")
    alpha = np.array(src.split()[3])
    gray = np.array(src.convert("L"))
    r = radial()
    inside = r < INNER

    g2 = gray.copy()
    g2[inside] = warp(gray, rng)[inside]
    base = colorize(g2)

    # сдвиг каналов: красный влево, зелёный и синий вправо
    shifted_r = np.roll(g2, -3, axis=1).astype(float)
    shifted_c = np.roll(g2, 3, axis=1).astype(float)
    chroma = np.stack([shifted_r * 0.9, shifted_c * 0.95, shifted_c * 0.85], axis=-1)
    rgb = base * 0.82 + chroma * 0.18

    # виньетка внутри круга и строки развёртки
    vig = np.clip(1.15 - (r / INNER) ** 2.4 * 0.75, 0.25, 1.0)
    rgb *= vig[..., None]
    rgb[::3] *= 0.86

    # кольцо: светлые пиксели снаружи INNER → красные
    ring = (r >= INNER - 2) & (gray > 140)
    rgb[ring] = RING
    out = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

    th = threads(rng)
    out = Image.alpha_composite(out, th)
    out.putalpha(Image.fromarray(alpha))
    return out


def cables_rect(rng, w, h):
    """Кабели сверху для прямоугольного портрета: свисают с верхнего края и впиваются в голову."""
    body = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d, dg = ImageDraw.Draw(body), ImageDraw.Draw(glow)
    n = rng.randint(5, 7)
    for i in range(n):
        p0 = (w * (i + rng.uniform(0.2, 0.8)) / n, -6)
        loose = rng.random() < 0.2
        end = (w * rng.uniform(0.28, 0.72), h * (rng.uniform(0.16, 0.42) if not loose else rng.uniform(0.5, 0.7)))
        mid = ((p0[0] + end[0]) / 2 + rng.uniform(-50, 50), (p0[1] + end[1]) / 2 + rng.uniform(10, 60))
        pts = bezier(p0, mid, end)
        cw = rng.randint(6, 10)
        dg.line(pts, fill=NEON + (110,), width=cw + 8, joint="curve")
        d.line(pts, fill=(6, 12, 12, 255), width=cw, joint="curve")
        d.line([(x + cw * 0.32, y - cw * 0.1) for x, y in pts], fill=NEON + (230,), width=2, joint="curve")
        if not loose:
            ex, ey = end
            r = cw * 0.75
            d.ellipse([ex - r, ey - r, ex + r, ey + r], fill=(6, 12, 12, 255), outline=NEON + (255,), width=2)
            d.ellipse([ex - 3, ey - 3, ex + 3, ey + 3], fill=JOINT + (255,))
            dg.ellipse([ex - 8, ey - 8, ex + 8, ey + 8], fill=JOINT + (150,))
    glow = glow.filter(ImageFilter.GaussianBlur(4))
    return Image.alpha_composite(glow, body)


def portrait(path, seed):
    rng = random.Random(seed)
    src = Image.open(path).convert("L")
    gray = np.array(src)
    h, w = gray.shape
    g2 = warp(gray, rng)
    base = colorize(g2)
    chroma = np.stack([np.roll(g2, -3, axis=1) * 0.9, np.roll(g2, 3, axis=1) * 0.95, np.roll(g2, 3, axis=1) * 0.85], axis=-1).astype(float)
    rgb = base * 0.82 + chroma * 0.18
    y, x = np.mgrid[0:h, 0:w]
    e = np.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2))
    rgb *= np.clip(1.12 - e ** 2.2 * 0.55, 0.3, 1.0)[..., None]
    rgb[::3] *= 0.86
    out = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    out = Image.alpha_composite(out, cables_rect(rng, w, h))
    return out.convert("RGB")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    done = []
    for i, path in enumerate(sorted(SRC.glob("*.webp"))):
        name = path.stem
        if name in SKIP:
            continue
        img = puppet(path, seed=1000 + i * 37)
        img.save(OUT / f"{name}.webp", "WEBP", quality=90, method=6)
        done.append(name)
    print("марионетки:", ", ".join(done))
    psrc = ROOT / "assets" / "vp" / "portraits"
    pout = psrc / "puppet"
    pout.mkdir(parents=True, exist_ok=True)
    for i, path in enumerate(sorted(psrc.glob("*.webp"))):
        if path.stem in SKIP:
            continue
        portrait(path, seed=5000 + i * 41).save(pout / f"{path.stem}.webp", "WEBP", quality=90, method=6)
    print("портреты-марионетки:", len(list(pout.glob("*.webp"))))


if __name__ == "__main__":
    main()

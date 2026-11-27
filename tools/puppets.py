"""Токены-марионетки: assets/vp/tokens/<имя>.webp → assets/vp/tokens/puppet/<имя>.webp.

Искажение лица (волна и сдвиги строк), сдвиг каналов, больной зеленоватый тон,
нити от шеи вверх (железо из крови — по ним бежит ток), красное кольцо.
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
RING = (200, 52, 40)  # красное кольцо марионетки


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
    """Серое → тени почти чёрные, середина болотно-серая, свет — бледный."""
    g = np.clip((g.astype(float) - 28) * 1.18, 0, 255) / 255.0
    lo = np.array([8, 13, 12], float)
    mid = np.array([96, 116, 104], float)
    hi = np.array([226, 234, 220], float)
    t = g[..., None]
    rgb = np.where(t < 0.5, lo + (mid - lo) * (t / 0.5), mid + (hi - mid) * ((t - 0.5) / 0.5))
    return rgb


def threads(rng):
    """Нити: от шеи и снизу вверх, с ветвлением; ядро и свечение."""
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d, dg = ImageDraw.Draw(layer), ImageDraw.Draw(glow)

    def grow(x, y, ang, n, width):
        for _ in range(n):
            ang += rng.uniform(-0.4, 0.4)
            step = rng.uniform(10, 18)
            nx, ny = x + step * math.cos(ang), y + step * math.sin(ang)
            if math.hypot(nx - C, ny - C) > INNER - 4:
                return
            k = 0.35 + 0.65 * min(1.0, max(0.0, ny / SIZE))  # к макушке нити тают
            dg.line([(x, y), (nx, ny)], fill=(255, 40, 28, int(110 * k)), width=width + 4)
            d.line([(x, y), (nx, ny)], fill=(196, 34, 26, int(225 * k)), width=width)
            d.line([(x, y), (nx, ny)], fill=(255, 150, 128, int(130 * k)), width=1)
            x, y = nx, ny
            if rng.random() < 0.18 and width > 1:
                grow(x, y, ang + rng.choice([-1, 1]) * rng.uniform(0.6, 1.1), rng.randint(3, 7), width - 1)

    for _ in range(rng.randint(3, 4)):
        x0 = C + rng.uniform(-55, 55)
        grow(x0, SIZE - 28, -math.pi / 2 + rng.uniform(-0.45, 0.45), rng.randint(9, 15), 3)
    glow = glow.filter(ImageFilter.GaussianBlur(3))
    return Image.alpha_composite(glow, layer)


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
    chroma = np.stack([shifted_r, shifted_c * 0.92, shifted_c], axis=-1)
    rgb = base * 0.72 + chroma * 0.28

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


if __name__ == "__main__":
    main()

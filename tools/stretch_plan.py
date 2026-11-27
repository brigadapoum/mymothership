"""Высокий план для сцены корабля: палубы растянуты по вертикали, шрифты и круги не искажаются.

Каждая палуба растягивается своим аффинным отображением (кривые корпуса остаются кривыми),
промежутки между ними — своим. У кругов двигается центр, радиус прежний; у текста — только y.
    python3 tools/stretch_plan.py   # src/ship/pelican-plan-neon.svg → src/ship/pelican-plan-neon-tall.svg
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "ship" / "pelican-plan-neon.svg"
OUT = ROOT / "src" / "ship" / "pelican-plan-neon-tall.svg"

DECK = 1.45
# опорные точки (старый y → новый y): верх корпуса верхней палубы, низ, верх нижней, низ, край
ANCHORS = [(0, 0), (150, 150), (186, 200), (474, 200 + 288 * DECK), (546, 200 + 288 * DECK + 72 * 1.4),
           (834, 200 + 288 * DECK + 72 * 1.4 + 288 * DECK), (900, 200 + 288 * DECK + 72 * 1.4 + 288 * DECK + 79)]
H_NEW = round(ANCHORS[-1][1])


def f(y):
    y = float(y)
    for (a0, b0), (a1, b1) in zip(ANCHORS, ANCHORS[1:]):
        if y <= a1:
            return b0 + (y - a0) * (b1 - b0) / (a1 - a0)
    (a0, b0), (a1, b1) = ANCHORS[-2], ANCHORS[-1]
    return b1 + (y - a1) * (b1 - b0) / (a1 - a0)


def num(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


YPOS = {"M": [1], "L": [1], "T": [1], "C": [1, 3, 5], "S": [1, 3], "Q": [1, 3], "V": [0], "H": []}
NARGS = {"M": 2, "L": 2, "T": 2, "C": 6, "S": 4, "Q": 4, "V": 1, "H": 1, "Z": 0}


def path_d(d, old=0.0, new=0.0):
    toks = re.findall(r"[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?", d)
    out, cmd, args = [], None, []
    for t in toks:
        if t.isalpha():
            if t.islower() and t not in "z":
                raise ValueError(f"относительная команда {t}")
            cmd = t.upper()
            out.append(t)
            args = []
            continue
        args.append(float(t))
        n = NARGS[cmd]
        if len(args) == n:
            for i in YPOS[cmd]:
                args[i] = f(args[i] + old) - new
            out.append(" ".join(num(a) for a in args))
            args = []
            if cmd == "M":
                cmd = "L"
    return " ".join(out)


def attr(tag, name):
    m = re.search(rf'\s{name}="([^"]*)"', tag)
    return m.group(1) if m else None


def setattr_(tag, name, value):
    return re.sub(rf'(\s{name}=")[^"]*(")', lambda m: m.group(1) + value + m.group(2), tag, count=1)


def main():
    svg = SRC.read_text(encoding="utf-8")
    head, body = svg.split("</defs>", 1)
    # смещение групп translate(x y) — у легенды: (старое смещение, новое смещение)
    stack = [(0.0, 0.0)]

    def Y(y):
        old, new = stack[-1]
        return num(f(float(y) + old) - new)

    def fix(m):
        tag = m.group(0)
        if tag.startswith("</g"):
            if len(stack) > 1:
                stack.pop()
            return tag
        old, new = stack[-1]
        if tag.startswith("<g"):
            tr = attr(tag, "transform")
            if tr and tr.startswith("translate("):
                x, y = re.findall(r"-?\d*\.?\d+", tr)[:2]
                o = old + float(y)
                n = f(o)
                tag = setattr_(tag, "transform", f"translate({x} {num(n - new)})")
                stack.append((o, n))
            elif not tag.endswith("/>"):
                stack.append((old, new))
            return tag
        name = re.match(r"<(\w+)", tag).group(1)
        if name == "rect":
            y, h = attr(tag, "y"), attr(tag, "height")
            y0 = float(y) if y is not None else 0.0
            if h is not None:
                hh = f(y0 + float(h) + old) - f(y0 + old)
                if y is not None:
                    tag = setattr_(tag, "y", Y(y0))
                tag = setattr_(tag, "height", num(hh))
        elif name in ("circle", "ellipse"):
            cy = attr(tag, "cy")
            if cy is not None:
                tag = setattr_(tag, "cy", Y(cy))
        elif name == "text":
            y = attr(tag, "y")
            if y is not None:
                tag = setattr_(tag, "y", Y(y))
        elif name == "path":
            tag = setattr_(tag, "d", path_d(attr(tag, "d"), old, new))
        return tag

    body = re.sub(r"</g>|<(?:g|rect|circle|ellipse|text|path)\b[^>]*>", fix, body)
    head = head.replace('viewBox="0 0 1600 900" width="1600" height="900"', f'viewBox="0 0 1600 {H_NEW}" width="1600" height="{H_NEW}"')
    OUT.write_text(head + "</defs>" + body, encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: 1600×{H_NEW}")


if __name__ == "__main__":
    main()

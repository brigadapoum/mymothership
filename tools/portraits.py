# Портреты экипажа «Восходящего потока» → assets/vp/portraits (лист) и assets/vp/tokens (круглые токены).
# Запуск: python3 tools/portraits.py <папка с исходными jpg>
import sys, pathlib
from PIL import Image, ImageDraw

SRC = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "vp"
# файл исходника → имя в модуле (фамилии Лолы, Ханны и Тео сменены, файлы — нет)
FILES = {"ferro": "ferro", "okafor": "okafor", "lahti": "lahti", "mendes": "kovalchik", "haddad": "haddad",
         "tanabe": "tanabe", "borg": "otieno", "oke": "oke", "kruger": "kruger", "mbeki": "holm",
         "ted": "ted", "vargo": "vargo"}

for src, slug in FILES.items():
    im = Image.open(SRC / f"{src}.jpg").convert("RGB")
    im.save(OUT / "portraits" / f"{slug}.webp", quality=88)
    w, h = im.size
    side = w
    face = im.crop((0, 0, side, side)).resize((400, 400), Image.LANCZOS)
    size, ring = 400, 14
    tok = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((ring, ring, size - ring, size - ring), fill=255)
    d = ImageDraw.Draw(tok)
    d.ellipse((0, 0, size - 1, size - 1), fill=(17, 17, 17, 255))
    d.ellipse((5, 5, size - 6, size - 6), fill=(230, 230, 230, 255))
    d.ellipse((9, 9, size - 10, size - 10), fill=(17, 17, 17, 255))
    tok.paste(face, (0, 0), mask)
    tok.save(OUT / "tokens" / f"{slug}.webp", quality=90)
    print(slug)

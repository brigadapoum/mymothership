// Сцена корабля «Пеликан» — чистая логика без Foundry (проверяется тестами).
// Макет: холст «Пеликан — сцены Foundry», артборд «Сцена корабля» (2026-11-27).

/** Слой 1920×1080; вырез под схему — сюда Foundry показывает план и фишки. */
export const HOLE = { x: 76, y: 134, w: 1248, h: 902 };

/** План на сцене — плитка 2880×2080 (assets/vp/ship/plan-scene.webp) посреди сцены 4320×3120. */
export const SCENE = { w: 4320, h: 3120, padding: 0.25, grid: 80 };
export const TILE = { dx: 720, dy: 520, w: 2880, h: 2080 };

/** Где кто при ударе: центр фишки в пикселях плитки плана. Сэм — скрыт, марионеткой. */
export const START = [
  { slug: "ferro", x: 460, y: 271 },
  { slug: "lahti", x: 340, y: 663 },
  { slug: "okafor", x: 460, y: 721 },
  { slug: "oke", x: 760, y: 387 },
  { slug: "holm", x: 1320, y: 387 },
  { slug: "kruger", x: 2300, y: 402 },
  { slug: "otieno", x: 820, y: 706 },
  { slug: "tanabe", x: 1350, y: 648 },
  { slug: "ted", x: 2080, y: 1409 },
  { slug: "kovalchik", x: 2480, y: 634 },
  { slug: "haddad", x: 1280, y: 61 },
  { slug: "vargo", x: 1600, y: 1699, hidden: true, puppet: true }
];

/** Два канала арта: { src, caption, fit }. fit — как кадрировать: cover / top / bottom / contain. */
export const FITS = ["cover", "top", "bottom", "contain"];
export const FIT_LABEL = { cover: "по центру", top: "верх", bottom: "низ", contain: "целиком" };

export function normSlots(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return [0, 1].map((i) => {
    const s = list[i] ?? {};
    return {
      src: typeof s.src === "string" && s.src ? s.src : "",
      caption: typeof s.caption === "string" ? s.caption : "",
      fit: FITS.includes(s.fit) ? s.fit : "cover"
    };
  });
}

export const nextFit = (fit) => FITS[(FITS.indexOf(fit) + 1) % FITS.length];

/**
 * Вид холста, при котором плитка плана ровно ложится в вырез слоя.
 * layout — где стоит слой на экране ({ scale, left, top }), tile — прямоугольник плитки на холсте,
 * screen — размер окна холста. Возвращает { x, y, scale } для canvas.pan().
 */
export function viewFor(layout, tile, screen) {
  const hw = HOLE.w * layout.scale;
  const hh = HOLE.h * layout.scale;
  const hx = layout.left + HOLE.x * layout.scale + hw / 2;
  const hy = layout.top + HOLE.y * layout.scale + hh / 2;
  const scale = Math.min(hw / tile.w, hh / tile.h);
  const qx = tile.x + tile.w / 2;
  const qy = tile.y + tile.h / 2;
  return { x: qx + (screen.w / 2 - hx) / scale, y: qy + (screen.h / 2 - hy) / scale, scale };
}

/** Тот же ли вид (чтобы не дёргать холст по пустякам). */
export const sameView = (a, b) => !!a && !!b
  && Math.abs(a.scale - b.scale) < 1e-3 && Math.abs(a.x - b.x) < 1.5 && Math.abs(a.y - b.y) < 1.5;

/** Где на экране вырез при данном положении слоя. */
export function holeOnScreen(layout) {
  const w = HOLE.w * layout.scale;
  const h = HOLE.h * layout.scale;
  const x = layout.left + HOLE.x * layout.scale;
  const y = layout.top + HOLE.y * layout.scale;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

/**
 * Карта привязана к рамке: мельче «всего плана» не уменьшить, за край плитки не утащить.
 * view — текущий вид холста, fit — вид «весь план». Возвращает исправленный вид или null, если всё в порядке.
 */
export function clampView(view, fit, layout, tile, screen) {
  const hole = holeOnScreen(layout);
  const scale = Math.max(view.scale, fit.scale);
  const offX = (hole.cx - screen.w / 2) / scale;
  const offY = (hole.cy - screen.h / 2) / scale;
  let cx = view.x + (hole.cx - screen.w / 2) / view.scale;
  let cy = view.y + (hole.cy - screen.h / 2) / view.scale;
  const rx = hole.w / 2 / scale;
  const ry = hole.h / 2 / scale;
  const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi));
  cx = clamp(cx, tile.x + rx, tile.x + tile.w - rx);
  cy = clamp(cy, tile.y + ry, tile.y + tile.h - ry);
  const out = { x: cx - offX, y: cy - offY, scale };
  return sameView(out, view) ? null : out;
}

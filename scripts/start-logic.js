// Чистая логика экрана начала — без Foundry, чтобы проверять тестами.

export const STAGE = { w: 1920, h: 1080 };

/** Вписать сцену 1920×1080 в свободную область между панелями Foundry, по центру. */
export function fitStage(area, stage = STAGE) {
  const w = Math.max(1, area.right - area.left);
  const h = Math.max(1, area.bottom - area.top);
  const scale = Math.min(w / stage.w, h / stage.h);
  return {
    scale,
    left: Math.round(area.left + (w - stage.w * scale) / 2),
    top: Math.round(area.top + (h - stage.h * scale) / 2)
  };
}

/** «52 года», «41 год», «66 лет». */
export function ageText(n) {
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = n % 10, h = n % 100;
  const word = d === 1 && h !== 11 ? "год" : d >= 2 && d <= 4 && (h < 12 || h > 14) ? "года" : "лет";
  return `${n} ${word}`;
}

/** Номер слайда вступления: −1 — вступление не идёт. */
export function clampSlide(i, count) {
  const n = Number(i);
  if (!Number.isInteger(n) || n < 0 || n >= count) return -1;
  return n;
}

/**
 * Кто занят: для каждого члена экипажа — имена игроков-владельцев.
 * actors: [{ slug, ownerIds }], users: [{ id, name, isGM, characterSlug }]
 */
export function takenMap(actors, users) {
  const out = {};
  for (const a of actors) {
    const names = users
      .filter((u) => !u.isGM && (u.characterSlug === a.slug || a.ownerIds.includes(u.id)))
      .map((u) => u.name);
    if (names.length) out[a.slug] = [...new Set(names)].join(", ");
  }
  return out;
}

export const sameMap = (a, b) => JSON.stringify(Object.entries(a ?? {}).sort()) === JSON.stringify(Object.entries(b ?? {}).sort());

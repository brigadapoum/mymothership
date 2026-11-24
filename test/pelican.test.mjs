// «Пеликан»: зоны на плане и дочерние сцены.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PLAN, PLACES, sceneName, toScene } from "../scripts/pelican-data.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

test("13 мест: 11 отсеков, главный коридор, наружный трап", () => {
  assert.equal(PLACES.length, 13);
  assert.deepEqual(PLACES.map((p) => p.key), ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9", "r10", "r11", "corridor", "trap"]);
  assert.equal(new Set(PLACES.map((p) => p.key)).size, 13);
  assert.equal(PLACES.find((p) => p.key === "r8").name, "Трюм");
  assert.equal(PLACES.find((p) => p.key === "r11").name, "Компрессорная");
  assert.equal(sceneName(PLACES[2]), "«Пеликан» · 3 · Кают-компания");
  assert.equal(sceneName(PLACES[11]), "«Пеликан» · Главный коридор");
});

test("кликабельная зона — внутри отсека и внутри плана", () => {
  for (const p of PLACES) {
    const [hx, hy, hw, hh] = p.hot;
    const [rx, ry, rw, rh] = p.room;
    assert.ok(hx >= 0 && hy >= 0 && hx + hw <= PLAN.w && hy + hh <= PLAN.h, `${p.key}: зона за планом`);
    assert.ok(hx >= rx && hy >= ry && hx + hw <= rx + rw && hy + hh <= ry + rh, `${p.key}: зона вылезает из отсека`);
    assert.ok(hw >= 40 && hh >= 20, `${p.key}: зона слишком мала`);
  }
});

test("зоны не перекрываются", () => {
  for (const a of PLACES) for (const b of PLACES) {
    if (a === b) continue;
    const [ax, ay, aw, ah] = a.hot; const [bx, by, bw, bh] = b.hot;
    const overlap = ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
    assert.ok(!overlap, `${a.key} и ${b.key} перекрываются`);
  }
});

test("план → координаты сцены с полями", () => {
  const r = toScene([800, 450, 100, 50], { x: 160, y: 90, width: 3200, height: 1800 });
  assert.deepEqual(r, { x: 1760, y: 990, width: 200, height: 100 });
});

test("картинка плана на месте и в исходнике нет пометок смотрителя", () => {
  const img = path.join(root, "assets", "vp", PLAN.image);
  assert.ok(fs.statSync(img).size > 50000, "нет plan.webp");
  const svg = fs.readFileSync(path.join(root, "src", "ship", "pelican-plan.svg"), "utf8");
  assert.ok(!/\{\{/.test(svg), "в SVG остались подстановки холста");
  for (const word of ["гроздь", "Тео", "в облака", "Сэм"]) assert.ok(!svg.includes(word), `на плане лишнее: ${word}`);
  for (const word of ["МПАД-7/12", "ТРЮМ", "КОМПРЕССОРНАЯ", "МАШИННОЕ", "ОТДЕЛЕНИЕ", "люк между палубами"]) assert.ok(svg.includes(word), `на плане нет: ${word}`);
});

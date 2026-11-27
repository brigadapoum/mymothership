// Сцена корабля «Пеликан»: вырез, вид холста, каналы, расстановка экипажа.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { HOLE, SCENE, TILE, START, normSlots, nextFit, FITS, viewFor, sameView } from "../scripts/ship-logic.js";
import { stageHtml } from "../scripts/pelican.js";
import { PUPPETS } from "../scripts/puppet.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const crew = JSON.parse(fs.readFileSync(path.join(root, "assets", "vp", "crew.json"), "utf8")).crew;

test("плитка плана той же пропорции, что вырез", () => {
  assert.ok(Math.abs(TILE.w / TILE.h - HOLE.w / HOLE.h) < 0.002);
  const css = fs.readFileSync(path.join(root, "styles", "ship.css"), "utf8");
  assert.ok(css.includes(`${HOLE.x}px ${HOLE.y}px, ${HOLE.x + HOLE.w}px ${HOLE.y}px, ${HOLE.x + HOLE.w}px ${HOLE.y + HOLE.h}px, ${HOLE.x}px ${HOLE.y + HOLE.h}px`), "вырез в CSS не совпадает с HOLE");
  assert.ok(TILE.dx + TILE.w <= SCENE.w && TILE.dy + TILE.h <= SCENE.h);
  assert.ok(fs.statSync(path.join(root, "assets", "vp", "ship", "plan-scene.webp")).size > 50000);
});

test("вид холста кладёт плитку ровно в вырез", () => {
  const layout = { scale: 0.8, left: 100, top: 40 };
  const tile = { x: 1800, y: 1300, w: TILE.w, h: TILE.h };
  const screen = { w: 1920, h: 1080 };
  const v = viewFor(layout, tile, screen);
  // угол плитки на экране = угол выреза
  const toScreen = (px, py) => ({ x: screen.w / 2 + (px - v.x) * v.scale, y: screen.h / 2 + (py - v.y) * v.scale });
  const tl = toScreen(tile.x, tile.y);
  const br = toScreen(tile.x + tile.w, tile.y + tile.h);
  assert.ok(Math.abs(tl.x - (layout.left + HOLE.x * layout.scale)) < 1);
  assert.ok(Math.abs(tl.y - (layout.top + HOLE.y * layout.scale)) < 1.5);
  assert.ok(Math.abs(br.x - (layout.left + (HOLE.x + HOLE.w) * layout.scale)) < 1);
  assert.ok(Math.abs(br.y - (layout.top + (HOLE.y + HOLE.h) * layout.scale)) < 1.5);
  assert.ok(sameView(v, { ...v, x: v.x + 1 }));
  assert.ok(!sameView(v, { ...v, scale: v.scale * 1.1 }));
});

test("каналы: два, пустые по умолчанию, кадр по кругу", () => {
  assert.deepEqual(normSlots(null), [{ src: "", caption: "", fit: "cover" }, { src: "", caption: "", fit: "cover" }]);
  assert.deepEqual(normSlots([{ src: "a.webp", caption: "x", fit: "top" }, { fit: "???" }])[1].fit, "cover");
  let f = "cover";
  for (let i = 0; i < FITS.length; i++) f = nextFit(f);
  assert.equal(f, "cover");
});

test("экипаж: все 12 на плитке, Сэм скрыт и марионеткой", () => {
  assert.deepEqual(START.map((s) => s.slug).sort(), crew.map((c) => c.slug).sort());
  for (const s of START) assert.ok(s.x > 40 && s.y > 40 && s.x < TILE.w - 40 && s.y < TILE.h - 40, `${s.slug} за планом`);
  const sam = START.find((s) => s.slug === "vargo");
  assert.ok(sam.hidden && sam.puppet && PUPPETS.includes("vargo"));
  assert.equal(START.filter((s) => s.hidden).length, 1);
});

test("слой: «нет сигнала» у пустого канала, кнопки только смотрителю", () => {
  const slots = normSlots([{ src: "worlds/x/art.webp", caption: "«Приемная-2»" }, {}]);
  const gm = stageHtml(slots, true);
  const pl = stageHtml(slots, false);
  assert.ok(pl.includes("НЕТ СИГНАЛА") && gm.includes("НЕТ СИГНАЛА"));
  assert.ok(gm.includes("+ Вывести арт") && !pl.includes("+ Вывести арт"));
  assert.ok(gm.includes('data-ship="clear"') && !pl.includes('data-ship="clear"'));
  assert.ok(pl.includes('data-ship="zoom"'), "крупно — всем");
  assert.ok(pl.includes("&laquo;") || pl.includes("«Приемная-2»"));
  assert.ok(gm.includes("МПАД-7/12"));
});

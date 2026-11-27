// «Пеликан»: план палуб и марионетки.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PLAN } from "../scripts/pelican-data.js";
import { PUPPETS, parseSrc, puppetSrc, normalSrc } from "../scripts/puppet.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

test("картинка плана на месте и в исходнике нет пометок смотрителя", () => {
  assert.ok(fs.statSync(path.join(root, "assets", "vp", PLAN.image)).size > 50000, "нет plan.webp");
  const svg = fs.readFileSync(path.join(root, "src", "ship", "pelican-plan.svg"), "utf8");
  assert.ok(!/\{\{/.test(svg), "в SVG остались подстановки холста");
  for (const word of ["гроздь", "Тео", "в облака", "Сэм"]) assert.ok(!svg.includes(word), `на плане лишнее: ${word}`);
  for (const word of ["МПАД-7/12", "ТРЮМ", "КОМПРЕССОРНАЯ", "МАШИННОЕ", "ОТДЕЛЕНИЕ", "люк между палубами"]) assert.ok(svg.includes(word), `на плане нет: ${word}`);
});

test("ссылок на сцены отсеков больше нет", () => {
  const js = fs.readFileSync(path.join(root, "scripts", "pelican.js"), "utf8");
  for (const word of ["canvas.controls", "mm-pelican-back", "pointertap"]) assert.ok(!js.includes(word), `осталось: ${word}`);
});

test("марионетки: у всех токенов экипажа, кроме Теда", () => {
  const tokens = fs.readdirSync(path.join(root, "assets", "vp", "tokens")).filter((f) => f.endsWith(".webp")).map((f) => f.replace(".webp", ""));
  assert.equal(tokens.length, 12);
  assert.deepEqual([...PUPPETS].sort(), tokens.filter((t) => t !== "ted").sort());
  for (const n of PUPPETS) assert.ok(fs.existsSync(path.join(root, "assets", "vp", "tokens", "puppet", `${n}.webp`)), `нет марионетки ${n}`);
});

test("распознавание картинки токена", () => {
  assert.deepEqual(parseSrc(normalSrc("okafor")), { name: "okafor", puppet: false });
  assert.deepEqual(parseSrc(puppetSrc("okafor")), { name: "okafor", puppet: true });
  assert.equal(parseSrc("modules/mymothership/assets/vp/tokens/ted.webp"), null);
  assert.equal(parseSrc("worlds/x/tokens/okafor.png"), null);
});

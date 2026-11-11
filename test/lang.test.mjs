import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.Hooks = { once() {}, on() {} };
const { collectLabelChanges } = await import("../scripts/main.js");
const RU = (await import("../lang/ru-mothership-fr.js")).default;

test("перевод — валидный JSON и совпадает с JS-версией", () => {
  const json = JSON.parse(fs.readFileSync(new URL("../lang/ru-mothership-fr.json", import.meta.url), "utf8"));
  assert.deepEqual(json, RU);
});

test("ключевые подписи листа на русском", () => {
  assert.equal(RU.Mosh.Strength, "Сила");
  assert.equal(RU.Mosh.Wounds, "Раны");
  assert.equal(RU.Mosh.PanicCheck, "Проверка паники");
});

test("подписи в данных персонажа переводятся и возвращаются обратно", () => {
  const src = { stats: { fear: { label: "Peur", rollLabel: "Sauvegarde de Peur", value: 30 } }, health: { label: "Santé" } };
  const ch = collectLabelChanges(src, { "Peur": "Страх", "Sauvegarde de Peur": "Испытание страха", "Santé": "Здоровье" });
  assert.deepEqual(ch, {
    "system.stats.fear.label": "Страх",
    "system.stats.fear.rollLabel": "Испытание страха",
    "system.health.label": "Здоровье"
  });
});

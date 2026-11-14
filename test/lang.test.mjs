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

test("фразы из кода системы в чате переводятся", async () => {
  const { translateText } = await import("../scripts/text-ru.js");
  assert.equal(translateText("FAILURE!"), "ПРОВАЛ!");
  assert.equal(translateText(" CRITICAL SUCCESS! "), " КРИТИЧЕСКИЙ УСПЕХ! ");
  assert.equal(translateText("\n   Vous n'avez pas obtenu moins que votre "), "\n   Не выпало меньше, чем ");
  assert.equal(translateText("Vous obtenu moins que ou égal à votre "), "Выпало не больше, чем ");
  assert.equal(translateText(" plus "), " плюс навык ");
  assert.equal(translateText(" bonus de compétence."), ".");
  assert.equal(translateText("Стресс augmente from "), "Стресс растёт с ");
  assert.equal(translateText(" to "), " до ");
  assert.equal(translateText(" points de Dégâts."), " урона.");
  assert.equal(translateText("Make a Panic Check"), "Пройти проверку паники");
  assert.equal(translateText("Plus de chance"), "Plus de chance");
});

test("в переводе есть кнопки окна броска", () => {
  assert.equal(RU.Advantage, "Преимущество");
  assert.equal(RU.Normal, "Обычный");
  assert.equal(RU.Disadvantage, "Помеха");
});

test("подписи кнопок окна броска переводятся и по тексту", async () => {
  const { translateText } = await import("../scripts/text-ru.js");
  assert.equal(translateText("Advantage"), "Преимущество");
  assert.equal(translateText(" Normal "), " Обычный ");
  assert.equal(translateText("Disadvantage"), "Помеха");
  assert.equal(translateText("Désavantage"), "Помеха");
  assert.equal(translateText("Normal roll"), "Normal roll");
});

test("фраза под броском собирается по-русски", async () => {
  const { rollSentenceRu, diceRu } = await import("../scripts/text-ru.js");
  assert.equal(rollSentenceRu("\n Vous n'avez pas obtenu moins que votre <strong>Сила</strong>.\n"), "Выпало не меньше <strong>Силы</strong>.");
  assert.equal(rollSentenceRu("Vous obtenu moins que votre <strong>Страх</strong>."), "Выпало меньше <strong>Страха</strong>.");
  assert.equal(rollSentenceRu("Vous obtenu moins que ou égal à votre <strong>Сила</strong> plus <strong>Géologie</strong> bonus de compétence."),
    "Выпало не больше <strong>Силы</strong> с навыком <strong>Géologie</strong>.");
  assert.equal(rollSentenceRu("Vous obtenu plus que votre <strong>Что-то</strong>."), "Выпало больше, чем <strong>Что-то</strong>.");
  assert.equal(rollSentenceRu("Другой текст"), null);
  assert.equal(diceRu("1d100 [+] < 10"), "к100 [+] < 10");
  assert.equal(diceRu("2d10 + 1d5"), "2к10 + к5");
});

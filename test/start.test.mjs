// Экран начала: логика, данные галереи и пробная отрисовка слоя без Foundry.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fitStage, ageText, clampSlide, takenMap, sameMap } from "../scripts/start-logic.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const crewData = JSON.parse(fs.readFileSync(path.join(root, "assets", "vp", "crew.json"), "utf8"));
const introData = JSON.parse(fs.readFileSync(path.join(root, "assets", "vp", "intro.json"), "utf8"));

test("сцена вписывается по центру свободной области", () => {
  const l = fitStage({ left: 100, top: 0, right: 1060, bottom: 1080 });
  assert.equal(l.scale, 0.5);
  assert.equal(l.left, 100);
  assert.equal(l.top, 270);
});

test("возраст по-русски", () => {
  assert.equal(ageText(52), "52 года");
  assert.equal(ageText(41), "41 год");
  assert.equal(ageText(66), "66 лет");
  assert.equal(ageText(12), "12 лет");
  assert.equal(ageText(null), "");
});

test("номер слайда: вне диапазона — вступление не идёт", () => {
  assert.equal(clampSlide(0, 3), 0);
  assert.equal(clampSlide(2, 3), 2);
  assert.equal(clampSlide(3, 3), -1);
  assert.equal(clampSlide(-1, 3), -1);
  assert.equal(clampSlide("x", 3), -1);
});

test("кто занят: владельцы и персонаж игрока, смотритель не в счёт", () => {
  const map = takenMap(
    [{ slug: "kovalchik", ownerIds: ["u1", "gm"] }, { slug: "ted", ownerIds: [] }, { slug: "oke", ownerIds: [] }],
    [
      { id: "u1", name: "Аня", isGM: false, characterSlug: "kovalchik" },
      { id: "u2", name: "Боря", isGM: false, characterSlug: "ted" },
      { id: "gm", name: "Смотритель", isGM: true, characterSlug: "oke" }
    ]
  );
  assert.deepEqual(map, { kovalchik: "Аня", ted: "Боря" });
  assert.ok(sameMap({ a: "1", b: "2" }, { b: "2", a: "1" }));
  assert.ok(!sameMap({ a: "1" }, {}));
});

test("галерея: 12 по старшинству, пометки как в макете", () => {
  const c = crewData.crew;
  assert.deepEqual(c.map((x) => x.slug), ["ferro", "okafor", "kovalchik", "oke", "lahti", "tanabe", "otieno", "haddad", "vargo", "holm", "kruger", "ted"]);
  assert.deepEqual(c.filter((x) => x.npc).map((x) => x.slug), ["ferro", "vargo"]);
  assert.deepEqual(c.filter((x) => x.company).map((x) => x.slug), ["okafor", "tanabe", "kruger", "ted"]);
  assert.deepEqual(c.filter((x) => !x.cls).map((x) => x.slug), ["ferro", "vargo"]);
  assert.equal(c.find((x) => x.slug === "ted").age, null);
  for (const x of c) {
    const actor = JSON.parse(fs.readFileSync(path.join(root, "src", "packs", "vp-crew", `${x.slug}.json`), "utf8"));
    assert.equal(actor._id, x.actorId, `${x.slug}: id актёра в компендиуме не совпадает`);
    assert.equal(actor.flags.mymothership.crew, x.slug);
  }
});

test("предпросмотр для игроков без тайн", () => {
  for (const x of crewData.crew) {
    assert.ok(!/Тайна|тварь|Тварь|приказ Компании|капсул/.test(x.preview), `${x.slug}: в предпросмотре лишнее`);
  }
});

test("вступление: три слайда с текстом для чтения вслух", () => {
  assert.equal(introData.slides.length, 3);
  for (const s of introData.slides) assert.ok(s.read.length > 50);
});

function stubFoundry({ isGM, slide = -1, taken = {} }) {
  const settings = { vpTaken: taken, vpIntroSlide: slide };
  globalThis.Hooks = { once() {}, on() {} };
  globalThis.window = { innerWidth: 1920, innerHeight: 1080, addEventListener() {} };
  globalThis.document = { querySelector: () => null };
  globalThis.game = {
    user: { isGM },
    settings: { get: (m, k) => settings[k], register() {}, registerMenu() {} },
    playlists: { getName: () => null, find: () => null },
    actors: { find: () => null },
    scenes: { find: () => null }
  };
}

test("слой рисуется: у игрока без кнопок смотрителя, у смотрителя с ними", async () => {
  const { _test } = await import("../scripts/start-screen.js");
  _test.setData(crewData.crew, introData);

  stubFoundry({ isGM: false, taken: { kovalchik: "Аня" } });
  const player = _test.stageHtml();
  assert.ok(player.includes("Восходящий<br>поток"));
  assert.ok(player.includes("«Пеликан» [МПАД-7/12]"));
  assert.ok(player.includes("«Четырнадцатая» [KG-414]"));
  assert.equal((player.match(/data-start="open"/g) ?? []).length, 12);
  assert.ok(player.includes("Занят · Аня"));
  assert.equal((player.match(/is-company/g) ?? []).length, 4);
  assert.equal((player.match(/is-npc/g) ?? []).length, 2);
  assert.ok(!player.includes("Начать вступление"));
  assert.ok(!player.includes("Отдать игроку"));
  assert.ok(!player.includes("Минус восемь"));

  stubFoundry({ isGM: true, taken: { kovalchik: "Аня" } });
  const gm = _test.stageHtml();
  assert.ok(gm.includes("Начать вступление"));
  // отдать можно 9 свободных персонажей игроков: 12 − капитан − Сэм − занятая Лола
  assert.equal((gm.match(/data-start="give"/g) ?? []).length, 9);
});

test("во время вступления слайд у всех, текст вслух — только у смотрителя", async () => {
  const { _test } = await import("../scripts/start-screen.js");
  _test.setData(crewData.crew, introData);
  stubFoundry({ isGM: false, slide: 1 });
  const player = _test.stageHtml();
  assert.ok(player.includes("assets/vp/intro/2.webp"));
  assert.ok(!player.includes("Читать вслух"));
  stubFoundry({ isGM: true, slide: 2 });
  const gm = _test.stageHtml();
  assert.ok(gm.includes("Читать вслух · слайд 3 из 3"));
  assert.ok(gm.includes("Закончить"));
});

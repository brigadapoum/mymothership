// Проверка собранного архива: всё, на что ссылается module.json и компендиумы, лежит в zip.
// В 0.2.0 из архива выпала папка styles — такие ошибки этот тест ловит до выпуска.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
const zipPath = path.join(root, "dist", "mymothership.zip");
const zipFiles = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" }).split("\n").filter(Boolean);
const inZip = (p) => zipFiles.some((f) => f === p || f.startsWith(p.replace(/\/?$/, "/")));

test("в архиве есть все файлы из module.json", () => {
  const refs = [
    ...manifest.esmodules,
    ...manifest.styles,
    ...manifest.languages.map((l) => l.path),
    ...(manifest.packs ?? []).map((p) => p.path)
  ];
  for (const ref of refs) assert.ok(inZip(ref), `нет в архиве: ${ref}`);
});

test("module.json в архиве совпадает с репозиторием", () => {
  const zipped = execFileSync("unzip", ["-p", zipPath, "module.json"], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(zipped), manifest);
});

test("ссылка на архив указывает на текущую версию", () => {
  assert.ok(manifest.download.includes(`/v${manifest.version}/`), `download не про v${manifest.version}: ${manifest.download}`);
});

test("в архиве есть все скрипты, которые импортирует main.js", () => {
  const scripts = ["scripts/main.js", ...zipFiles.filter((f) => f.startsWith("scripts/") && f.endsWith(".js"))];
  for (const file of scripts) {
    const code = fs.readFileSync(path.join(root, file), "utf8");
    for (const [, rel] of code.matchAll(/from\s+"(\.{1,2}\/[^"]+)"/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), rel));
      assert.ok(zipFiles.includes(target), `${file} импортирует ${target}, а его нет в архиве`);
    }
  }
});

test("картинки прегенов есть в архиве", () => {
  const src = path.join(root, "src", "packs");
  for (const pack of fs.readdirSync(src)) {
    for (const file of fs.readdirSync(path.join(src, pack))) {
      const text = fs.readFileSync(path.join(src, pack, file), "utf8");
      for (const [, p] of text.matchAll(/"modules\/mymothership\/([^"]+)"/g)) {
        assert.ok(zipFiles.includes(p), `${file}: нет картинки ${p}`);
      }
    }
  }
});

test("прегены: 10 персонажей и капитан, цифры в пределах 1e", () => {
  const dir = path.join(root, "src", "packs", "vp-crew");
  const actors = fs.readdirSync(dir).filter((f) => !f.startsWith("folder-"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  assert.equal(actors.length, 11);
  assert.equal(actors.filter((a) => a.flags.mymothership.pregen).length, 10);
  assert.equal(actors.filter((a) => a.flags.mymothership.recommended).length, 4);
  for (const a of actors) {
    assert.equal(a.type, "character");
    for (const k of ["strength", "speed", "intellect", "combat"]) {
      assert.ok(a.system.stats[k].value >= 20 && a.system.stats[k].value <= 75, `${a.name}: ${k}`);
    }
    assert.ok(a.items.some((i) => i.type === "skill"), `${a.name}: нет навыков`);
    assert.ok(a.items.some((i) => i.type === "armor" && i.system.equipped), `${a.name}: нет надетой брони`);
  }
});

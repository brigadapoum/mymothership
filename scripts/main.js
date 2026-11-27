// MyMothership — модуль Мастерской для Mothership 1e (система mothership-fr).
// Русский перевод интерфейса системы с выбором языка в настройках модуля.

import RU from "../lang/ru-mothership-fr.js";
import { translateElement, translateRollCard } from "./text-ru.js";
import { registerPlaylistFolder } from "./playlist-folder.js";
import { registerStartScreen } from "./start-screen.js";
import { registerPelican } from "./pelican.js";
import { registerPuppets } from "./puppet.js";

// Экран начала «Восходящего потока» — свои хуки init/ready, поэтому регистрируется сразу при загрузке.
registerStartScreen();
// «Пеликан»: план палуб; марионетки в HUD токена.
registerPelican();
registerPuppets();

const MODULE_ID = "mymothership";
const SYSTEM_ID = "mothership-fr";

// Подписи, которые система хранит прямо в данных персонажей и существ
// (из них собираются заголовки бросков в чате). Французский → русский.
const LABELS_FR_RU = {
  "Santé": "Здоровье",
  "Blessures": "Раны",
  "PV Nets": "Здоровье всего",
  "Saignement": "Кровотечение",
  "Force": "Сила",
  "Test de Force": "Проверка силы",
  "Vitesse": "Скорость",
  "Test de Vitesse": "Проверка скорости",
  "Intellect": "Интеллект",
  "Test d'Intellect": "Проверка интеллекта",
  "Combat": "Бой",
  "Test de Combat": "Проверка боя",
  "Sanité": "Рассудок",
  "Sauvegarde de Sanité": "Испытание рассудка",
  "Peur": "Страх",
  "Sauvegarde de Peur": "Испытание страха",
  "Corps": "Тело",
  "Sauvegarde de Corps": "Испытание тела",
  "Blindage": "Броня",
  "Sauvegarde de Blindage": "Испытание брони",
  "Stress": "Стресс",
  "Résolution": "Решимость",
  "Instinct": "Инстинкты",
  "Test d'Instinct": "Проверка инстинктов",
  "Loyauté": "Лояльность",
  "Test de Loyauté": "Проверка лояльности",
  "Propulseurs": "Двигатели",
  "Sauvegarde de Propulseurs": "Испытание двигателей",
  "Bataille": "Сражение",
  "Sauvegarde de Bataille": "Испытание сражения",
  "Systèmes": "Системы",
  "Sauvegarde de Systèmes": "Испытание систем",
  "Faillite": "Банкротство",
  "Sauvegarde de Faillite": "Испытание банкротства"
};
const LABELS_RU_FR = Object.fromEntries(Object.entries(LABELS_FR_RU).map(([fr, ru]) => [ru, fr]));

function isOurSystem() {
  return game.system?.id === SYSTEM_ID;
}

function useRussian() {
  try {
    return game.settings.get(MODULE_ID, "language") === "ru";
  } catch (err) {
    return true;
  }
}

// Ищет поля label и rollLabel и возвращает изменения в виде {"system.путь.label": "новое"}.
export function collectLabelChanges(source, map, path = "system", changes = {}) {
  for (const [key, value] of Object.entries(source ?? {})) {
    const p = `${path}.${key}`;
    if ((key === "label" || key === "rollLabel") && typeof value === "string" && map[value]) {
      changes[p] = map[value];
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      collectLabelChanges(value, map, p, changes);
    }
  }
  return changes;
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "language", {
    name: "Язык интерфейса Mothership",
    hint: "Язык листов персонажей, окон и сообщений системы Mothership. Каждый игрок выбирает для себя. Заголовки бросков в чате следуют выбору смотрителя. После смены страница перезагрузится.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      ru: "Русский",
      system: "Французский (язык системы)"
    },
    default: "ru",
    requiresReload: true
  });
  game.settings.register(MODULE_ID, "playlistFolder", {
    name: "Загрузка папки в плейлист",
    hint: "Добавляет пункт «Загрузить папку…» в меню плейлиста и кнопку в его настройках: все аудиофайлы выбранной папки попадают в плейлист разом. Только для смотрителя.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });
  registerPlaylistFolder(() => game.settings.get(MODULE_ID, "playlistFolder"));
});

// Русский перевод подключается самим Foundry через раздел languages в module.json — и для английского,
// и для русского языка Foundry. Скрипт для этого не нужен: даже если он не загрузился, листы будут по-русски.
// У системы есть только fr.json, и Foundry грузит его лишь при французском языке Foundry — поэтому
// выбор «Французский» в настройке модуля подмешивает fr.json системы поверх русского.
// Русский подмешивается ещё и скриптом — на случай любого другого языка Foundry.
let merged = false;
let frCache = null;
async function systemFrench() {
  if (frCache) return frCache;
  const res = await fetch(`systems/${SYSTEM_ID}/lang/fr.json`);
  frCache = await res.json();
  return frCache;
}
async function applyTranslation(stage) {
  if (!isOurSystem() || !game.i18n?.translations) return;
  try {
    const dict = useRussian() ? RU : await systemFrench();
    foundry.utils.mergeObject(game.i18n.translations, dict);
    if (!merged) console.log(`MyMothership ${game.modules.get(MODULE_ID)?.version} | перевод подключён: ${useRussian() ? "русский" : "французский"} (${stage})`);
    merged = true;
  } catch (err) {
    console.error("MyMothership | не удалось подключить перевод", err);
  }
}
Hooks.once("i18nInit", () => applyTranslation("i18nInit"));
Hooks.once("setup", () => applyTranslation("setup"));
Hooks.once("ready", () => applyTranslation("ready"));

// Если ключи всё равно видны как «Mosh.Name», смотритель сразу узнаёт, в чём дело.
Hooks.once("ready", () => {
  if (!isOurSystem() || !game.user.isGM) return;
  setTimeout(() => {
    if (game.i18n.localize("Mosh.Name") !== "Mosh.Name") return;
    ui.notifications.error("MyMothership: перевод Mothership не подключился — на листах видны ключи вида Mosh.Name. Обновите страницу с очисткой кэша (Ctrl+F5); если не поможет — откройте консоль (F12) и пришлите строки с MyMothership.", { permanent: true });
  }, 2000);
});

// Новые персонажи и существа сразу получают подписи на выбранном языке.
Hooks.on("preCreateActor", (actor) => {
  if (!isOurSystem() || !useRussian()) return;
  const changes = collectLabelChanges(actor._source.system, LABELS_FR_RU);
  if (Object.keys(changes).length) actor.updateSource(changes);
});

// Смотритель при входе приводит подписи у всех актёров мира к своему выбору.
Hooks.once("ready", async () => {
  if (!isOurSystem() || !game.user.isGM) return;
  const map = useRussian() ? LABELS_FR_RU : LABELS_RU_FR;
  const updates = [];
  for (const actor of game.actors) {
    const changes = collectLabelChanges(actor._source.system, map);
    if (Object.keys(changes).length) updates.push({ _id: actor.id, ...changes });
  }
  if (!updates.length) return;
  await Actor.implementation.updateDocuments(updates);
  ui.notifications.info(`MyMothership: подписи обновлены у ${updates.length} актёров.`);
});

// Текст, который система вписывает в чат и окна прямо в коде, подменяем при показе.
function toElement(html) {
  if (!html) return null;
  if (html instanceof HTMLElement) return html;
  return html[0] ?? null; // jQuery в старых хуках
}
function translateRendered(html) {
  if (!isOurSystem() || !useRussian()) return;
  const el = toElement(html);
  translateRollCard(el);
  translateElement(el);
}
Hooks.once("init", () => {
  if ((game.release?.generation ?? 0) >= 13) {
    Hooks.on("renderChatMessageHTML", (message, html) => translateRendered(html));
  } else {
    Hooks.on("renderChatMessage", (message, html) => translateRendered(html));
  }
  Hooks.on("renderApplicationV2", (app, html) => translateRendered(html));
  Hooks.on("renderApplication", (app, html) => translateRendered(html));
});

// Окна выбора броска (Преимущество / Обычный / Помеха): система задаёт им жёсткую высоту
// (125–160 px), и подпись «Выберите тип броска» налезает на кнопки. Подгоняем высоту под содержимое.
function fitRollDialog(app, html) {
  if (!isOurSystem()) return;
  const el = toElement(html) ?? app?.element;
  if (!el?.querySelector?.('button[data-action="advantage"], button[data-action="disadvantage"]')) return;
  el.classList.add("mymothership-roll-dialog");
  try {
    app.setPosition({ height: "auto" });
  } catch (err) {
    console.warn("MyMothership | не удалось подогнать высоту окна броска", err);
  }
}
Hooks.on("renderDialogV2", (app, html) => fitRollDialog(app, html));

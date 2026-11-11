// MyMothership — модуль Мастерской для Mothership 1e (система mothership-fr).
// Версия 0.1: русский перевод интерфейса системы с выбором языка в настройках модуля.

import RU from "../lang/ru-mothership-fr.js";

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
      system: "Язык системы (французский)"
    },
    default: "ru",
    requiresReload: true
  });
});

// Перевод подмешивается сразу после того, как Foundry загрузил языковые файлы.
Hooks.once("i18nInit", () => {
  if (!isOurSystem() || !useRussian()) return;
  foundry.utils.mergeObject(game.i18n.translations, RU);
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

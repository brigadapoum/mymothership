// Часть текста система mothership-fr вписывает в чат и окна прямо в коде, мимо языкового файла
// (по-французски и по-английски). Здесь эти фразы подменяются на русские при показе.
// Правила узкие: каждое ловит конкретный кусок текста из кода системы 1.8.21.

const COMPARISON = {
  "moins que": "меньше, чем",
  "moins que ou égal à": "не больше, чем",
  "plus que": "больше, чем",
  "plus que ou égal à": "не меньше, чем"
};

export const TEXT_RULES = [
  // Итог броска (actor.js, parseRollResult)
  [/^(\s*)CRITICAL SUCCESS!(\s*)$/, "$1КРИТИЧЕСКИЙ УСПЕХ!$2"],
  [/^(\s*)CRITICAL FAILURE!(\s*)$/, "$1КРИТИЧЕСКИЙ ПРОВАЛ!$2"],
  [/^(\s*)SUCCESS!(\s*)$/, "$1УСПЕХ!$2"],
  [/^(\s*)FAILURE!(\s*)$/, "$1ПРОВАЛ!$2"],
  // «Vous obtenu moins que votre <Сила> plus <навык> bonus de compétence.» (rollCheck.html)
  [/Vous (n'avez pas obtenu|obtenu) (moins que ou égal à|moins que|plus que ou égal à|plus que) votre(\s*)$/,
    (m, verb, cmp, ws) => `${verb === "obtenu" ? "Выпало" : "Не выпало"} ${COMPARISON[cmp]}${ws}`],
  [/^(\s*)plus(\s*)$/, "$1плюс навык$2"],
  [/^\s*bonus de compétence\.\s*$/, "."],
  // Изменение характеристик: «Стресс augmente from 2 to 3.»
  [/ (augmente|increased) from(\s*)$/, " растёт с$2"],
  [/ (diminué|decreased) from(\s*)$/, " падает с$2"],
  [/^(\s*)to(\s*)$/, "$1до$2"],
  [/Reduce the most relevant Stat or Save by (\d+)/, "Уменьшите на $1 самую подходящую характеристику или испытание"],
  // Урон
  [/Vous frappez votre cible pour/, "Вы наносите цели"],
  [/vous infligez à votre cible/, "вы наносите цели"],
  [/^(\s*)damage(\s*)$/, "$1урона$2"],
  [/Vous infligez(\s*)$/, "Вы наносите$1"],
  [/You inflict(\s*)$/, "Вы наносите$1"],
  [/^(\s*)points de Dégâts\.(\s*)$/, "$1урона.$2"],
  // Инвентарь
  [/You add(\s*)$/, "Вы добавляете$1"],
  [/^(\s*)of these to your inventory\.(\s*)$/, "$1шт. в инвентарь.$2"],
  // Корабль и спокойствие
  [/You lose 1d10 Calm because you critically failed\./, "Критический провал: вы теряете 1d10 спокойствия."],
  [/Everyone on board the ship takes 1 Stress\./, "Все на борту получают 1 стресс."],
  [/Everyone on board the ship loses 1d10 Calm\./, "Все на борту теряют 1d10 спокойствия."],
  [/You must roll for another maintenance issue because you critically failed\./, "Из-за критического провала бросьте ещё одну неисправность."],
  // Ссылка-кнопка под броском
  [/^(\s*)Make a Panic Check(\s*)$/, "$1Пройти проверку паники$2"],
  // Кнопки окна броска — запасной путь, если ключ перевода не сработал
  [/^(\s*)(Advantage|Avantage)(\s*)$/, "$1Преимущество$3"],
  [/^(\s*)Normal(\s*)$/, "$1Обычный$2"],
  [/^(\s*)(Disadvantage|Désavantage)(\s*)$/, "$1Помеха$3"],
  // Ошибки поиска таблиц
  [/Table non trouvée pour l'ID: /, "Таблица не найдена, ID: "],
  [/Table non trouvée\. Vérifiez que les compendiums sont correctement chargés\./, "Таблица не найдена. Проверьте, что компендиумы системы загружены."]
];

export function translateText(text) {
  let out = text;
  for (const [re, to] of TEXT_RULES) {
    if (re.test(out)) out = out.replace(re, to);
  }
  return out;
}

// Проходит по всем текстовым узлам элемента и подменяет фразы.
export function translateElement(root) {
  if (!root || typeof document === "undefined") return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const before = node.nodeValue;
    if (!before || !before.trim()) continue;
    const after = translateText(before);
    if (after !== before) node.nodeValue = after;
  }
}

// ---------- Фраза под броском в чате ----------
// Система пишет: «Vous obtenu moins que votre <strong>Сила</strong>[ plus <strong>Навык</strong> bonus de compétence].»
// Собираем по-русски целиком: «Выпало меньше Силы.» / «Выпало не меньше Силы с навыком Геология.»

// Родительный падеж характеристик и испытаний (подписи из листа персонажа).
const GENITIVE = {
  "Сила": "Силы", "Скорость": "Скорости", "Интеллект": "Интеллекта", "Бой": "Боя",
  "Рассудок": "Рассудка", "Страх": "Страха", "Тело": "Тела", "Броня": "Брони",
  "Инстинкты": "Инстинктов", "Лояльность": "Лояльности", "Здоровье": "Здоровья",
  "Двигатели": "Двигателей", "Сражение": "Сражения", "Системы": "Систем", "Банкротство": "Банкротства",
  "Force": "Силы", "Vitesse": "Скорости", "Intellect": "Интеллекта", "Combat": "Боя",
  "Sanité": "Рассудка", "Peur": "Страха", "Corps": "Тела", "Blindage": "Брони",
  "Instinct": "Инстинктов", "Loyauté": "Лояльности"
};

// Успех: как сравнивали. Провал — то же с отрицанием.
const COMPARE_RU = {
  "moins que": ["меньше", "не меньше"],
  "moins que ou égal à": ["не больше", "больше"],
  "plus que": ["больше", "не больше"],
  "plus que ou égal à": ["не меньше", "меньше"]
};

const ROLL_SENTENCE = /^\s*Vous\s+(n'avez pas obtenu|obtenu)\s+(moins que ou égal à|moins que|plus que ou égal à|plus que)\s+votre\s*<strong>([\s\S]*?)<\/strong>(?:\s*plus\s*<strong>([\s\S]*?)<\/strong>\s*bonus de compétence)?\s*\.\s*$/;

export function rollSentenceRu(html) {
  const m = ROLL_SENTENCE.exec(html ?? "");
  if (!m) return null;
  const [, verb, cmp, attrRaw, skillRaw] = m;
  const success = verb === "obtenu";
  const word = COMPARE_RU[cmp][success ? 0 : 1];
  const attr = attrRaw.trim();
  const gen = GENITIVE[attr];
  let out = gen ? `Выпало ${word} <strong>${gen}</strong>` : `Выпало ${word}, чем <strong>${attr}</strong>`;
  if (skillRaw && skillRaw.trim()) out += ` с навыком <strong>${skillRaw.trim()}</strong>`;
  return out + ".";
}

// Формула броска: 1d100 → к100, 2d10 → 2к10 (только надпись, сам бросок не трогаем).
export function diceRu(text) {
  return text.replace(/\b(\d*)d(\d+)\b/g, (m, n, sides) => `${n === "1" ? "" : n}к${sides}`);
}

export function translateRollCard(root) {
  if (!root?.querySelectorAll) return;
  for (const body of root.querySelectorAll(".rollcontainer .description .body")) {
    const ru = rollSentenceRu(body.innerHTML);
    if (ru) body.innerHTML = ru;
  }
  for (const el of root.querySelectorAll(".dice-formula, .part-formula")) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const after = diceRu(n.nodeValue);
      if (after !== n.nodeValue) n.nodeValue = after;
    }
  }
}

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

// Сцена корабля «Пеликан» [МПАД-7/12] — по макету «Сцена корабля» (холст «Пеликан — сцены Foundry», 2026-11-27).
// Слева — схема: плитка плана на холсте Foundry, на ней фишки экипажа (расставлены при создании сцены).
// Справа — два «канала» для арта, как фото на столе дела в Надграде: смотритель выводит картинку,
// меняет, кадрирует, подписывает, убирает; пустой канал игрокам показывает «НЕТ СИГНАЛА».
// Слой 1920×1080 (HTML) с вырезом под схему; при входе вид холста подгоняется так, чтобы план лёг ровно в вырез;
// дальше схему можно приближать и двигать, но карта привязана к рамке: не мельче «всего плана», не за край
// (2026-11-27, автор); вне рамки холст закрыт и за пределами слоя; «Весь план» возвращает исходный вид.
// Оформление — неон по референсу автора: бирюза на чёрном, кабели по краям, красные точки тревоги.
// Отдельных сцен отсеков нет (решение автора 2026-11-27); сцены от 0.5.x модуль предлагает удалить.
import { SCENE, TILE, START, normSlots, nextFit, FIT_LABEL, viewFor, clampView, holeOnScreen } from "./ship-logic.js";
import { STAGE, fitStage } from "./start-logic.js";
import { freeArea, ensureAllCrew } from "./start-screen.js";
import { puppetSrc } from "./puppet.js";
import { CABLES_SVG } from "./ship-cables.js";

const MODULE_ID = "mymothership";
const SYSTEM_ID = "mothership-fr";
const BASE = `modules/${MODULE_ID}/assets/vp`;
const FOLDER = "Восходящий поток — «Пеликан»";
const SHIP_NAME = "«Пеликан» [МПАД-7/12]";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const setting = (k, fb) => { try { return game.settings.get(MODULE_ID, k); } catch { return fb; } };
const tag = (scene) => scene?.getFlag?.(MODULE_ID, "pelican") ?? null;
const isShip = (scene) => tag(scene) === "ship";
export const shipScene = () => game.scenes?.find((s) => isShip(s)) ?? null;
const oldScenes = () => game.scenes?.filter((s) => { const t = tag(s); return t && t !== "ship"; }) ?? [];
const slotsOf = (scene) => normSlots(scene?.getFlag?.(MODULE_ID, "slots"));

function tileRect(scene) {
  const saved = scene?.getFlag?.(MODULE_ID, "tile");
  if (saved?.w) return saved;
  const d = scene?.dimensions ?? scene?.getDimensions?.();
  return { x: (d?.sceneX ?? 0) + TILE.dx, y: (d?.sceneY ?? 0) + TILE.dy, w: TILE.w, h: TILE.h };
}

// ---------- создание сцены ----------

async function sceneFolder() {
  return game.folders.find((f) => f.type === "Scene" && f.name === FOLDER)
    ?? Folder.create({ name: FOLDER, type: "Scene", color: "#1f6f6a", sorting: "m" });
}

/** Сцена корабля: план плиткой, весь экипаж фишками на местах «при ударе». Если есть — просто вернуть. */
export async function createShip() {
  if (!game.user.isGM) return null;
  const have = shipScene();
  if (have) return have;
  const folder = await sceneFolder();
  const scene = await Scene.create({
    name: SHIP_NAME,
    navName: "Пеликан",
    navigation: true,
    folder: folder.id,
    width: SCENE.w, height: SCENE.h, padding: SCENE.padding,
    backgroundColor: "#060909",
    grid: { type: CONST.GRID_TYPES.GRIDLESS, size: SCENE.grid },
    tokenVision: false,
    fog: { exploration: false },
    flags: { [MODULE_ID]: { pelican: "ship", slots: normSlots([]) } }
  });
  const t = tileRect(scene);
  await scene.update({ [`flags.${MODULE_ID}.tile`]: t });
  await scene.createEmbeddedDocuments("Tile", [{
    texture: { src: `${BASE}/ship/plan-scene.webp` },
    x: t.x, y: t.y, width: t.w, height: t.h, locked: true,
    flags: { [MODULE_ID]: { shipPlan: true } }
  }]);
  const actors = await ensureAllCrew();
  const half = SCENE.grid / 2;
  const tokens = [];
  for (const p of START) {
    const actor = actors.get(p.slug);
    if (!actor) continue;
    const doc = await actor.getTokenDocument({ x: t.x + p.x - half, y: t.y + p.y - half, hidden: !!p.hidden });
    const data = doc.toObject();
    if (p.puppet) foundry.utils.setProperty(data, "texture.src", puppetSrc(p.slug));
    tokens.push(data);
  }
  if (tokens.length) await scene.createEmbeddedDocuments("Token", tokens);
  ui.notifications.info(`Сцена «${SHIP_NAME}» готова: план и ${tokens.length} фишек экипажа.`);
  return scene;
}

async function deleteOld() {
  const list = oldScenes();
  if (!list.length) return 0;
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Удалить старые сцены «Пеликана»" },
    content: `<p>Удалить ${list.length} сцен(ы) от версий 0.5.x — старый план палуб и сцены отсеков, коридора и трапа? Это нельзя отменить. Фишки на них пропадут вместе со сценами; актёры экипажа останутся.</p>`
  });
  if (!ok) return 0;
  await Scene.deleteDocuments(list.map((s) => s.id));
  return list.length;
}

// ---------- слой поверх холста ----------

let root = null;
let layout = null;
let target = null;
let fixing = false;

function mount() {
  if (root?.isConnected) return root;
  root = document.createElement("div");
  root.id = "mm-ship";
  root.setAttribute("aria-label", "Сцена корабля");
  const ui = document.getElementById("interface");
  const board = document.getElementById("board");
  const zi = parseInt(ui ? getComputedStyle(ui).zIndex : "", 10);
  const zb = parseInt(board ? getComputedStyle(board).zIndex : "", 10);
  root.style.zIndex = String(Number.isFinite(zi) ? zi : (Number.isFinite(zb) ? zb : 0) + 1);
  if (ui?.parentElement) ui.parentElement.insertBefore(root, ui);
  else document.body.appendChild(root);
  root.addEventListener("click", onClick);
  root.addEventListener("wheel", (e) => { if (e.target.closest(".mm-sh-frame.chan, .mm-sh-head")) { e.preventDefault(); e.stopPropagation(); } }, { passive: false });
  return root;
}

function unmount() { root?.remove(); root = null; layout = null; target = null; }

const ICON_GEAR = `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10" cy="10" r="3"></circle><path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3M4 4l2.1 2.1M13.9 13.9 16 16M4 16l2.1-2.1M13.9 6.1 16 4"></path></svg>`;
const CORNERS = `<span class="cn tl"></span><span class="cn tr"></span><span class="cn bl"></span><span class="cn br"></span>`;

function chanHtml(s, i, isGM) {
  const on = !!s.src;
  const top = 100 + i * 480;
  const gm = isGM && on
    ? `<div class="mm-sh-gm"><button type="button" class="mm-sh-gb" data-ship="pick" data-i="${i}">Арт</button><button type="button" class="mm-sh-gb" data-ship="fit" data-i="${i}" data-tooltip="Кадр: ${esc(FIT_LABEL[s.fit])}">Кадр</button><button type="button" class="mm-sh-gb" data-ship="clear" data-i="${i}" aria-label="Убрать арт">×</button></div>`
    : "";
  const cap = s.caption
    ? (isGM ? `<button type="button" class="mm-sh-cap-t" data-ship="cap" data-i="${i}">${esc(s.caption)}</button>` : `<span class="mm-sh-cap-t">${esc(s.caption)}</span>`)
    : (isGM && on ? `<button type="button" class="mm-sh-cap-t add" data-ship="cap" data-i="${i}">+ подпись</button>` : `<span class="mm-sh-cap-t"></span>`);
  return `<section class="mm-sh-frame chan" style="left: 1348px; top: ${top}px; width: 500px; height: 460px">${CORNERS}
    <div class="mm-sh-bar"><span class="mm-sh-dot ${on ? "ok" : ""}"></span><span class="mm-sh-lbl hi">Канал ${i + 1}</span>
      <span class="mm-sh-lbl ${on ? "" : "alarm"}" style="margin-left: auto">${on ? "приём" : "нет сигнала"}</span></div>
    <div class="mm-sh-win">
      ${on
        ? `<img class="art fit-${s.fit}" src="${esc(s.src)}" alt="${esc(s.caption || `Канал ${i + 1}`)}"><div class="tint"></div><div class="scan"></div>
           <button type="button" class="mm-sh-zoom" data-ship="zoom" data-i="${i}" aria-label="Открыть крупно"></button>`
        : `<div class="mm-sh-nosig"><div class="t">НЕТ СИГНАЛА</div>${isGM ? `<button type="button" class="mm-sh-gb big" data-ship="pick" data-i="${i}">+ Вывести арт</button>` : ""}</div>`}
    </div>
    <div class="mm-sh-cap">${cap}${gm}</div>
  </section>`;
}

export function stageHtml(slots, isGM) {
  return `<div class="mm-sh-stage">
    <div class="mm-sh-bg"></div>
    ${CABLES_SVG}
    <div class="mm-sh-tube" style="left: 640px; top: 8px; width: 300px; transform: rotate(-2.5deg)"></div>
    <div class="mm-sh-tube" style="left: 1010px; top: 14px; width: 240px; transform: rotate(1.8deg)"></div>
    <header class="mm-sh-head">
      <div class="mm-sh-title"><span>МПАД-7/12</span>«ПЕЛИКАН»</div>
      <div class="mm-sh-lbl" style="margin: 10px 0 0 8px">газосборщик · экипаж 12</div>
      <div class="mm-sh-lbl dim" style="margin-left: auto">Компания · отдел атмосферной добычи · KG-414</div>
      ${isGM ? `<button type="button" class="mm-sh-gb" data-ship="admin" aria-label="Настройки сцены корабля">${ICON_GEAR}</button>` : ""}
    </header>
    <section class="mm-sh-frame plan" style="left: 72px; top: 100px; width: 1256px; height: 940px">${CORNERS}
      <div class="mm-sh-bar"><span class="mm-sh-dot ok"></span><span class="mm-sh-lbl hi">Схема отсеков</span><span class="mm-sh-lbl" style="margin-left: auto">верхняя палуба · нижняя палуба</span><button type="button" class="mm-sh-gb slim" data-ship="fitview" data-tooltip="Вернуть план целиком в рамку">Весь план</button></div>
    </section>
    ${slots.map((s, i) => chanHtml(s, i, isGM)).join("")}
    <div class="mm-sh-scan-all"></div>
  </div>`;
}

function render() {
  const scene = canvas?.scene;
  if (!isShip(scene)) return unmount();
  mount();
  root.innerHTML = `<div class="mm-sh-cover"></div>${stageHtml(slotsOf(scene), game.user.isGM)}`;
  relayout();
}

function relayout() {
  const stage = root?.querySelector(".mm-sh-stage");
  if (!stage) return;
  layout = fitStage(freeArea(), STAGE);
  stage.style.transform = `scale(${layout.scale})`;
  stage.style.left = `${layout.left}px`;
  stage.style.top = `${layout.top}px`;
  // всё вне выреза закрыто — и за пределами слоя тоже: холст виден только в рамке
  const W = window.innerWidth, H = window.innerHeight, h = holeOnScreen(layout);
  const cover = root.querySelector(".mm-sh-cover");
  if (cover) cover.style.clipPath = `polygon(evenodd, 0 0, ${W}px 0, ${W}px ${H}px, 0 ${H}px, 0 0, ${h.x}px ${h.y}px, ${h.x + h.w}px ${h.y}px, ${h.x + h.w}px ${h.y + h.h}px, ${h.x}px ${h.y + h.h}px, ${h.x}px ${h.y}px)`;
  align();
}

/** Подогнать вид холста: плитка плана целиком в вырез слоя. Дальше её можно приближать и двигать —
 *  но не мельче «всего плана» и не за край плитки (карта привязана к рамке); «Весь план» возвращает исходный вид. */
function align() {
  const scene = canvas?.scene;
  if (!isShip(scene) || !layout || !canvas?.ready) return;
  target = viewFor(layout, tileRect(scene), { w: window.innerWidth, h: window.innerHeight });
  canvas.pan(target);
}

// ---------- каналы ----------

async function setSlot(i, patch) {
  const scene = canvas?.scene;
  if (!isShip(scene) || !game.user.isGM) return;
  const slots = slotsOf(scene);
  slots[i] = { ...slots[i], ...patch };
  await scene.setFlag(MODULE_ID, "slots", slots);
}

function pickArt(i) {
  const s = slotsOf(canvas.scene)[i];
  const FP = foundry.applications.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
  const fp = new FP({ type: "image", current: s.src || "", callback: (path) => setSlot(i, { src: path, fit: "cover" }) });
  fp.render({ force: true });
}

async function editCaption(i) {
  const s = slotsOf(canvas.scene)[i];
  const value = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Подпись — канал ${i + 1}` },
    content: `<input name="cap" type="text" value="${esc(s.caption)}" placeholder="Например: «Приемная-2» · стыковка" style="width: 100%" autofocus>`,
    ok: { label: "Сохранить", callback: (event, button) => button.form.elements.cap.value.trim() },
    rejectClose: false
  });
  if (value !== null && value !== undefined) await setSlot(i, { caption: value });
}

function zoomArt(i) {
  const s = slotsOf(canvas.scene)[i];
  if (!s.src) return;
  const IP = foundry.applications.apps?.ImagePopout ?? globalThis.ImagePopout;
  new IP({ src: s.src, caption: s.caption || "", window: { title: s.caption || `Канал ${i + 1}` } }).render({ force: true });
}

async function onClick(event) {
  const btn = event.target.closest("[data-ship]");
  if (!btn || btn.disabled) return;
  event.preventDefault();
  event.stopPropagation();
  const i = Number(btn.dataset.i ?? 0);
  switch (btn.dataset.ship) {
    case "pick": return pickArt(i);
    case "fit": return setSlot(i, { fit: nextFit(slotsOf(canvas.scene)[i].fit) });
    case "clear": return setSlot(i, { src: "", caption: "" });
    case "cap": return editCaption(i);
    case "zoom": return zoomArt(i);
    case "fitview": return align();
    case "admin": {
      const open = foundry.applications.instances?.get("mm-pelican-admin");
      return open ? open.render({ force: true }) : new (adminClass())().render({ force: true });
    }
  }
}

// ---------- настройки ----------

let AdminClass = null;
function adminClass() {
  if (AdminClass) return AdminClass;
  const { ApplicationV2 } = foundry.applications.api;
  AdminClass = class PelicanAdmin extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: "mm-pelican-admin",
      classes: ["mm-start-admin"],
      window: { title: "Восходящий поток — «Пеликан»", icon: "fa-solid fa-ship" },
      position: { width: 460 },
      actions: {
        create: async function () { const s = await createShip(); await s?.view(); this.render(); },
        view: function () { shipScene()?.view(); },
        activate: async function () { await shipScene()?.activate(); this.render(); },
        cleanup: async function () {
          const n = await deleteOld();
          if (n) ui.notifications.info(`Удалено сцен: ${n}.`);
          this.render();
        }
      }
    };
    async _renderHTML() {
      const ship = shipScene();
      const old = oldScenes().length;
      return `<section class="mm-sa">
        <h3>Сцена корабля</h3>
        <p>${ship ? `«${esc(ship.name)}»${ship.active ? " — активна." : "."}` : "Сцены ещё нет. Модуль создаст её с планом палуб и поставит на план всех 12 человек экипажа (Сэм — скрыт, марионеткой)."}</p>
        <p class="mm-sa-row">${ship
          ? `<button type="button" data-action="view">Открыть у себя</button><button type="button" data-action="activate" ${ship.active ? "disabled" : ""}>Сделать активной</button>`
          : `<button type="button" data-action="create">Создать сцену корабля</button>`}</p>
        <h3>Каналы</h3>
        <p>Справа два канала для арта. «+ Вывести арт» или «Арт» — выбрать картинку (файловый браузер Foundry), «Кадр» — по центру / верх / низ / целиком, «×» — убрать, клик по подписи — изменить. Клик по арту — крупно (там же «Показать игрокам»). Пустой канал игроки видят как «НЕТ СИГНАЛА».</p>
        <h3>Марионетки</h3>
        <p>Правый клик по токену экипажа → кнопка с пауком: токен становится марионеткой и обратно. У Теда марионетки нет.</p>
        ${old ? `<h3>Старые сцены</h3><p>От версий 0.5.x осталось ${old} сцен(ы): старый план и сцены отсеков. Они больше не нужны.</p><p class="mm-sa-row"><button type="button" data-action="cleanup">Удалить их</button></p>` : ""}
      </section>`;
    }
    _replaceHTML(result, content) { content.innerHTML = result; }
  };
  return AdminClass;
}

export function registerPelican() {
  Hooks.once("init", () => {
    game.settings.register(MODULE_ID, "vpShipOffered", { scope: "world", config: false, type: Boolean, default: false });
    game.settings.registerMenu(MODULE_ID, "vpPelicanMenu", {
      name: "Восходящий поток — «Пеликан»",
      label: "Открыть",
      hint: "Сцена корабля: план палуб с фишками экипажа и два канала для арта; марионетки; удаление старых сцен.",
      icon: "fa-solid fa-ship",
      type: adminClass(),
      restricted: true
    });
  });

  Hooks.once("ready", async () => {
    if (game.system?.id !== SYSTEM_ID || !game.user.isGM) return;
    if (!shipScene() && !setting("vpShipOffered", false)) {
      await game.settings.set(MODULE_ID, "vpShipOffered", true);
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: "Восходящий поток: сцена корабля" },
        content: "<p>Создать сцену корабля «Пеликан»: план палуб, на нём фишки всего экипажа, справа два канала для арта?</p><p>Потом это есть в настройках модуля: «Восходящий поток — «Пеликан»».</p>"
      });
      if (ok) await (await createShip())?.view();
    }
  });

  Hooks.on("canvasReady", () => render());
  Hooks.on("canvasTearDown", () => unmount());
  Hooks.on("updateScene", (scene, change) => {
    if (scene.id === canvas?.scene?.id && foundry.utils.hasProperty(change, `flags.${MODULE_ID}`)) render();
  });
  // карта привязана к рамке: мельче «всего плана» не уменьшить, за край не утащить
  Hooks.on("canvasPan", (c, view) => {
    if (fixing || !target || !layout || !isShip(canvas?.scene)) return;
    const fixed = clampView(view, target, layout, tileRect(canvas.scene), { w: window.innerWidth, h: window.innerHeight });
    if (!fixed) return;
    fixing = true;
    requestAnimationFrame(() => { try { canvas.pan(fixed); } finally { fixing = false; } });
  });
  Hooks.on("collapseSidebar", () => setTimeout(relayout, 250));
  Hooks.on("renderSceneNavigation", () => setTimeout(relayout, 50));
  Hooks.once("ready", () => window.addEventListener("resize", () => relayout()));
}

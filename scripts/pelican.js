// «Пеликан» в Foundry: сцена-план палуб и 13 дочерних сцен (11 отсеков, главный коридор, наружный трап).
// Без стен, тумана и телепортов — просто расставлять фишки (решение автора 2026-11-24).
// Смотритель: клик по названию отсека на плане — открыть его сцену у себя, Shift + клик — перенести всех.
// На дочерней сцене у смотрителя кнопка «← Пеликан» (Shift — всех). Задники отсеков ставит автор,
// модуль созданные сцены не переписывает.
import { PLAN, PLACES, sceneName, toScene } from "./pelican-data.js";

const MODULE_ID = "mymothership";
const SYSTEM_ID = "mothership-fr";
const BASE = `modules/${MODULE_ID}/assets/vp`;
const FOLDER = "Восходящий поток — «Пеликан»";
const PLAN_NAME = "«Пеликан»";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const setting = (k, fb) => { try { return game.settings.get(MODULE_ID, k); } catch { return fb; } };
const tag = (scene) => scene?.getFlag?.(MODULE_ID, "pelican") ?? null;
export const planScene = () => game.scenes?.find((s) => tag(s) === "plan") ?? null;
const placeScene = (key) => game.scenes?.find((s) => tag(s) === key) ?? null;

// ---------- сцены ----------

async function sceneFolder() {
  return game.folders.find((f) => f.type === "Scene" && f.name === FOLDER)
    ?? Folder.create({ name: FOLDER, type: "Scene", color: "#1f6f6a", sorting: "m" });
}

/** Создаёт недостающие сцены. Существующие не трогает (задники автора остаются). */
export async function createPelican() {
  if (!game.user.isGM) return 0;
  const folder = await sceneFolder();
  const GRIDLESS = CONST.GRID_TYPES.GRIDLESS;
  const todo = [];
  if (!planScene()) {
    todo.push({
      name: PLAN_NAME,
      navName: "Пеликан",
      navigation: true,
      folder: folder.id,
      sort: 0,
      width: PLAN.imageW, height: PLAN.imageH, padding: 0.05,
      backgroundColor: "#16191a",
      background: { src: `${BASE}/${PLAN.image}` },
      grid: { type: GRIDLESS, size: 60 },
      tokenVision: false,
      fog: { exploration: false },
      flags: { [MODULE_ID]: { pelican: "plan" } }
    });
  }
  PLACES.forEach((p, i) => {
    if (placeScene(p.key)) return;
    todo.push({
      name: sceneName(p),
      navigation: false,
      folder: folder.id,
      sort: (i + 1) * 10,
      width: 1920, height: 1080, padding: 0.05,
      backgroundColor: "#0d0f0e",
      grid: { type: GRIDLESS, size: 100 },
      tokenVision: false,
      fog: { exploration: false },
      flags: { [MODULE_ID]: { pelican: p.key } }
    });
  });
  if (todo.length) await Scene.createDocuments(todo);
  return todo.length;
}

async function go(scene, all) {
  if (!scene) return ui.notifications.warn("MyMothership: сцены нет — создайте сцены «Пеликана» в настройках модуля.");
  if (all) await scene.activate();
  else await scene.view();
}

// ---------- зоны на плане (только смотрителю) ----------

let layer = null;

function clearLayer() {
  if (layer && !layer.destroyed) layer.destroy({ children: true });
  layer = null;
}

function drawPlan() {
  clearLayer();
  if (!game.user.isGM || tag(canvas?.scene) !== "plan" || !canvas.controls) return;
  const rect = canvas.dimensions.sceneRect;
  layer = new PIXI.Container();
  layer.name = "mm-pelican";
  layer.sortableChildren = true;
  const hilite = new PIXI.Graphics();
  const tip = new PIXI.Text("", {
    fontFamily: "MM IBM Plex Mono, IBM Plex Mono, monospace", fontSize: 22, fontWeight: "600",
    fill: 0x111111, padding: 4
  });
  const tipBox = new PIXI.Graphics();
  const tipWrap = new PIXI.Container();
  tipWrap.addChild(tipBox, tip);
  tipWrap.visible = false;
  tipWrap.zIndex = 10;

  for (const p of PLACES) {
    const hot = toScene(p.hot, rect);
    const room = toScene(p.room, rect);
    const zone = new PIXI.Graphics();
    zone.beginFill(0xe2b33c, 0.001).drawRect(hot.x, hot.y, hot.width, hot.height).endFill();
    zone.eventMode = "static";
    zone.cursor = "pointer";
    zone.hitArea = new PIXI.Rectangle(hot.x, hot.y, hot.width, hot.height);
    zone.on("pointerover", () => {
      hilite.clear();
      hilite.lineStyle(6, 0xe2b33c, 0.95).drawRect(room.x, room.y, room.width, room.height);
      hilite.lineStyle(0).beginFill(0xe2b33c, 0.22).drawRect(hot.x, hot.y, hot.width, hot.height).endFill();
      tip.text = `${p.num ? `${p.num} · ` : ""}${p.name} — открыть · Shift: всем`;
      tipBox.clear().beginFill(0xe2b33c, 1).drawRoundedRect(-12, -8, tip.width + 24, tip.height + 16, 6).endFill();
      const y = hot.y - tip.height - 22;
      tipWrap.position.set(Math.max(rect.x + 8, hot.x), y < rect.y ? hot.y + hot.height + 16 : y);
      tipWrap.visible = true;
    });
    zone.on("pointerout", () => { hilite.clear(); tipWrap.visible = false; });
    zone.on("pointerdown", (ev) => { if (ev.button === 0) ev.stopPropagation(); });
    zone.on("pointertap", (ev) => {
      if (ev.button !== 0) return;
      ev.stopPropagation();
      go(placeScene(p.key), !!(ev.shiftKey ?? ev.nativeEvent?.shiftKey));
    });
    layer.addChild(zone);
  }
  layer.addChild(hilite, tipWrap);
  canvas.controls.addChild(layer);
}

// ---------- кнопка «← Пеликан» на дочерних сценах ----------

let back = null;

function drawBack() {
  back?.remove();
  back = null;
  const key = tag(canvas?.scene);
  if (!game.user.isGM || !key || key === "plan") return;
  const p = PLACES.find((x) => x.key === key);
  back = document.createElement("div");
  back.id = "mm-pelican-back";
  back.innerHTML = `<button type="button" title="Открыть план у себя. Shift + клик — перенести всех.">← Пеликан</button><span>${esc(p ? sceneName(p) : canvas.scene.name)}</span>`;
  back.querySelector("button").addEventListener("click", (ev) => go(planScene(), ev.shiftKey));
  document.body.appendChild(back);
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
        create: async function () {
          const n = await createPelican();
          ui.notifications.info(n ? `Сцены «Пеликана»: создано ${n}.` : "Все сцены «Пеликана» уже есть.");
          this.render();
        },
        view: function () { planScene()?.view(); },
        activate: async function () { await planScene()?.activate(); this.render(); }
      }
    };
    async _renderHTML() {
      const plan = planScene();
      const have = PLACES.filter((p) => placeScene(p.key)).length;
      const missing = (plan ? 0 : 1) + PLACES.length - have;
      return `<section class="mm-sa">
        <h3>Сцены</h3>
        <p>План палуб: ${plan ? `«${esc(plan.name)}»${plan.active ? " — активен" : ""}` : "нет"}. Отсеки, коридор и трап: ${have} из ${PLACES.length}.</p>
        <p class="mm-sa-row"><button type="button" data-action="create" ${missing ? "" : "disabled"}>${missing ? `Создать недостающие (${missing})` : "Все сцены есть"}</button></p>
        ${plan ? `<p class="mm-sa-row"><button type="button" data-action="view">Открыть план у себя</button><button type="button" data-action="activate" ${plan.active ? "disabled" : ""}>Сделать план активным</button></p>` : ""}
        <h3>Как пользоваться</h3>
        <p>На плане — клик по номеру и названию отсека (а ещё по «Главному коридору» и «Наружному трапу»): сцена откроется у вас. Shift + клик — у всех. На сцене отсека — кнопка «← Пеликан».</p>
        <p>Задник отсека: правый клик по сцене → Configure → Background. Модуль созданные сцены не переписывает.</p>
      </section>`;
    }
    _replaceHTML(result, content) { content.innerHTML = result; }
  };
  return AdminClass;
}

export function registerPelican() {
  Hooks.once("init", () => {
    game.settings.register(MODULE_ID, "vpPelicanOffered", { scope: "world", config: false, type: Boolean, default: false });
    game.settings.registerMenu(MODULE_ID, "vpPelicanMenu", {
      name: "Восходящий поток — «Пеликан»",
      label: "Открыть",
      hint: "План палуб корабля и 13 сцен: 11 отсеков, главный коридор, наружный трап. Клик по отсеку на плане — его сцена.",
      icon: "fa-solid fa-ship",
      type: adminClass(),
      restricted: true
    });
  });

  Hooks.once("ready", async () => {
    if (game.system?.id !== SYSTEM_ID || !game.user.isGM) return;
    if (!planScene() && !setting("vpPelicanOffered", false)) {
      await game.settings.set(MODULE_ID, "vpPelicanOffered", true);
      const ok = await foundry.applications.api.DialogV2.confirm({
        window: { title: "Восходящий поток: «Пеликан»" },
        content: "<p>Создать план палуб «Пеликана» и 13 сцен (11 отсеков, главный коридор, наружный трап) в папке «Восходящий поток — «Пеликан»»?</p><p>Потом это есть в настройках модуля: «Восходящий поток — «Пеликан»».</p>"
      });
      if (ok) {
        const n = await createPelican();
        ui.notifications.info(`Сцены «Пеликана»: создано ${n}.`);
      }
    }
  });

  Hooks.on("canvasReady", () => { drawPlan(); drawBack(); });
  Hooks.on("canvasTearDown", () => { clearLayer(); back?.remove(); back = null; });
}

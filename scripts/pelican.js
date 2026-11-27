// «Пеликан» в Foundry: сцена-план палуб без сетки и стен — просто расставлять фишки (решение автора 2026-11-24).
// Ссылки с плана на отдельные сцены отсеков и сами эти сцены отменены (решение автора 2026-11-27):
// модуль их больше не создаёт, а созданные 0.5.0 предлагает удалить в своём меню.
import { PLAN } from "./pelican-data.js";

const MODULE_ID = "mymothership";
const SYSTEM_ID = "mothership-fr";
const BASE = `modules/${MODULE_ID}/assets/vp`;
const FOLDER = "Восходящий поток — «Пеликан»";
const PLAN_NAME = "«Пеликан»";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const setting = (k, fb) => { try { return game.settings.get(MODULE_ID, k); } catch { return fb; } };
const tag = (scene) => scene?.getFlag?.(MODULE_ID, "pelican") ?? null;
export const planScene = () => game.scenes?.find((s) => tag(s) === "plan") ?? null;

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
  if (todo.length) await Scene.createDocuments(todo);
  return todo.length;
}

/** Сцены отсеков, коридора и трапа из 0.5.0. */
const oldRooms = () => game.scenes?.filter((s) => { const t = tag(s); return t && t !== "plan"; }) ?? [];

async function deleteOldRooms() {
  const list = oldRooms();
  if (!list.length) return 0;
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Удалить сцены отсеков" },
    content: `<p>Удалить ${list.length} сцен(ы) отсеков, коридора и трапа из версии 0.5.0? Это нельзя отменить. Задники, если вы их ставили, останутся файлами, удалятся только сцены.</p>`
  });
  if (!ok) return 0;
  await Scene.deleteDocuments(list.map((s) => s.id));
  return list.length;
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
          ui.notifications.info(n ? "План «Пеликана» создан." : "План «Пеликана» уже есть.");
          this.render();
        },
        view: function () { planScene()?.view(); },
        activate: async function () { await planScene()?.activate(); this.render(); },
        cleanup: async function () {
          const n = await deleteOldRooms();
          if (n) ui.notifications.info(`Удалено сцен: ${n}.`);
          this.render();
        }
      }
    };
    async _renderHTML() {
      const plan = planScene();
      const old = oldRooms().length;
      return `<section class="mm-sa">
        <h3>План палуб</h3>
        <p>${plan ? `«${esc(plan.name)}»${plan.active ? " — активен" : ""}.` : "Сцены ещё нет."}</p>
        <p class="mm-sa-row">${plan
          ? `<button type="button" data-action="view">Открыть у себя</button><button type="button" data-action="activate" ${plan.active ? "disabled" : ""}>Сделать активным</button>`
          : `<button type="button" data-action="create">Создать план</button>`}</p>
        ${old ? `<h3>Старые сцены отсеков</h3><p>От версии 0.5.0 осталось ${old} сцен(ы) отсеков, коридора и трапа — они больше не нужны.</p><p class="mm-sa-row"><button type="button" data-action="cleanup">Удалить их</button></p>` : ""}
        <h3>Марионетки</h3>
        <p>Правый клик по токену экипажа → кнопка с пауком в HUD: токен становится марионеткой и обратно. У Теда марионетки нет.</p>
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
      hint: "План палуб корабля для фишек; удаление старых сцен отсеков из 0.5.0; марионетки.",
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
        content: "<p>Создать сцену «Пеликан» — план палуб корабля, чтобы расставлять фишки?</p><p>Потом это есть в настройках модуля: «Восходящий поток — «Пеликан»».</p>"
      });
      if (ok) await createPelican();
    }
  });

}

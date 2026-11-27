// Экран начала «Восходящего потока»: сцена с отметкой модуля + HTML-слой 1920×1080 по макету
// (холст «Восходящий поток — экран начала»), устроен как холл Надграда.
// Галерея «Роль» — ссылки на листы экипажа; смотритель включает плейлист «Вступление» из шапки.
// Слайдов вступления нет: смотритель рассказывает голосом (решение автора 2026-11-23).
import { STAGE, fitStage, ageText, takenMap, sameMap } from "./start-logic.js";
import { SHIP_SVG } from "./start-ship.js";

const MODULE_ID = "mymothership";
const SYSTEM_ID = "mothership-fr";
const BASE = `modules/${MODULE_ID}/assets/vp`;
const PACK = `${MODULE_ID}.vp-crew`;
const FOLDER = "Восходящий поток — экипаж";
const SCENE_NAME = "Восходящий поток — начало";
const PLAYLIST = "Вступление";

let crew = [];
let root = null;
let timer = null;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const setting = (k, fb) => { try { return game.settings.get(MODULE_ID, k); } catch { return fb; } };
const isStart = (scene) => !!scene?.getFlag?.(MODULE_ID, "start");
export const startScene = () => game.scenes?.find((s) => isStart(s)) ?? null;
const crewBySlug = (slug) => crew.find((c) => c.slug === slug);
const crewActor = (slug) => game.actors?.find((a) => a.getFlag(MODULE_ID, "crew") === slug) ?? null;

async function loadData() {
  const get = async (f) => {
    try { return await foundry.utils.fetchJsonWithTimeout(foundry.utils.getRoute(`${BASE}/${f}`)); }
    catch (err) { console.warn(`MyMothership | не прочитан ${f}`, err); return null; }
  };
  crew = (await get("crew.json"))?.crew ?? [];
}

// ---------- экипаж в мире ----------

async function crewFolder() {
  return game.folders.find((f) => f.type === "Actor" && f.name === FOLDER)
    ?? Folder.create({ name: FOLDER, type: "Actor", color: "#1f6f6a" });
}

/** Смотритель: актёр из компендиума в мир (один раз, с тем же id). */
async function ensureActor(c) {
  const have = crewActor(c.slug);
  if (have || !game.user.isGM) return have;
  const pack = game.packs.get(PACK);
  if (!pack) { ui.notifications.error("MyMothership: не найден компендиум «Восходящий поток — экипаж»."); return null; }
  const folder = await crewFolder();
  return game.actors.importFromCompendium(pack, c.actorId, { folder: folder.id }, { keepId: true });
}

/** Весь экипаж в мире (без уведомлений): Map slug → актёр. Для сцены корабля. */
export async function ensureAllCrew() {
  if (!crew.length) await loadData();
  const out = new Map();
  for (const c of crew) {
    const a = crewActor(c.slug) ?? await ensureActor(c);
    if (a) out.set(c.slug, a);
  }
  return out;
}

async function importAll() {
  let n = 0;
  for (const c of crew) if (!crewActor(c.slug) && await ensureActor(c)) n += 1;
  ui.notifications.info(n ? `Экипаж в мире: добавлено ${n}.` : "Весь экипаж уже в мире.");
}

/** Кто занят — считает смотритель и хранит в настройке мира: игрокам чужие актёры не видны. */
let takenTimer = null;
function recalcTaken() {
  if (!game.user.isGM) return;
  clearTimeout(takenTimer);
  takenTimer = setTimeout(async () => {
    const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    const actors = crew.map((c) => {
      const a = crewActor(c.slug);
      if (!a) return { slug: c.slug, ownerIds: [] };
      const ownerIds = Object.entries(a.ownership ?? {}).filter(([id, lvl]) => id !== "default" && lvl >= OWNER).map(([id]) => id);
      return { slug: c.slug, ownerIds };
    });
    const users = game.users.contents.map((u) => ({
      id: u.id, name: u.name, isGM: u.isGM, characterSlug: u.character?.getFlag(MODULE_ID, "crew") ?? null
    }));
    const next = takenMap(actors, users);
    if (!sameMap(next, setting("vpTaken", {}))) await game.settings.set(MODULE_ID, "vpTaken", next);
  }, 200);
}

async function openCrew(slug) {
  const c = crewBySlug(slug);
  if (!c) return;
  const actor = crewActor(slug);
  if (actor?.testUserPermission(game.user, "OBSERVER")) return actor.sheet.render(true);
  if (game.user.isGM) return (await ensureActor(c))?.sheet.render(true);
  return previewCrew(c);
}

/** Игроку без доступа к листу — то, что видно со стороны. */
function previewCrew(c) {
  const meta = [c.job, c.cls, ageText(c.age)].filter(Boolean).map(esc).join(" · ");
  const marks = [c.npc ? "Персонаж смотрителя" : "", c.company ? "Компания" : ""].filter(Boolean);
  return foundry.applications.api.DialogV2.prompt({
    window: { title: c.name },
    classes: ["mm-start-preview"],
    position: { width: 560 },
    content: `<div class="mm-p">
      <img src="${esc(c.portrait)}" alt="">
      <div class="mm-p-text">
        <p class="mm-p-meta">${meta}</p>
        ${marks.map((m) => `<span class="mm-p-mark ${m === "Компания" ? "is-company" : "is-npc"}">${esc(m)}</span>`).join(" ")}
        ${c.preview}
      </div>
    </div>`,
    ok: { label: "Закрыть" },
    rejectClose: false
  });
}

async function giveCrew(slug) {
  if (!game.user.isGM) return;
  const c = crewBySlug(slug);
  const players = game.users.filter((u) => !u.isGM);
  if (!players.length) return ui.notifications.warn("В мире нет игроков — некому отдать персонажа.");
  const userId = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Отдать игроку: ${c.name}` },
    content: `<div class="form-group"><label>Игрок</label><select name="user">${players.map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join("")}</select></div>
      <p class="hint">Игрок станет владельцем листа; если у него ещё нет персонажа — этот станет его персонажем.</p>`,
    ok: { label: "Отдать", callback: (event, button) => button.form.elements.user.value },
    rejectClose: false
  });
  if (!userId) return;
  const actor = await ensureActor(c);
  const user = game.users.get(userId);
  if (!actor || !user) return;
  await actor.update({ [`ownership.${userId}`]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER });
  if (!user.character) await user.update({ character: actor.id });
  recalcTaken();
}

// ---------- музыка: плейлист «Вступление» ----------

const introPlaylist = () =>
  game.playlists?.getName?.(PLAYLIST) ?? game.playlists?.find((p) => p.name.trim().toLowerCase() === PLAYLIST.toLowerCase()) ?? null;

async function musicAction(kind) {
  const pl = introPlaylist();
  if (!pl || !(game.user.isGM || pl.isOwner)) return;
  if (kind === "toggle") return pl.playing ? pl.stopAll() : pl.playAll();
  if (!pl.sounds.size) return;
  const ordered = pl.playbackOrder?.length ? pl.playbackOrder : pl.sounds.contents.map((x) => x.id);
  const cur = pl.sounds.find((x) => x.playing)?.id;
  const i = cur ? ordered.indexOf(cur) : -1;
  const dir = kind === "next" ? 1 : -1;
  const nextId = ordered[((i < 0 ? (dir > 0 ? -1 : 0) : i) + dir + ordered.length) % ordered.length];
  return pl.playSound(pl.sounds.get(nextId));
}

// ---------- слой ----------

export function freeArea() {
  const W = window.innerWidth, H = window.innerHeight;
  const area = { left: 0, top: 0, right: W, bottom: H };
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return b.width && b.height ? b : null; };
  const left = r("#ui-left") ?? r("#controls");
  if (left && left.right < W * 0.4) area.left = left.right;
  const right = r("#sidebar") ?? r("#ui-right");
  if (right && right.left > W * 0.6) area.right = right.left;
  const hotbar = r("#hotbar");
  if (hotbar && hotbar.top > H * 0.6) area.bottom = hotbar.top;
  const nav = r("#navigation") ?? r("#scene-navigation");
  if (nav && nav.bottom < H * 0.3 && nav.left < W / 2 && nav.right > area.left + 40 && nav.width > W * 0.3) area.top = nav.bottom;
  const pad = 8;
  return { left: area.left + pad, top: area.top + pad, right: area.right - pad, bottom: area.bottom - pad };
}

function mount() {
  if (root?.isConnected) return root;
  root = document.createElement("div");
  root.id = "mm-start";
  root.setAttribute("aria-label", "Экран начала");
  const ui = document.getElementById("interface");
  const board = document.getElementById("board");
  const zi = parseInt(ui ? getComputedStyle(ui).zIndex : "", 10);
  const zb = parseInt(board ? getComputedStyle(board).zIndex : "", 10);
  root.style.zIndex = String(Number.isFinite(zi) ? zi : (Number.isFinite(zb) ? zb : 0) + 1);
  if (ui?.parentElement) ui.parentElement.insertBefore(root, ui);
  else document.body.appendChild(root);
  root.addEventListener("click", onClick);
  root.addEventListener("wheel", (e) => { if (e.target.closest(".mm-s-stage")) { e.preventDefault(); e.stopPropagation(); } }, { passive: false });
  return root;
}

function unmount() { root?.remove(); root = null; }

const ICON = {
  note: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  prev: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 20 9 12l10-8v16z"/><path d="M5 19V5"/></svg>`,
  play: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4l14 8-14 8V4z"/></svg>`,
  stop: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14"/></svg>`,
  next: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 4 10 8-10 8V4z"/><path d="M19 5v14"/></svg>`
};

function playerHtml(isGM) {
  const pl = introPlaylist();
  const track = pl?.sounds?.find((x) => x.playing)?.name ?? "";
  const can = !!pl && (isGM || pl.isOwner);
  return `<div class="mm-s-player">
    <span class="mm-s-player-icon">${ICON.note}</span>
    <span class="mm-s-player-name">${esc(PLAYLIST)}</span>
    <span class="mm-s-player-track">${esc(track || (pl ? "тишина" : "нет плейлиста"))}</span>
    ${can ? `<span class="mm-s-player-btns mm-s-gm">
      <button type="button" data-start="music" data-kind="prev" aria-label="Предыдущий трек">${ICON.prev}</button>
      <button type="button" class="is-main" data-start="music" data-kind="toggle" aria-label="${pl.playing ? "Остановить" : "Играть"}">${pl.playing ? ICON.stop : ICON.play}</button>
      <button type="button" data-start="music" data-kind="next" aria-label="Следующий трек">${ICON.next}</button>
    </span>` : ""}
  </div>`;
}

function cardHtml(c, taken, isGM) {
  const player = taken[c.slug];
  const age = ageText(c.age);
  const bands = [
    player ? `<span class="mm-s-band is-taken">Занят · ${esc(player)}</span>` : "",
    c.company ? `<span class="mm-s-band is-company">Компания</span>` : "",
    c.npc ? `<span class="mm-s-band is-npc">Персонаж смотрителя</span>` : ""
  ].join("");
  const label = [c.name, c.job.toLowerCase(), c.npc ? "персонаж смотрителя" : "", c.company ? "подчиняется Компании" : "", player ? `занят: ${player}` : ""].filter(Boolean).join(", ");
  return `<div class="mm-s-card">
    <button type="button" class="mm-s-open" data-start="open" data-slug="${esc(c.slug)}" aria-label="${esc(label)} — открыть лист">
      <span class="mm-s-photo">
        <img src="${esc(c.portrait)}" alt="">
        ${age ? `<span class="mm-s-age">${esc(age)}</span>` : ""}
        <span class="mm-s-bands">${bands}</span>
      </span>
      <span class="mm-s-text">
        <span class="mm-s-name">${esc(c.name)}</span>
        <span class="mm-s-job">${esc(c.job)}</span>
        ${c.cls ? `<span class="mm-s-cls">${esc(c.cls)}</span>` : ""}
      </span>
    </button>
    ${isGM && !player && !c.npc ? `<button type="button" class="mm-s-give mm-s-gm" data-start="give" data-slug="${esc(c.slug)}">Отдать игроку</button>` : ""}
  </div>`;
}

function stageHtml() {
  const isGM = game.user.isGM;
  const taken = setting("vpTaken", {}) ?? {};
  const l = fitStage(freeArea(), STAGE);
  return `<div class="mm-s-stage" style="transform: scale(${l.scale}); left: ${l.left}px; top: ${l.top}px">
    <img class="mm-s-bg" src="${BASE}/start/giant.webp" alt="Бирюзово-зеленый газовый гигант с кольцом и маленькой луной">
    <div class="mm-s-dim-left"></div><div class="mm-s-dim-bottom"></div>
    <div class="mm-s-hazard"></div>

    <header class="mm-s-head">
      <span></span>
      <span class="mm-s-head-right">
        ${playerHtml(isGM)}
        ${isGM ? `<button type="button" class="mm-s-gear mm-s-gm" data-start="admin" aria-label="Настройки экрана начала"><i class="fa-solid fa-gear"></i></button>` : ""}
      </span>
    </header>

    <section class="mm-s-title">
      <p class="mm-s-kicker">Mothership 1e · ваншот</p>
      <h1>Восходящий<br>поток</h1>
      <p class="mm-s-hook">Двенадцать человек экипажа, облака газового гиганта и решения, за которые никто не захочет отвечать.</p>
    </section>

    <aside class="mm-s-passport">
      <div class="mm-s-hazard-thin"></div>
      <div class="mm-s-passport-body">
        <h2>Судовой паспорт</h2>
        <div class="mm-s-ship">${SHIP_SVG}</div>
        <dl>
          <dt>Судно</dt><dd>«Пеликан» [МПАД-7/12]</dd>
          <dt>Приписка</dt><dd>станция «Приемная-2»</dd>
          <dt>Планета</dt><dd>«Четырнадцатая» [KG-414]</dd>
          <dt>Груз</dt><dd>водород, гелий-3</dd>
          <dt>Экипаж</dt><dd>12 человек</dd>
          <dt>Капитан</dt><dd>Аугусто Ферро</dd>
        </dl>
        <div class="mm-s-quota">
          <span class="mm-s-quota-label">Квота рейса</span><span class="mm-s-quota-num">92 %</span>
          <div class="mm-s-quota-bar"><div style="width: 92%"></div></div>
        </div>
      </div>
    </aside>

    <section class="mm-s-roll" aria-label="Роль">
      <h2>Роль</h2>
      <div class="mm-s-grid">${crew.map((c) => cardHtml(c, taken, isGM)).join("")}</div>
    </section>

  </div>`;
}

/** Для тестов: подставить данные без загрузки и получить разметку слоя. */
export const _test = { setData: (c) => { crew = c; }, stageHtml: () => stageHtml() };

async function render() {
  if (game.system?.id !== SYSTEM_ID || !isStart(canvas?.scene)) return unmount();
  const el = mount();
  el.innerHTML = stageHtml();
}

export function refresh() {
  clearTimeout(timer);
  timer = setTimeout(() => render().catch((err) => console.error("MyMothership | экран начала", err)), 60);
}

function relayout() {
  const stage = root?.querySelector(".mm-s-stage");
  if (!stage) return;
  const l = fitStage(freeArea(), STAGE);
  stage.style.transform = `scale(${l.scale})`;
  stage.style.left = `${l.left}px`;
  stage.style.top = `${l.top}px`;
}

async function onClick(event) {
  const btn = event.target.closest("[data-start]");
  if (!btn || btn.disabled) return;
  event.preventDefault();
  const slug = btn.dataset.slug;
  switch (btn.dataset.start) {
    case "open": return openCrew(slug);
    case "give": return giveCrew(slug);
    case "music": return musicAction(btn.dataset.kind);
    case "admin": {
      const open = foundry.applications.instances?.get("mm-start-admin");
      return open ? open.render({ force: true }) : new (adminClass())().render({ force: true });
    }
  }
}

// ---------- сцена и настройки ----------

export async function createStart() {
  if (!game.user.isGM) return null;
  let scene = startScene();
  if (!scene) {
    scene = await Scene.create({
      name: SCENE_NAME,
      navName: "Начало",
      navigation: true,
      width: STAGE.w, height: STAGE.h, padding: 0,
      backgroundColor: "#040706",
      background: { src: `${BASE}/start/giant.webp` },
      grid: { type: CONST.GRID_TYPES.GRIDLESS },
      tokenVision: false,
      fog: { exploration: false },
      flags: { [MODULE_ID]: { start: true } }
    });
  }
  await scene.activate();
  ui.notifications.info("Экран начала готов и стал активной сценой.");
  return scene;
}

let AdminClass = null;
function adminClass() {
  if (AdminClass) return AdminClass;
  const { ApplicationV2 } = foundry.applications.api;
  AdminClass = class StartAdmin extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: "mm-start-admin",
      classes: ["mm-start-admin"],
      window: { title: "Восходящий поток — экран начала", icon: "fa-solid fa-rocket" },
      position: { width: 460 },
      actions: {
        create: async function () { await createStart(); this.render(); },
        view: function () { startScene()?.view(); },
        activate: async function () { await startScene()?.activate(); this.render(); },
        crew: async function () { await importAll(); this.render(); }
      }
    };
    async _renderHTML() {
      const scene = startScene();
      const inWorld = crew.filter((c) => crewActor(c.slug)).length;
      const pl = introPlaylist();
      return `<section class="mm-sa">
        <h3>Сцена</h3>
        ${scene
          ? `<p>«${esc(scene.name)}»${scene.active ? " — активна." : "."}</p>
             <p class="mm-sa-row"><button type="button" data-action="view">Открыть у себя</button><button type="button" data-action="activate" ${scene.active ? "disabled" : ""}>Сделать активной</button></p>`
          : `<p>Сцены ещё нет.</p><p class="mm-sa-row"><button type="button" data-action="create">Создать и сделать активной</button></p>`}
        <h3>Экипаж</h3>
        <p>В мире ${inWorld} из ${crew.length}. Остальных модуль добавит из компендиума, когда вы откроете их карточку или отдадите игроку.</p>
        <p class="mm-sa-row"><button type="button" data-action="crew" ${inWorld === crew.length ? "disabled" : ""}>Добавить весь экипаж в мир</button></p>
        <h3>Музыка</h3>
        <p>${pl ? `Плейлист «${esc(pl.name)}»: треков ${pl.sounds.size}. Кнопки — в шапке экрана.` : `Плейлиста «${esc(PLAYLIST)}» нет — создайте его (можно загрузить целую папку), и в шапке экрана появятся кнопки музыки.`}</p>
      </section>`;
    }
    _replaceHTML(result, content) { content.innerHTML = result; }
  };
  return AdminClass;
}

export function registerStartScreen() {
  Hooks.once("init", () => {
    game.settings.register(MODULE_ID, "vpTaken", { scope: "world", config: false, type: Object, default: {}, onChange: () => refresh() });
    game.settings.register(MODULE_ID, "vpStartOffered", { scope: "world", config: false, type: Boolean, default: false });
    game.settings.registerMenu(MODULE_ID, "vpStartMenu", {
      name: "Восходящий поток — экран начала",
      label: "Открыть",
      hint: "Стартовая сцена ваншота: название, судовой паспорт, галерея экипажа со ссылками на листы, музыка «Вступление».",
      icon: "fa-solid fa-rocket",
      type: adminClass(),
      restricted: true
    });
  });

  Hooks.once("ready", async () => {
    if (game.system?.id !== SYSTEM_ID) return;
    await loadData();
    if (game.user.isGM) {
      recalcTaken();
      if (!startScene() && !setting("vpStartOffered", false)) {
        await game.settings.set(MODULE_ID, "vpStartOffered", true);
        const ok = await foundry.applications.api.DialogV2.confirm({
          window: { title: "Восходящий поток: экран начала" },
          content: "<p>Создать сцену-экран начала — название, судовой паспорт «Пеликана», галерея экипажа — и сделать её активной?</p><p>Потом это есть в настройках модуля: «Восходящий поток — экран начала».</p>"
        });
        if (ok) await createStart();
      }
    }
    refresh();
  });

  Hooks.on("canvasReady", () => refresh());
  Hooks.on("updateScene", (scene, change) => { if (scene.id === canvas?.scene?.id || foundry.utils.hasProperty(change, `flags.${MODULE_ID}`)) refresh(); });
  for (const h of ["createPlaylist", "updatePlaylist", "deletePlaylist", "createPlaylistSound", "updatePlaylistSound", "deletePlaylistSound"]) {
    Hooks.on(h, () => { if (root) refresh(); });
  }
  for (const h of ["createActor", "updateActor", "deleteActor", "updateUser"]) {
    Hooks.on(h, () => { recalcTaken(); if (root) refresh(); });
  }
  Hooks.on("collapseSidebar", () => setTimeout(relayout, 250));
  Hooks.on("renderSceneNavigation", () => setTimeout(relayout, 50));
  Hooks.once("ready", () => window.addEventListener("resize", () => relayout()));
}

// Крупный портрет при наведении на токен — как в Надграде (крупный арт при наведении), но в левом нижнем
// углу свободной области экрана (автор, 2026-11-28). Токен-марионетка показывает портрет-марионетку.
// Отключается в настройках клиента: «Крупный портрет при наведении на токен».
import { parseSrc } from "./puppet.js";
import { freeArea } from "./start-screen.js";

const MODULE_ID = "mymothership";
const BASE = `modules/${MODULE_ID}/assets/vp`;

/** Какую картинку показать: портрет-марионетка → портрет актёра → картинка токена. */
export function portraitFor({ tokenSrc, actorImg }) {
  const who = parseSrc(tokenSrc);
  if (who?.puppet) return `${BASE}/portraits/puppet/${who.name}.webp`;
  if (actorImg && !/mystery-man|icons\/svg\//.test(actorImg)) return actorImg;
  return tokenSrc || "";
}

let box = null;
let current = null;

function hoverBox() {
  if (box?.isConnected) return box;
  box = document.createElement("div");
  box.id = "mm-hover";
  box.setAttribute("aria-hidden", "true");
  box.innerHTML = "<img alt=\"\"><span></span>";
  document.body.appendChild(box);
  return box;
}

function show(token) {
  const src = portraitFor({ tokenSrc: token.document?.texture?.src, actorImg: token.actor?.img });
  if (!src) return hide();
  const el = hoverBox();
  const area = freeArea();
  const H = Math.round(Math.min(window.innerHeight * 0.55, 620));
  const img = el.querySelector("img");
  if (img.getAttribute("src") !== src) img.src = src;
  el.querySelector("span").textContent = token.name ?? "";
  el.style.height = `${H}px`;
  el.style.left = `${Math.round(area.left)}px`;
  el.style.bottom = `${Math.round(window.innerHeight - area.bottom)}px`;
  el.classList.add("on");
  current = token;
}

function hide() {
  current = null;
  box?.classList.remove("on");
}

const enabled = () => { try { return game.settings.get(MODULE_ID, "hoverPortrait"); } catch { return true; } };

export function registerHover() {
  Hooks.once("init", () => {
    game.settings.register(MODULE_ID, "hoverPortrait", {
      name: "Крупный портрет при наведении на токен",
      hint: "Наведите мышь на токен — в левом нижнем углу появится крупный портрет персонажа (марионетка — искажённый).",
      scope: "client", config: true, type: Boolean, default: true,
      onChange: (v) => { if (!v) hide(); }
    });
  });
  Hooks.on("hoverToken", (token, hovered) => {
    if (!enabled()) return;
    if (hovered) show(token);
    else if (current === token) hide();
  });
  Hooks.on("updateToken", (doc) => { if (current?.document === doc) show(current); });
  Hooks.on("deleteToken", (doc) => { if (current?.document === doc) hide(); });
  Hooks.on("canvasTearDown", () => hide());
}

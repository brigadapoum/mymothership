// Токены-марионетки «Восходящего потока»: у смотрителя в HUD токена кнопка «Марионетка» —
// меняет картинку токена на искажённую (нити, сдвиги строк, красное кольцо) и обратно.
// Картинки — assets/vp/tokens/puppet/<имя>.webp (tools/puppets.py). Теда не едят — марионетки нет.

const MODULE_ID = "mymothership";
const BASE = `modules/${MODULE_ID}/assets/vp/tokens`;
export const PUPPETS = ["ferro", "haddad", "holm", "kovalchik", "kruger", "lahti", "okafor", "oke", "otieno", "tanabe", "vargo"];

const RE = /assets\/vp\/tokens\/(puppet\/)?([a-z]+)\.webp$/;

/** Чья это картинка и марионетка ли она: { name, puppet } или null. */
export function parseSrc(src) {
  const m = RE.exec(String(src ?? ""));
  if (!m || !PUPPETS.includes(m[2])) return null;
  return { name: m[2], puppet: !!m[1] };
}

export const puppetSrc = (name) => `${BASE}/puppet/${name}.webp`;
export const normalSrc = (name) => `${BASE}/${name}.webp`;

function whoIs(token) {
  return parseSrc(token.texture?.src) ?? parseSrc(token.actor?.prototypeToken?.texture?.src);
}

async function toggle(token) {
  const who = whoIs(token);
  if (!who) return ui.notifications.warn("MyMothership: у этого токена нет марионетки.");
  const now = parseSrc(token.texture?.src);
  const toPuppet = !(now?.puppet);
  await token.update({ "texture.src": toPuppet ? puppetSrc(who.name) : normalSrc(who.name) });
}

export function registerPuppets() {
  Hooks.on("renderTokenHUD", (hud, html) => {
    if (!game.user.isGM) return;
    const token = hud.document ?? hud.object?.document;
    if (!token || !whoIs(token)) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    const col = root?.querySelector(".col.right") ?? root?.querySelector(".col.left");
    if (!col) return;
    const on = !!parseSrc(token.texture?.src)?.puppet;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `control-icon mm-puppet${on ? " active" : ""}`;
    btn.dataset.tooltip = on ? "Вернуть обычный токен" : "Марионетка";
    btn.setAttribute("aria-label", btn.dataset.tooltip);
    btn.innerHTML = `<i class="fa-solid fa-spider"></i>`;
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      await toggle(token);
      hud.render?.();
    });
    col.appendChild(btn);
  });
}

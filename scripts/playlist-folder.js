// Опция MyMothership: загрузить в плейлист сразу всю папку с музыкой
// (из хранилища Sqyre или любого другого, которое видит окно выбора файлов Foundry).

const AUDIO_RE = /\.(mp3|ogg|oga|opus|wav|flac|webm|m4a|aac)$/i;

export function isAudioPath(path) {
  return AUDIO_RE.test(String(path).split("?")[0]);
}

// «music/01_Gas%20Giant.mp3» → «01 Gas Giant»
export function soundNameFromPath(path) {
  const file = String(path).split("?")[0].split("/").pop() ?? "";
  let name = file.replace(/\.[^.]+$/, "");
  try { name = decodeURIComponent(name); } catch (err) { /* оставляем как есть */ }
  return name.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim() || file;
}

// Новые звуки: только аудиофайлы, которых ещё нет в плейлисте, по алфавиту.
export function planNewSounds(files, existingPaths) {
  const have = new Set(existingPaths);
  return files
    .filter((p) => isAudioPath(p) && !have.has(p))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((path) => ({ name: soundNameFromPath(path), path, volume: 0.5, repeat: false }));
}

function filePickerClass() {
  return foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
}

async function importFolder(playlist, source, target, bucket) {
  const FP = filePickerClass();
  const options = bucket ? { bucket } : {};
  let result;
  try {
    result = await FP.browse(source, target, options);
  } catch (err) {
    console.error("MyMothership | не удалось открыть папку", err);
    ui.notifications.error(`MyMothership: не удалось открыть папку «${target}».`);
    return;
  }
  const existing = playlist.sounds.map((s) => s.path);
  const sounds = planNewSounds(result.files ?? [], existing);
  if (!sounds.length) {
    ui.notifications.warn(`MyMothership: в папке «${target}» нет новых аудиофайлов.`);
    return;
  }
  await playlist.createEmbeddedDocuments("PlaylistSound", sounds);
  ui.notifications.info(`MyMothership: в плейлист «${playlist.name}» добавлено ${sounds.length} треков.`);
}

export function pickFolderFor(playlist) {
  if (!playlist) return;
  const FP = filePickerClass();
  const picker = new FP({
    type: "folder",
    callback: (path, fp) => {
      const p = fp ?? picker;
      importFolder(playlist, p.activeSource ?? "data", path, p.source?.bucket ?? p.sources?.[p.activeSource]?.bucket);
    }
  });
  picker.render(true);
}

function playlistFromEntry(li) {
  const el = li?.[0] ?? li;
  const id = el?.dataset?.entryId ?? el?.dataset?.documentId;
  return id ? game.playlists.get(id) : null;
}

export function registerPlaylistFolder(isEnabled) {
  // Пункт в меню плейлиста (правый клик в списке плейлистов).
  const addOption = (app, options) => {
    if (!isEnabled() || !game.user.isGM) return;
    options.push({
      name: "Загрузить папку…",
      icon: '<i class="fa-solid fa-folder-open"></i>',
      callback: (li) => pickFolderFor(playlistFromEntry(li))
    });
  };
  Hooks.on("getPlaylistContextOptions", addOption);        // Foundry 13
  Hooks.on("getPlaylistDirectoryEntryContext", addOption); // Foundry 12 и раньше

  // Кнопка в окне настроек плейлиста, рядом с «Update Playlist».
  Hooks.on("renderPlaylistConfig", (app, html) => {
    if (!isEnabled() || !game.user.isGM) return;
    const root = html?.[0] ?? html;
    if (!root?.querySelector || root.querySelector(".mymothership-folder-import")) return;
    const footer = root.querySelector("footer, .form-footer, .sheet-footer");
    if (!footer) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mymothership-folder-import";
    button.innerHTML = '<i class="fa-solid fa-folder-open"></i> Загрузить папку';
    button.addEventListener("click", (event) => {
      event.preventDefault();
      pickFolderFor(app.document ?? app.object);
    });
    footer.prepend(button);
  });
}

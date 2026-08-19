import { loadWorkspace, saveWorkspace } from "./database.js";
import {
  buildEdgePath,
  buildFreehandPath,
  formatBytes,
  nodeDimensions,
  normalizeWebUrl,
  parseMapLocation,
  readableInk,
  youtubeId,
} from "./item-utils.js";
const $ = (s) => document.querySelector(s),
  $$ = (s, root = document) => [...root.querySelectorAll(s)];
const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const COLORS = [
  null,
  "#fff0a8",
  "#ffd5c7",
  "#d9edc5",
  "#cde7f5",
  "#ddd6fa",
  "#f8d7ec",
  "#f6c3a5",
  "#bfe4dc",
  "#bfd0f2",
  "#e6c3a8",
  "#d8d8d8",
];
const THEMES = {
  light: {
    canvasColor: "#fbf8f0",
    patternColor: "#d8d1c3",
    textColor: "#302e29",
    arrowColor: "#6d685f",
  },
  dark: {
    canvasColor: "#17191d",
    patternColor: "#343840",
    textColor: "#ffffff",
    arrowColor: "#adb6c8",
  },
  sage: {
    canvasColor: "#eef3e8",
    patternColor: "#c7d2bd",
    textColor: "#263226",
    arrowColor: "#61705c",
  },
  rose: {
    canvasColor: "#f8ecee",
    patternColor: "#e4c7cc",
    textColor: "#3d292e",
    arrowColor: "#8b626a",
  },
  lavender: {
    canvasColor: "#f1edf8",
    patternColor: "#d5c9e6",
    textColor: "#30283e",
    arrowColor: "#77658e",
  },
  sky: {
    canvasColor: "#eaf3f8",
    patternColor: "#c3d9e5",
    textColor: "#23333d",
    arrowColor: "#587888",
  },
  peach: {
    canvasColor: "#fff0e5",
    patternColor: "#e8cdb9",
    textColor: "#3c2d24",
    arrowColor: "#8b6a54",
  },
};
const defaults = {
  canvasColor: "#fbf8f0",
  patternColor: "#d8d1c3",
  pattern: "dots",
  spacing: 24,
  arrowColor: "#6d685f",
  textColor: "#302e29",
  theme: "light",
  itemStyles: {
    text: "soft",
    image: "glass",
    youtube: "outline",
    file: "note",
    website: "outline",
    map: "glass",
    music: "soft",
    recording: "soft",
  },
};
const initialMap = () => ({
  id: uid(),
  title: "İlk Haritam",
  appearance: { ...defaults, itemStyles: { ...defaults.itemStyles } },
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [
    {
      id: uid(),
      type: "text",
      style: "soft",
      title: "Ana fikir",
      x: 340,
      y: 220,
      color: COLORS[1],
      note: "Buraya notlarını yazabilirsin.",
      tags: [],
    },
  ],
  edges: [],
});
let state = { version: 1, activeMapId: null, maps: [] },
  selectedNodeId = null,
  selectedEdgeId = null,
  history = [],
  future = [],
  saveTimer,
  drag = null,
  connect = null,
  freehandDrawing = null,
  connectionMode = "auto",
  suppressConnectorClick = false,
  pan = null,
  resize = null,
  pendingItemPosition = null,
  activeTitleEditor = null,
  savedTitleRange = null,
  audioRecorder = null,
  recordingStream = null,
  recordingDataUrl = null,
  recordingDuration = 0,
  recordingStartedAt = 0,
  recordingTimer = null,
  edgeFrame = null,
  renderedMap = null,
  suppressNodeClick = null,
  pinch = null,
  itemSettingsSection = null,
  itemSettingsDirty = false;
const touchPoints = new Map();
const canvas = $("#canvas"),
  nodeLayer = $("#node-layer"),
  edgeRoot = $("#viewport-edges");
const map = () => state.maps.find((m) => m.id === state.activeMapId);
function snapshot() {
  history.push(JSON.stringify(state));
  if (history.length > 60) history.shift();
  future = [];
}
function restore(raw) {
  future.push(JSON.stringify(state));
  state = JSON.parse(raw);
  selectedNodeId = selectedEdgeId = null;
  renderAll();
  scheduleSave();
}
function scheduleSave() {
  clearTimeout(saveTimer);
  $("#save-state").classList.add("saving");
  $("#save-state").lastChild.textContent = " Kaydediliyor…";
  saveTimer = setTimeout(async () => {
    try {
      await saveWorkspace(state);
      $("#save-state").classList.remove("saving");
      $("#save-state").lastChild.textContent = " Kaydedildi";
    } catch {
      $("#save-state").lastChild.textContent = " Kayıt başarısız";
    }
  }, 350);
}
function currentTransform() {
  const v = map().viewport;
  return `translate(${v.x}px,${v.y}px) scale(${v.zoom})`;
}
function renderViewport() {
  nodeLayer.style.transform = currentTransform();
  $("#zoom-value").textContent = `${Math.round(map().viewport.zoom * 100)}%`;
  scheduleEdgeRender();
}
function scheduleEdgeRender() {
  if (edgeFrame) return;
  edgeFrame = requestAnimationFrame(() => {
    edgeFrame = null;
    renderEdges();
  });
}
function screenToWorld(clientX, clientY) {
  const r = canvas.getBoundingClientRect(),
    v = map().viewport;
  return {
    x: (clientX - r.left - v.x) / v.zoom,
    y: (clientY - r.top - v.y) / v.zoom,
  };
}
function renderAll() {
  renderMaps();
  renderAppearance();
  renderSettings();
  renderNodes();
  renderEdges();
  renderNote();
  $("#map-title").value = map().title;
  $("#zoom-value").textContent = `${Math.round(map().viewport.zoom * 100)}%`;
  $("#undo-btn").disabled = !history.length;
  $("#redo-btn").disabled = !future.length;
}
function renderMaps() {
  $("#map-list").innerHTML = "";
  state.maps.forEach((m) => {
    const b = document.createElement("button");
    b.className = `map-item ${m.id === state.activeMapId ? "active" : ""}`;
    b.textContent = m.title;
    b.onclick = () => {
      state.activeMapId = m.id;
      selectedNodeId = selectedEdgeId = null;
      closeSidebar();
      renderAll();
      scheduleSave();
    };
    $("#map-list").append(b);
  });
}
function renderAppearance() {
  const a = map().appearance;
  a.itemStyles ||= structuredClone(defaults.itemStyles);
  canvas.className = `canvas pattern-${a.pattern}`;
  canvas.style.setProperty("--canvas", a.canvasColor);
  canvas.style.setProperty("--pattern", a.patternColor);
  canvas.style.setProperty("--spacing", `${a.spacing}px`);
  canvas.style.setProperty("--arrow", a.arrowColor);
  canvas.style.setProperty(
    "--canvas-ink",
    a.textColor || readableInk(a.canvasColor),
  );
  const toolbarInk = readableInk(a.canvasColor);
  document.documentElement.style.setProperty("--toolbar-ink", toolbarInk);
  document.documentElement.style.setProperty(
    "--toolbar-on-ink",
    toolbarInk === "#fffdf8" ? "#292722" : "#fffdf8",
  );
  document.documentElement.style.setProperty(
    "--toolbar-hover",
    toolbarInk === "#fffdf8" ? "rgba(255,255,255,.14)" : "rgba(48,46,41,.09)",
  );
  $("#canvas-color").value = a.canvasColor;
  $("#pattern-color").value = a.patternColor;
  $("#pattern-spacing").value = a.spacing;
  $("#spacing-output").value = `${a.spacing}px`;
  $("#arrow-color").value = a.arrowColor;
  $$("#theme-presets button").forEach((button) =>
    button.classList.toggle("active", button.dataset.theme === a.theme),
  );
  $$("#pattern-options button").forEach((b) =>
    b.classList.toggle("active", b.dataset.pattern === a.pattern),
  );
}
function renderSettings() {
  const styles = map().appearance.itemStyles || defaults.itemStyles;
  $$("[data-style-group]").forEach((select) => {
    select.value = styles[select.dataset.styleGroup] || "soft";
  });
}
function renderNodes() {
  nodeLayer.style.transform = currentTransform();
  const activeMap = map();
  if (renderedMap !== activeMap) {
    nodeLayer.innerHTML = "";
    renderedMap = activeMap;
  }
  const existing = new Map(
    $$(".mind-node", nodeLayer).map((element) => [element.dataset.id, element]),
  );
  const visibleIds = new Set();
  activeMap.nodes.forEach((n) => {
    visibleIds.add(n.id);
    const type = n.type || "text";
    const style = n.style || activeMap.appearance.itemStyles?.[type] || "soft";
    const hasColor = Boolean(n.color);
    const hasVisibleColor = hasColor && style !== "none";
    const nodeColor = hasVisibleColor ? n.color : "transparent";
    const nodeText = hasVisibleColor
      ? readableInk(n.color)
      : "var(--canvas-ink)";
    const playerInk = hasVisibleColor
      ? n.color
      : readableInk(
          activeMap.appearance.textColor || activeMap.appearance.canvasColor,
        );
    const signature = mediaSignature(n);
    let el = existing.get(n.id);
    const isNew = !el;
    if (isNew) {
      el = document.createElement("article");
      el.dataset.id = n.id;
      el.innerHTML = `${renderNodeMedia(n)}<div class="node-copy"><div class="node-title"></div><div class="node-subtitle"></div></div><button class="connector"></button><button class="node-more" type="button" aria-label="Öğe detaylarını aç"><svg class="bi" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3"/></svg></button>${type === "text" ? '<button class="node-resize-handle" aria-label="Genişliği değiştir"></button>' : ""}`;
      el.addEventListener("pointerdown", onNodeDown);
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        if (suppressNodeClick === el.dataset.id) {
          suppressNodeClick = null;
          return;
        }
        selectNodeWithoutReplacingDraggedElement(el.dataset.id);
      });
      el.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        const node = map().nodes.find((item) => item.id === el.dataset.id);
        if (!node) return;
        editNodeCopy(el.querySelector(".node-copy"), node, event);
      });
      el.querySelector(".connector").addEventListener(
        "pointerdown",
        (event) => {
          const node = map().nodes.find((item) => item.id === el.dataset.id);
          if (node) startConnection(event, node);
        },
      );
      el.querySelector(".connector").addEventListener("click", (event) => {
        event.stopPropagation();
        if (suppressConnectorClick) {
          suppressConnectorClick = false;
          return;
        }
        openConnectionModeMenu(el.dataset.id, event.currentTarget);
      });
      el.querySelector(".node-more").addEventListener(
        "pointerdown",
        (event) => {
          event.stopPropagation();
        },
      );
      el.querySelector(".node-more").addEventListener("click", (event) => {
        event.stopPropagation();
        openItemContextMenu(el.dataset.id, event.currentTarget);
      });
      el.querySelector(".node-resize-handle")?.addEventListener(
        "pointerdown",
        (event) => {
          const node = map().nodes.find((item) => item.id === el.dataset.id);
          if (node) startResize(event, node, el);
        },
      );
      nodeLayer.append(el);
    } else if (el.dataset.mediaSignature !== signature) {
      const currentMedia = el.querySelector(".node-media");
      const template = document.createElement("template");
      template.innerHTML = renderNodeMedia(n).trim();
      const nextMedia = template.content.firstElementChild;
      if (currentMedia && nextMedia) currentMedia.replaceWith(nextMedia);
      else if (currentMedia) currentMedia.remove();
      else if (nextMedia) el.insertBefore(nextMedia, el.firstChild);
    }
    el.className = `mind-node item-${type} style-${style} font-${n.font || "indie"} size-${n.size || "medium"} layout-${n.layout || "media-title-subtitle"} ${hasVisibleColor ? "" : "no-color"} ${n.customWidth ? "manual-width" : ""} ${type !== "text" ? "media-node" : ""} ${n.id === selectedNodeId ? "selected" : ""}`;
    el.dataset.mediaSignature = signature;
    el.style.cssText = `left:${n.x}px;top:${n.y}px;--node-color:${nodeColor};--node-text:${nodeText};--player-ink:${playerInk};--node-font-size:${n.fontSize || 20}px;--title-align:${n.align || "center"}${n.customWidth ? `;width:${n.customWidth}px` : ""}`;
    const title = el.querySelector(".node-title");
    if (!title.isContentEditable) {
      if (n.titleHtml) title.innerHTML = sanitizeRichText(n.titleHtml);
      else title.textContent = n.title;
    }
    const subtitle = el.querySelector(".node-subtitle");
    if (!subtitle.isContentEditable) {
      if (n.subtitleHtml) subtitle.innerHTML = sanitizeRichText(n.subtitleHtml);
      else subtitle.textContent = n.subtitle || "";
    }
    el.querySelector(".connector").ariaLabel =
      `${n.title || "Başlıksız öğe"} öğesinden bağlantı oluştur`;
    if (isNew || el.dataset.boundMediaSignature !== signature) {
      bindMediaControls(el, n);
      el.dataset.boundMediaSignature = signature;
    }
    n.renderWidth = el.offsetWidth;
    n.renderHeight = el.offsetHeight;
  });
  existing.forEach((element, id) => {
    if (!visibleIds.has(id)) element.remove();
  });
  $("#empty-state").hidden = activeMap.nodes.length > 0;
}
function mediaSignature(node) {
  if (
    ![
      "image",
      "youtube",
      "website",
      "map",
      "music",
      "recording",
      "file",
    ].includes(node.type)
  )
    return "";
  return JSON.stringify({
    type: node.type,
    mediaUrl: node.mediaUrl || "",
    youtubeId: node.youtubeId || "",
    fileName: node.fileName || "",
    mapLocation: node.mapLocation || null,
    imageShape: node.imageShape || "original",
    websitePreview: node.websitePreview !== false,
    websiteMetadata: node.websiteMetadata || null,
  });
}
function renderNodeMedia(node) {
  if (node.type === "image" && node.mediaUrl)
    return `<div class="node-media image-frame image-shape-${node.imageShape || "original"}"><img src="${escapeAttribute(node.mediaUrl)}" alt="" draggable="false"></div>`;
  if (node.type === "youtube" && node.mediaUrl)
    return `<div class="node-media"><iframe src="https://www.youtube-nocookie.com/embed/${escapeAttribute(node.mediaUrl)}" title="${escapeAttribute(node.title || "YouTube videosu")}" loading="lazy" allowfullscreen></iframe></div>`;
  if (node.type === "website" && node.mediaUrl) {
    const safeUrl = normalizeWebUrl(node.mediaUrl);
    if (!safeUrl) return "";
    const host = new URL(safeUrl).hostname.replace(/^www\./, "");
    const favicon = `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(safeUrl)}`;
    const metadata = node.websiteMetadata || {};
    const preview = node.websitePreview !== false;
    const image = preview ? normalizeWebUrl(metadata.image) : null;
    return `<div class="node-media website-card ${preview ? "with-preview" : "compact"}">${image ? `<img class="website-preview-image" src="${escapeAttribute(image)}" alt="" loading="lazy">` : ""}<span class="website-summary"><span class="website-icon"><img src="${escapeAttribute(favicon)}" alt="" loading="lazy"><b>◎</b></span><span><strong>${escapeHtml(preview && metadata.title ? metadata.title : host)}</strong>${preview && metadata.description ? `<small class="website-description">${escapeHtml(metadata.description)}</small>` : `<small>${escapeHtml(safeUrl)}</small>`}</span></span></div>`;
  }
  if (node.type === "map" && node.mapLocation) {
    const { lat, lng } = node.mapLocation;
    const src = `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
    return `<div class="node-media"><iframe class="map-frame" src="${escapeAttribute(src)}" title="${escapeAttribute(node.title || "Google Maps konumu")}" loading="lazy"></iframe></div>`;
  }
  if (node.type === "music" && node.youtubeId)
    return `<div class="node-media"><iframe class="music-youtube" src="https://www.youtube-nocookie.com/embed/${escapeAttribute(node.youtubeId)}" title="${escapeAttribute(node.title || "YouTube müziği")}" loading="lazy" allow="autoplay; encrypted-media"></iframe></div>`;
  if (["music", "recording"].includes(node.type) && node.mediaUrl)
    return renderAudioPlayer(node);
  if (node.type === "file")
    return `<div class="node-media file-card"><span class="file-card-icon">${fileIcon(node.fileType)}</span><span class="file-card-meta"><span class="file-card-name">${escapeHtml(node.fileName || "Dosya")}</span><span class="file-card-size">${formatBytes(node.fileSize || 0)}</span></span></div>`;
  return "";
}
function renderAudioPlayer(node) {
  const mediaIcon = node.type === "recording" ? microphoneIcon() : musicIcon();
  return `<div class="node-media music-card ${node.type === "recording" ? "recording-card" : ""}"><div class="audio-player"><span class="audio-kind-icon">${mediaIcon}</span><button type="button" class="audio-toggle" aria-label="Oynat">${playIcon()}</button><div class="audio-track"><input class="audio-progress" type="range" min="0" max="100" value="0" step="0.1" aria-label="Oynatma konumu"><div class="audio-time"><time class="audio-current">0:00</time><time class="audio-duration">0:00</time></div></div><audio src="${escapeAttribute(node.mediaUrl)}" preload="metadata"></audio></div></div>`;
}
function playIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 7 8 5-8 5Z"/></svg>';
}
function pauseIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7v10M15 7v10"/></svg>';
}
function musicIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v12M9 10l10-2"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>';
}
function microphoneIcon() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>';
}
function mediaTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
function bindMediaControls(element, node) {
  const audio = element.querySelector(".audio-player audio");
  if (audio) {
    const toggle = element.querySelector(".audio-toggle");
    const progress = element.querySelector(".audio-progress");
    const current = element.querySelector(".audio-current");
    const duration = element.querySelector(".audio-duration");
    const sync = () => {
      current.textContent = mediaTime(audio.currentTime);
      duration.textContent = mediaTime(audio.duration);
      const percent = audio.duration
        ? (audio.currentTime / audio.duration) * 100
        : 0;
      progress.value = percent;
      progress.style.setProperty("--audio-progress", `${percent}%`);
      toggle.innerHTML = audio.paused ? playIcon() : pauseIcon();
      toggle.setAttribute("aria-label", audio.paused ? "Oynat" : "Duraklat");
    };
    toggle.onclick = () => (audio.paused ? audio.play() : audio.pause());
    progress.oninput = () => {
      if (audio.duration)
        audio.currentTime = (Number(progress.value) / 100) * audio.duration;
    };
    audio.addEventListener("loadedmetadata", sync);
    audio.addEventListener("timeupdate", sync);
    audio.addEventListener("play", sync);
    audio.addEventListener("pause", sync);
    audio.addEventListener("ended", sync);
  }
  const favicon = element.querySelector(".website-icon img");
  if (favicon) favicon.onerror = () => favicon.remove();
  const image = element.querySelector(".image-frame img");
  if (image) {
    image.addEventListener("load", () => {
      node.renderWidth = element.offsetWidth;
      node.renderHeight = element.offsetHeight;
      renderEdges();
    });
  }
}
function fileIcon(type = "") {
  if (type.includes("pdf")) return "PDF";
  if (type.includes("audio")) return "♫";
  if (type.includes("video")) return "▶";
  return "DOC";
}
function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
function sanitizeRichText(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowed = new Set([
    "B",
    "STRONG",
    "I",
    "EM",
    "U",
    "BR",
    "FONT",
    "SPAN",
  ]);
  const clean = (parent) => {
    [...parent.childNodes].forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (!allowed.has(node.tagName)) {
        clean(node);
        node.replaceWith(...node.childNodes);
        return;
      }
      [...node.attributes].forEach((attribute) => {
        const fontColor = node.tagName === "FONT" && attribute.name === "color";
        const markStyle =
          node.tagName === "SPAN" &&
          attribute.name === "style" &&
          /^background-color:\s*(#[\da-f]{3,8}|rgb\([\d\s,.%]+\));?$/i.test(
            attribute.value,
          );
        if (!fontColor && !markStyle) {
          node.removeAttribute(attribute.name);
        }
      });
      if (
        node.tagName === "FONT" &&
        node.hasAttribute("color") &&
        !/^(#[\da-f]{3,8}|rgb\([\d\s,.%]+\))$/i.test(node.getAttribute("color"))
      ) {
        node.removeAttribute("color");
      }
      clean(node);
    });
  };
  clean(template.content);
  return template.innerHTML;
}
function escapeAttribute(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function selectEditorContent(element, event) {
  const selection = getSelection();
  selection.removeAllRanges();
  let range = null;
  if (event && document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(
      event.clientX,
      event.clientY,
    );
    if (position && element.contains(position.offsetNode)) {
      range = document.createRange();
      if (
        event.detail >= 2 &&
        position.offsetNode.nodeType === Node.TEXT_NODE
      ) {
        const text = position.offsetNode.textContent;
        let start = position.offset;
        let end = position.offset;
        while (start > 0 && !/\s/.test(text[start - 1])) start -= 1;
        while (end < text.length && !/\s/.test(text[end])) end += 1;
        range.setStart(position.offsetNode, start);
        range.setEnd(position.offsetNode, end);
      } else {
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
      }
    }
  } else if (event && document.caretRangeFromPoint) {
    const candidate = document.caretRangeFromPoint(
      event.clientX,
      event.clientY,
    );
    if (candidate && element.contains(candidate.startContainer))
      range = candidate;
  }
  if (!range) {
    range = document.createRange();
    range.selectNodeContents(element);
    if (event) range.collapse(false);
  }
  selection.addRange(range);
}
function editTitle(el, n, event = null) {
  el.contentEditable = "true";
  activeTitleEditor = el;
  el.focus();
  selectEditorContent(el, event);
  const original = n.title;
  const originalHtml = n.titleHtml || escapeHtml(n.title);
  const finish = (cancel) => {
    $("#rich-text-toolbar").hidden = true;
    activeTitleEditor = null;
    savedTitleRange = null;
    el.contentEditable = "false";
    const next = cancel ? original : el.textContent.trim();
    const formatted = sanitizeRichText(el.innerHTML);
    if (!cancel && (next !== n.title || formatted !== originalHtml)) {
      snapshot();
      n.title = next;
      n.titleHtml = next ? formatted : "";
      scheduleSave();
      renderAll();
    } else el.innerHTML = originalHtml;
  };
  el.onkeydown = (e) => {
    if (e.key === "Enter" && n.type !== "text") {
      e.preventDefault();
      el.blur();
    } else if (e.key === "Enter") {
      e.preventDefault();
      document.execCommand("insertLineBreak");
    }
    if (e.key === "Escape") {
      e.preventDefault();
      finish(true);
    }
  };
  el.onblur = () => finish(false);
}
function editSubtitle(element, node, event = null) {
  const original = node.subtitle || "";
  const originalHtml = node.subtitleHtml || escapeHtml(original);
  let finished = false;
  element.contentEditable = "true";
  element.focus();
  activeTitleEditor = element;
  selectEditorContent(element, event);
  const finish = (cancel = false) => {
    if (finished) return;
    finished = true;
    $("#rich-text-toolbar").hidden = true;
    activeTitleEditor = null;
    savedTitleRange = null;
    element.contentEditable = "false";
    const next = cancel ? original : element.textContent.trim();
    const formatted = sanitizeRichText(element.innerHTML);
    if (!cancel && (next !== original || formatted !== originalHtml)) {
      snapshot();
      node.subtitle = next;
      node.subtitleHtml = next ? formatted : "";
      scheduleSave();
      renderNodes();
      renderEdges();
      renderNote();
    } else element.innerHTML = originalHtml;
  };
  element.onkeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      element.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(true);
    }
  };
  element.onblur = () => finish(false);
}
function editNodeCopy(element, node, event = null) {
  const title = element.querySelector(".node-title");
  const subtitle = element.querySelector(".node-subtitle");
  const original = {
    title: node.title || "",
    subtitle: node.subtitle || "",
    titleHtml: node.titleHtml || escapeHtml(node.title || ""),
    subtitleHtml: node.subtitleHtml || escapeHtml(node.subtitle || ""),
  };
  let finished = false;
  element.contentEditable = "true";
  element.focus();
  activeTitleEditor = element;
  selectEditorContent(element, event);
  const finish = (cancel = false) => {
    if (finished) return;
    finished = true;
    $("#rich-text-toolbar").hidden = true;
    activeTitleEditor = null;
    savedTitleRange = null;
    element.contentEditable = "false";
    const nextTitle = title.textContent.trim();
    const nextSubtitle = subtitle.textContent.trim();
    const titleHtml = sanitizeRichText(title.innerHTML);
    const subtitleHtml = sanitizeRichText(subtitle.innerHTML);
    if (
      !cancel &&
      (nextTitle !== original.title ||
        nextSubtitle !== original.subtitle ||
        titleHtml !== original.titleHtml ||
        subtitleHtml !== original.subtitleHtml)
    ) {
      snapshot();
      node.title = nextTitle;
      node.subtitle = nextSubtitle;
      node.titleHtml = nextTitle ? titleHtml : "";
      node.subtitleHtml = nextSubtitle ? subtitleHtml : "";
      scheduleSave();
      renderNodes();
      renderEdges();
      renderNote();
    } else {
      title.innerHTML = original.titleHtml;
      subtitle.innerHTML = original.subtitleHtml;
    }
  };
  element.onkeydown = (keyboardEvent) => {
    if (keyboardEvent.key === "Enter") {
      keyboardEvent.preventDefault();
      document.execCommand("insertLineBreak");
    } else if (keyboardEvent.key === "Escape") {
      keyboardEvent.preventDefault();
      finish(true);
    }
  };
  element.onblur = () => finish(false);
}
document.addEventListener("selectionchange", () => {
  if (!activeTitleEditor) return;
  const selection = getSelection();
  const toolbar = $("#rich-text-toolbar");
  if (
    !selection.rangeCount ||
    selection.isCollapsed ||
    !activeTitleEditor.contains(selection.getRangeAt(0).commonAncestorContainer)
  ) {
    toolbar.hidden = true;
    return;
  }
  savedTitleRange = selection.getRangeAt(0).cloneRange();
  const rect = savedTitleRange.getBoundingClientRect();
  toolbar.hidden = false;
  toolbar.style.left = `${Math.max(12, Math.min(innerWidth - toolbar.offsetWidth - 12, rect.left + rect.width / 2 - toolbar.offsetWidth / 2))}px`;
  toolbar.style.top = `${Math.max(12, rect.top - toolbar.offsetHeight - 10)}px`;
});
function applyRichCommand(command, value = null) {
  if (!activeTitleEditor || !savedTitleRange) return;
  const selection = getSelection();
  selection.removeAllRanges();
  selection.addRange(savedTitleRange);
  document.execCommand(command, false, value);
  savedTitleRange = selection.rangeCount
    ? selection.getRangeAt(0).cloneRange()
    : null;
  activeTitleEditor.focus({ preventScroll: true });
}
$$("#rich-text-toolbar button").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (button.dataset.richCommand)
      applyRichCommand(
        button.dataset.richCommand,
        button.dataset.richValue || null,
      );
    if (button.dataset.richColor)
      applyRichCommand("foreColor", button.dataset.richColor);
  });
});
function selectNode(id) {
  selectedNodeId = id;
  selectedEdgeId = null;
  renderNodes();
  renderEdges();
  renderNote();
}
function selectNodeWithoutReplacingDraggedElement(id) {
  const detailsOpen = $("#note-panel").classList.contains("open");
  selectedNodeId = id;
  selectedEdgeId = null;
  $$(".mind-node").forEach((node) =>
    node.classList.toggle("selected", node.dataset.id === id),
  );
  renderEdges();
  if (detailsOpen) renderNote();
}
function openItemContextMenu(id, anchor) {
  selectNodeWithoutReplacingDraggedElement(id);
  const menu = $("#item-context-menu");
  const rect = anchor.getBoundingClientRect();
  menu.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - 260))}px`;
  menu.style.top = `${Math.max(12, Math.min(rect.bottom + 8, innerHeight - 300))}px`;
  menu.hidden = false;
}
function openConnectionModeMenu(id, anchor) {
  const menu = $("#connection-mode-menu");
  const rect = anchor.getBoundingClientRect();
  menu.dataset.sourceId = id;
  menu.style.left = `${Math.max(12, Math.min(rect.left - 48, innerWidth - 180))}px`;
  menu.style.top = `${Math.max(12, Math.min(rect.bottom + 10, innerHeight - 80))}px`;
  $$("[data-connection-mode]", menu).forEach((button) =>
    button.classList.toggle(
      "active",
      button.dataset.connectionMode === connectionMode,
    ),
  );
  menu.hidden = false;
}
function onNodeDown(e) {
  if (
    e.target.classList.contains("connector") ||
    e.target.classList.contains("node-more") ||
    e.target.classList.contains("node-resize-handle") ||
    e.target.isContentEditable ||
    e.target.closest("audio, .audio-player")
  )
    return;
  e.stopPropagation();
  suppressNodeClick = null;
  const n = map().nodes.find((n) => n.id === e.currentTarget.dataset.id);
  snapshot();
  drag = {
    id: n.id,
    startX: e.clientX,
    startY: e.clientY,
    x: n.x,
    y: n.y,
    moved: false,
  };
  e.currentTarget.setPointerCapture(e.pointerId);
}
function startResize(event, node, element) {
  event.stopPropagation();
  event.preventDefault();
  snapshot();
  resize = {
    id: node.id,
    startX: event.clientX,
    width: element.offsetWidth,
  };
  element.setPointerCapture(event.pointerId);
}
function startConnection(e, n) {
  e.stopPropagation();
  e.preventDefault();
  snapshot();
  if (connectionMode === "draw") {
    freehandDrawing = {
      pointerId: e.pointerId,
      source: n.id,
      points: [screenToWorld(e.clientX, e.clientY)],
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    renderEdges();
    return;
  }
  connect = {
    source: n.id,
    x: e.clientX,
    y: e.clientY,
    startX: e.clientX,
    startY: e.clientY,
    moved: false,
  };
  e.currentTarget.setPointerCapture(e.pointerId);
  renderEdges();
}
function nodeCenter(node) {
  const size = nodeDimensions(node);
  return { x: node.x + size.width / 2, y: node.y + size.height / 2 };
}
function anchoredFreehandPoints(edge, source, target) {
  if (!source || !target || !edge.sourceAnchor || !edge.targetAnchor)
    return edge.points;
  const sourceNow = nodeCenter(source);
  const targetNow = nodeCenter(target);
  const sourceDelta = {
    x: sourceNow.x - edge.sourceAnchor.x,
    y: sourceNow.y - edge.sourceAnchor.y,
  };
  const targetDelta = {
    x: targetNow.x - edge.targetAnchor.x,
    y: targetNow.y - edge.targetAnchor.y,
  };
  const lastIndex = Math.max(1, edge.points.length - 1);
  return edge.points.map((point, index) => {
    const progress = index / lastIndex;
    return {
      x: point.x + sourceDelta.x * (1 - progress) + targetDelta.x * progress,
      y: point.y + sourceDelta.y * (1 - progress) + targetDelta.y * progress,
    };
  });
}
function renderEdges() {
  if (edgeFrame) {
    cancelAnimationFrame(edgeFrame);
    edgeFrame = null;
  }
  edgeRoot.setAttribute("transform", currentTransform().replaceAll("px", ""));
  edgeRoot.innerHTML = "";
  map().edges.forEach((edge) => {
    const a = map().nodes.find((n) => n.id === edge.sourceId),
      b = map().nodes.find((n) => n.id === edge.targetId);
    if (!edge.points?.length && (!a || !b)) return;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute(
      "class",
      `edge-group ${edge.id === selectedEdgeId ? "selected" : ""}`,
    );
    g.dataset.id = edge.id;
    const renderedPoints = edge.points?.length
      ? anchoredFreehandPoints(edge, a, b)
      : null;
    const p = renderedPoints
      ? buildFreehandPath(renderedPoints)
      : buildEdgePath(a, b, edge.pathStyle);
    const dash =
      edge.lineStyle === "dashed"
        ? "9 7"
        : edge.lineStyle === "dotted"
          ? "2 7"
          : "";
    g.innerHTML = `<path class="edge-hit" d="${p}"/><path class="edge-sketch" d="${p}" style="--edge-color:${edge.color};--edge-width:${edge.width || 2};stroke-dasharray:${dash}"/><path class="edge-visible" d="${p}" style="--edge-color:${edge.color};--edge-width:${edge.width || 2};stroke-dasharray:${dash}" ${["forward", "both"].includes(edge.direction) ? 'marker-end="url(#arrow-end)"' : ""} ${["backward", "both"].includes(edge.direction) ? 'marker-start="url(#arrow-start)"' : ""}/>`;
    g.addEventListener("click", (e) => {
      e.stopPropagation();
      selectEdge(edge.id, e.clientX, e.clientY);
    });
    if (edge.label) {
      const ad = a ? nodeDimensions(a) : null,
        bd = b ? nodeDimensions(b) : null;
      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      text.setAttribute("class", "edge-label");
      text.setAttribute(
        "x",
        renderedPoints
          ? renderedPoints[Math.floor(renderedPoints.length / 2)].x
          : (a.x + ad.width / 2 + b.x + bd.width / 2) / 2,
      );
      text.setAttribute(
        "y",
        renderedPoints
          ? renderedPoints[Math.floor(renderedPoints.length / 2)].y - 8
          : (a.y + ad.height / 2 + b.y + bd.height / 2) / 2 - 8,
      );
      text.textContent = edge.label;
      g.append(text);
    }
    edgeRoot.append(g);
  });
  if (connect) {
    const s = map().nodes.find((n) => n.id === connect.source),
      dimensions = nodeDimensions(s),
      p = screenToWorld(connect.x, connect.y),
      temp = document.createElementNS("http://www.w3.org/2000/svg", "path");
    temp.setAttribute("class", "temp-edge");
    temp.setAttribute(
      "d",
      `M${s.x + dimensions.width},${s.y + dimensions.height / 2} L${p.x},${p.y}`,
    );
    edgeRoot.append(temp);
  }
  if (freehandDrawing?.points.length > 1) {
    const temp = document.createElementNS("http://www.w3.org/2000/svg", "path");
    temp.setAttribute("class", "temp-edge freehand-preview");
    temp.setAttribute("d", buildFreehandPath(freehandDrawing.points));
    temp.setAttribute("marker-end", "url(#arrow-end)");
    edgeRoot.append(temp);
  }
}
function syncEdgePopover(edge) {
  $("#edge-label").value = edge.label || "";
  const edgeColor = edge.color || map().appearance.arrowColor;
  $("#edge-color").value = edgeColor;
  $("#edge-width").value = edge.width || 2;
  $("#edge-width-output").value = `${edge.width || 2}px`;
  $$("#edge-color-presets button").forEach((button) =>
    button.classList.toggle(
      "active",
      button.dataset.color.toLowerCase() === edgeColor.toLowerCase(),
    ),
  );
  $$("#edge-direction button").forEach((b) =>
    b.classList.toggle("active", b.dataset.direction === edge.direction),
  );
  $$("#edge-line-style button").forEach((b) =>
    b.classList.toggle("active", b.dataset.style === edge.lineStyle),
  );
  $$("#edge-path-style button").forEach((b) =>
    b.classList.toggle("active", b.dataset.path === edge.pathStyle),
  );
}
function selectEdge(id, x, y) {
  selectedEdgeId = id;
  selectedNodeId = null;
  renderNodes();
  renderEdges();
  renderNote();
  const edge = map().edges.find((e) => e.id === id),
    pop = $("#edge-popover");
  syncEdgePopover(edge);
  pop.style.left = `${Math.min(x + 10, innerWidth - 320)}px`;
  pop.style.top = `${Math.min(y + 10, innerHeight - 390)}px`;
  pop.hidden = false;
}
function nodeEditableLink(node) {
  if (node.type === "youtube" && node.mediaUrl)
    return `https://www.youtube.com/watch?v=${node.mediaUrl}`;
  if (node.type === "website") return node.mediaUrl || "";
  if (node.type === "map" && node.mapLocation)
    return `${node.mapLocation.lat}, ${node.mapLocation.lng}`;
  if (node.type === "music" && node.youtubeId)
    return `https://www.youtube.com/watch?v=${node.youtubeId}`;
  if (["image", "music", "file"].includes(node.type))
    return /^https?:/i.test(node.mediaUrl || "") ? node.mediaUrl : null;
  return null;
}
function renderNote() {
  const n = map().nodes.find((n) => n.id === selectedNodeId);
  syncDetailsToggle();
  $(".note-empty").hidden = !!n;
  $(".note-content").hidden = !n;
  if (!n) return;
  $("#note-title").value = n.title;
  $("#note-subtitle").value = n.subtitle || "";
  $("#note-text").value = n.note || "";
  $("#note-tags").value = (n.tags || []).join(", ");
  $("#node-font").value = n.font || "indie";
  $("#node-font-size").value = n.fontSize || 20;
  $("#node-font-size-output").value = `${n.fontSize || 20}px`;
  const isText = (n.type || "text") === "text";
  const isImage = n.type === "image";
  $("#node-width-field").hidden = !isText;
  $("#node-size-field").hidden = isText;
  $("#node-layout-field").hidden = isText;
  $("#image-shape-field").hidden = !isImage;
  $("#website-preview-field").hidden = n.type !== "website";
  $("#website-preview").checked = n.websitePreview !== false;
  if (isText) {
    const width = n.customWidth || n.renderWidth || 156;
    $("#node-width").value = width;
    $("#node-width-output").value = n.customWidth
      ? `${Math.round(width)}px`
      : "Otomatik";
  } else {
    $$("#node-size-options button").forEach((button) =>
      button.classList.toggle(
        "active",
        button.dataset.nodeSize === (n.size || "medium"),
      ),
    );
  }
  if (isImage) {
    $$("#image-shape-options button").forEach((button) =>
      button.classList.toggle(
        "active",
        button.dataset.imageShape === (n.imageShape || "original"),
      ),
    );
  }
  if (!isText) {
    $$("#node-layout-options button").forEach((button) =>
      button.classList.toggle(
        "active",
        button.dataset.nodeLayout === (n.layout || "media-title-subtitle"),
      ),
    );
  }
  const attachment = $("#open-attachment");
  const attachmentUrl =
    n.type === "map" && n.mapLocation
      ? `https://www.google.com/maps?q=${n.mapLocation.lat},${n.mapLocation.lng}`
      : n.type === "music" && n.youtubeId
        ? `https://www.youtube.com/watch?v=${n.youtubeId}`
        : n.mediaUrl;
  attachment.hidden = !attachmentUrl || n.type === "image";
  if (!attachment.hidden) {
    attachment.href =
      n.type === "youtube"
        ? `https://www.youtube.com/watch?v=${n.mediaUrl}`
        : attachmentUrl;
    attachment.download = ["file", "music", "recording"].includes(n.type)
      ? n.fileName || "dosya"
      : "";
  }
  const editableLink = nodeEditableLink(n);
  $("#node-link-field").hidden = editableLink === null;
  $("#node-link").type = n.type === "map" ? "text" : "url";
  $("#node-link").value = editableLink || "";
  $("#node-colors").innerHTML = COLORS.map((color) => {
    const value = color || "none";
    return `<button class="swatch ${color === (n.color || null) ? "active" : ""} ${color ? "" : "no-color-swatch"}" data-color="${value}" ${color ? `style="background:${color}"` : ""} aria-label="${color ? "Renk seç" : "Rengi kaldır"}"></button>`;
  }).join("");
  $$(".swatch").forEach(
    (b) =>
      (b.onclick = () => {
        snapshot();
        n.color = b.dataset.color === "none" ? null : b.dataset.color;
        renderAll();
        scheduleSave();
      }),
  );
  $$("#node-style-options button").forEach((button) =>
    button.classList.toggle(
      "active",
      button.dataset.nodeStyle === (n.style || "soft"),
    ),
  );
  $$("#node-align-options button").forEach((button) =>
    button.classList.toggle(
      "active",
      button.dataset.nodeAlign === (n.align || "center"),
    ),
  );
}
function mutateAppearance(key, value) {
  snapshot();
  map().appearance[key] = value;
  map().appearance.theme = "custom";
  if (key === "canvasColor") map().appearance.textColor = readableInk(value);
  renderAppearance();
  scheduleSave();
}
function applyTheme(name) {
  const theme = THEMES[name];
  if (!theme) return;
  snapshot();
  Object.assign(map().appearance, theme, { theme: name });
  map().edges.forEach((edge) => (edge.color = theme.arrowColor));
  renderAppearance();
  renderEdges();
  scheduleSave();
}
canvas.addEventListener("dblclick", (e) => {
  if (e.target !== canvas && e.target !== nodeLayer) return;
  const p = screenToWorld(e.clientX, e.clientY);
  snapshot();
  const n = {
    id: uid(),
    type: "text",
    style: map().appearance.itemStyles?.text || "soft",
    title: "Yeni fikir",
    x: p.x - 78,
    y: p.y - 31,
    color: COLORS[map().nodes.length % COLORS.length],
    note: "",
    tags: [],
  };
  map().nodes.push(n);
  selectedNodeId = n.id;
  renderAll();
  scheduleSave();
  setTimeout(() => {
    const el = $(`.mind-node[data-id="${n.id}"] .node-copy`);
    editNodeCopy(el, n);
  }, 0);
});
canvas.addEventListener("pointerdown", (e) => {
  if (e.target !== canvas && e.target !== nodeLayer) return;
  if (e.target !== canvas) return;
  if (e.pointerType === "touch") {
    touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touchPoints.size === 2) {
      const [first, second] = [...touchPoints.values()];
      const midpoint = {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
      };
      pinch = {
        distance: Math.hypot(second.x - first.x, second.y - first.y),
        zoom: map().viewport.zoom,
        world: screenToWorld(midpoint.x, midpoint.y),
      };
      pan = null;
      canvas.setPointerCapture(e.pointerId);
      return;
    }
  }
  selectedNodeId = selectedEdgeId = null;
  $("#edge-popover").hidden = true;
  $$(".mind-node").forEach((node) => node.classList.remove("selected"));
  renderNote();
  renderEdges();
  pan = {
    x: e.clientX,
    y: e.clientY,
    vx: map().viewport.x,
    vy: map().viewport.y,
  };
  canvas.setPointerCapture(e.pointerId);
});
window.addEventListener("pointermove", (e) => {
  if (freehandDrawing?.pointerId === e.pointerId) {
    const point = screenToWorld(e.clientX, e.clientY);
    const previous = freehandDrawing.points.at(-1);
    if (Math.hypot(point.x - previous.x, point.y - previous.y) >= 2) {
      freehandDrawing.points.push(point);
      freehandDrawing.moved = true;
      suppressConnectorClick = true;
      scheduleEdgeRender();
    }
    return;
  }
  if (e.pointerType === "touch" && touchPoints.has(e.pointerId)) {
    touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touchPoints.size >= 2) {
      const [first, second] = [...touchPoints.values()];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const midpoint = {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
      };
      const rect = canvas.getBoundingClientRect();
      const viewport = map().viewport;
      viewport.zoom = Math.min(
        1.8,
        Math.max(0.45, pinch.zoom * (distance / Math.max(1, pinch.distance))),
      );
      viewport.x = midpoint.x - rect.left - pinch.world.x * viewport.zoom;
      viewport.y = midpoint.y - rect.top - pinch.world.y * viewport.zoom;
      renderViewport();
      return;
    }
  }
  if (resize) {
    const node = map().nodes.find((item) => item.id === resize.id);
    const width = Math.min(
      320,
      Math.max(
        64,
        resize.width + (e.clientX - resize.startX) / map().viewport.zoom,
      ),
    );
    node.customWidth = Math.round(width);
    node.renderWidth = node.customWidth;
    const element = $(`.mind-node[data-id="${resize.id}"]`);
    if (element) element.style.width = `${node.customWidth}px`;
    $("#node-width").value = node.customWidth;
    $("#node-width-output").value = `${node.customWidth}px`;
    scheduleEdgeRender();
  }
  if (drag) {
    const n = map().nodes.find((n) => n.id === drag.id);
    const deltaX = e.clientX - drag.startX;
    const deltaY = e.clientY - drag.startY;
    n.x = drag.x + deltaX / map().viewport.zoom;
    n.y = drag.y + deltaY / map().viewport.zoom;
    drag.moved ||= Math.hypot(deltaX, deltaY) > 4;
    const element = $(`.mind-node[data-id="${drag.id}"]`);
    if (element) {
      element.style.left = `${n.x}px`;
      element.style.top = `${n.y}px`;
    }
    scheduleEdgeRender();
  }
  if (connect) {
    connect.x = e.clientX;
    connect.y = e.clientY;
    connect.moved ||=
      Math.hypot(e.clientX - connect.startX, e.clientY - connect.startY) > 4;
    suppressConnectorClick ||= connect.moved;
    scheduleEdgeRender();
  }
  if (pan) {
    map().viewport.x = pan.vx + e.clientX - pan.x;
    map().viewport.y = pan.vy + e.clientY - pan.y;
    renderViewport();
  }
});
window.addEventListener("pointerup", (e) => {
  if (freehandDrawing?.pointerId === e.pointerId) {
    const points = freehandDrawing.points;
    const start = points[0];
    const end = points.at(-1);
    const targetElement = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest(".mind-node");
    const source = map().nodes.find(
      (node) => node.id === freehandDrawing.source,
    );
    const target = map().nodes.find(
      (node) => node.id === targetElement?.dataset.id,
    );
    if (
      source &&
      target &&
      target.id !== source.id &&
      points.length > 2 &&
      Math.hypot(end.x - start.x, end.y - start.y) > 14
    ) {
      const straight = buildEdgePath(source, target, "straight")
        .match(/-?\d+(?:\.\d+)?/g)
        .map(Number);
      points[0] = { x: straight[0], y: straight[1] };
      points[points.length - 1] = { x: straight[2], y: straight[3] };
      map().edges.push({
        id: uid(),
        sourceId: source.id,
        targetId: target.id,
        sourceAnchor: nodeCenter(source),
        targetAnchor: nodeCenter(target),
        points,
        label: "",
        color: map().appearance.arrowColor,
        direction: "forward",
        lineStyle: "solid",
        pathStyle: "freehand",
        width: 2,
      });
      scheduleSave();
    } else {
      history.pop();
    }
    freehandDrawing = null;
    renderEdges();
    return;
  }
  if (e.pointerType === "touch") {
    touchPoints.delete(e.pointerId);
    if (touchPoints.size < 2 && pinch) {
      pinch = null;
      pan = null;
      scheduleSave();
    }
  }
  if (resize) {
    resize = null;
    scheduleSave();
  }
  if (drag) {
    if (drag.moved) {
      suppressNodeClick = drag.id;
      scheduleSave();
    } else history.pop();
    drag = null;
  }
  if (connect) {
    const target = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest(".mind-node");
    if (
      target &&
      target.dataset.id !== connect.source &&
      !map().edges.some(
        (x) =>
          x.sourceId === connect.source && x.targetId === target.dataset.id,
      )
    ) {
      map().edges.push({
        id: uid(),
        sourceId: connect.source,
        targetId: target.dataset.id,
        label: "",
        color: map().appearance.arrowColor,
        direction: "forward",
        lineStyle: "solid",
        pathStyle: "curved",
        width: 2,
      });
      scheduleSave();
    } else history.pop();
    connect = null;
    renderEdges();
  }
  if (pan) {
    pan = null;
    scheduleSave();
  }
});
window.addEventListener("pointercancel", (event) => {
  if (freehandDrawing?.pointerId === event.pointerId) {
    history.pop();
    freehandDrawing = null;
    renderEdges();
  }
  if (event.pointerType !== "touch") return;
  touchPoints.delete(event.pointerId);
  if (touchPoints.size < 2) pinch = null;
  pan = null;
});
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const v = map().viewport,
      old = v.zoom,
      next = Math.min(1.8, Math.max(0.45, old * (e.deltaY < 0 ? 1.1 : 0.9))),
      r = canvas.getBoundingClientRect(),
      mx = e.clientX - r.left,
      my = e.clientY - r.top;
    v.x = mx - (mx - v.x) * (next / old);
    v.y = my - (my - v.y) * (next / old);
    v.zoom = next;
    renderViewport();
    scheduleSave();
  },
  { passive: false },
);
$("#map-title").onchange = (e) => {
  snapshot();
  map().title = e.target.value.trim() || "Adsız Harita";
  renderMaps();
  scheduleSave();
};
$("#new-map-btn").onclick = () => {
  snapshot();
  const m = initialMap();
  m.title = `Yeni Harita ${state.maps.length + 1}`;
  state.maps.push(m);
  state.activeMapId = m.id;
  selectedNodeId = null;
  renderAll();
  scheduleSave();
};
function openItemDialog(position = null) {
  pendingItemPosition =
    position ||
    screenToWorld(
      canvas.clientWidth / 2 + canvas.getBoundingClientRect().left,
      canvas.clientHeight / 2 + canvas.getBoundingClientRect().top,
    );
  $("#item-form").reset();
  resetRecording();
  setItemType("text");
  $("#item-dialog").showModal();
  requestAnimationFrame(() => $("#item-title").focus());
}
function setItemType(type) {
  $("#item-type").value = type;
  $$(".item-type").forEach((button) =>
    button.classList.toggle("active", button.dataset.type === type),
  );
  const needsUrl = ["youtube", "website", "map", "image", "music"].includes(
    type,
  );
  const needsFile = ["image", "file", "music"].includes(type);
  $("#item-url-field").hidden = !needsUrl;
  $("#item-file-field").hidden = !needsFile;
  $("#recording-field").hidden = type !== "recording";
  $("#item-website-preview-field").hidden = type !== "website";
  $("#item-url").type = type === "map" ? "text" : "url";
  $("#item-url").placeholder =
    type === "youtube"
      ? "https://youtube.com/watch?v=…"
      : type === "website"
        ? "https://example.com"
        : type === "image"
          ? "https://example.com/gorsel.jpg"
          : type === "music"
            ? "YouTube veya doğrudan ses bağlantısı"
            : "41.0082, 28.9784 veya Google Maps bağlantısı";
  $("#item-url-label").textContent = ["image", "music"].includes(type)
    ? "Bağlantı (dosya yerine kullanılabilir)"
    : "Bağlantı";
  $("#item-file").accept =
    type === "image" ? "image/*" : type === "music" ? "audio/*" : "";
  $("#item-file-label").textContent =
    type === "image"
      ? "Bir görsel seç"
      : type === "music"
        ? "Bir müzik dosyası seç"
        : "Dosya seç veya buraya bırak";
}
function updateRecordingClock() {
  const seconds = Math.floor((Date.now() - recordingStartedAt) / 1000);
  recordingDuration = seconds;
  $("#recording-time").textContent =
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function resetRecording() {
  clearInterval(recordingTimer);
  recordingTimer = null;
  if (audioRecorder?.state === "recording") {
    audioRecorder.onstop = null;
    audioRecorder.stop();
  }
  recordingStream?.getTracks().forEach((track) => track.stop());
  recordingStream = null;
  audioRecorder = null;
  recordingDataUrl = null;
  recordingDuration = 0;
  $("#recording-preview").hidden = true;
  $("#recording-preview").removeAttribute("src");
  $("#recording-status").textContent = "Kayda hazır";
  $("#recording-time").textContent = "00:00";
  $("#recording-dot").classList.remove("active");
  $("#start-recording").disabled = false;
  $("#stop-recording").disabled = true;
}
async function startAudioRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    toast("Bu tarayıcı ses kaydını desteklemiyor.");
    return;
  }
  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    const chunks = [];
    audioRecorder = new MediaRecorder(recordingStream);
    audioRecorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    audioRecorder.onstop = async () => {
      const blob = new Blob(chunks, {
        type: audioRecorder.mimeType || "audio/webm",
      });
      recordingDataUrl = await readFileAsDataUrl(blob);
      const preview = $("#recording-preview");
      preview.src = recordingDataUrl;
      preview.hidden = false;
      $("#recording-status").textContent = "Kayıt hazır";
      $("#recording-dot").classList.remove("active");
      $("#start-recording").disabled = false;
      recordingStream?.getTracks().forEach((track) => track.stop());
      recordingStream = null;
    };
    audioRecorder.start();
    recordingStartedAt = Date.now();
    updateRecordingClock();
    recordingTimer = setInterval(updateRecordingClock, 500);
    $("#recording-status").textContent = "Kaydediliyor";
    $("#recording-dot").classList.add("active");
    $("#start-recording").disabled = true;
    $("#stop-recording").disabled = false;
  } catch {
    toast("Mikrofon izni verilmedi veya mikrofon kullanılamıyor.");
    resetRecording();
  }
}
function stopAudioRecording() {
  if (audioRecorder?.state !== "recording") return;
  clearInterval(recordingTimer);
  recordingTimer = null;
  updateRecordingClock();
  audioRecorder.stop();
  $("#stop-recording").disabled = true;
}
$("#start-recording").onclick = startAudioRecording;
$("#stop-recording").onclick = stopAudioRecording;
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
async function fetchWebsiteMetadata(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) return null;
    const payload = await response.json();
    const data = payload?.data;
    if (!data) return null;
    return {
      title: String(data.title || "").slice(0, 140),
      description: String(data.description || "").slice(0, 240),
      image: normalizeWebUrl(data.image?.url || data.image || ""),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
async function createItemFromDialog() {
  const type = $("#item-type").value,
    file = $("#item-file").files[0],
    position = pendingItemPosition || { x: 300, y: 200 },
    node = {
      id: uid(),
      type,
      style: map().appearance.itemStyles?.[type] || "soft",
      title: $("#item-title").value.trim(),
      subtitle: $("#item-subtitle").value.trim(),
      x: position.x - (type === "text" ? 78 : 115),
      y: position.y - 31,
      color: COLORS[map().nodes.length % COLORS.length],
      note: "",
      tags: [],
    };
  if (type === "file" && !file) throw new Error("Lütfen bir dosya seç.");
  if (file && ["image", "file", "music"].includes(type)) {
    const maxSize = type === "music" ? 24 : 12;
    if (file.size > maxSize * 1024 * 1024)
      throw new Error(`Dosya en fazla ${maxSize} MB olabilir.`);
    node.mediaUrl = await readFileAsDataUrl(file);
    node.fileName = file.name;
    node.fileType = file.type;
    node.fileSize = file.size;
  }
  if (type === "image" && !file) {
    node.mediaUrl = normalizeWebUrl($("#item-url").value.trim());
    if (!node.mediaUrl)
      throw new Error("Bir görsel dosyası veya bağlantısı ekle.");
  }
  if (type === "music" && !file) {
    const value = $("#item-url").value.trim();
    node.youtubeId = youtubeId(value);
    if (!node.youtubeId) node.mediaUrl = normalizeWebUrl(value);
    if (!node.youtubeId && !node.mediaUrl)
      throw new Error("Bir müzik dosyası, YouTube veya ses bağlantısı ekle.");
  }
  if (type === "youtube") {
    node.mediaUrl = youtubeId($("#item-url").value.trim());
    if (!node.mediaUrl) throw new Error("Geçerli bir YouTube bağlantısı gir.");
  }
  if (type === "website") {
    node.mediaUrl = normalizeWebUrl($("#item-url").value.trim());
    if (!node.mediaUrl)
      throw new Error("Geçerli bir web sitesi bağlantısı gir.");
    node.websitePreview = $("#item-website-preview").checked;
    if (node.websitePreview)
      node.websiteMetadata = await fetchWebsiteMetadata(node.mediaUrl);
  }
  if (type === "map") {
    node.mapLocation = parseMapLocation($("#item-url").value.trim());
    if (!node.mapLocation)
      throw new Error("Geçerli bir enlem ve boylam gir: 41.0082, 28.9784");
  }
  if (type === "recording") {
    if (!recordingDataUrl) throw new Error("Önce bir ses kaydı oluştur.");
    node.mediaUrl = recordingDataUrl;
    node.fileName = `ses-kaydi-${new Date().toISOString().replaceAll(":", "-")}.webm`;
    node.fileType = "audio/webm";
    node.recordingDuration = recordingDuration;
  }
  snapshot();
  map().nodes.push(node);
  selectedNodeId = node.id;
  $("#item-dialog").close();
  recordingStream?.getTracks().forEach((track) => track.stop());
  renderAll();
  scheduleSave();
}
$("#add-item-btn").onclick = () => openItemDialog();
$$(".item-type").forEach(
  (button) => (button.onclick = () => setItemType(button.dataset.type)),
);
$("#close-item-dialog").onclick = $("#cancel-item").onclick = () =>
  $("#item-dialog").close();
$("#item-dialog").addEventListener("close", resetRecording);
$("#item-form").onsubmit = async (event) => {
  event.preventDefault();
  try {
    await createItemFromDialog();
  } catch (error) {
    toast(error.message || "Öğe eklenemedi.");
  }
};
$("#appearance-btn").onclick = () => {
  $("#settings-popover").hidden = true;
  $("#appearance-popover").hidden = !$("#appearance-popover").hidden;
};
$("#settings-btn").onclick = () => {
  $("#appearance-popover").hidden = true;
  renderSettings();
  $("#settings-popover").hidden = !$("#settings-popover").hidden;
};
function syncDetailsToggle() {
  const open = $("#note-panel").classList.contains("open");
  $("#details-toggle").setAttribute("aria-pressed", String(open));
  $("#details-toggle").classList.toggle("active", open);
}
function selectOptions(options, selected) {
  return options
    .map(
      ([value, label]) =>
        `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`,
    )
    .join("");
}
function openItemSettingsDialog(section) {
  const node = map().nodes.find((item) => item.id === selectedNodeId);
  if (!node) return;
  itemSettingsSection = section;
  itemSettingsDirty = false;
  const fields = $("#item-settings-fields");
  const titles = {
    content: "Metinler",
    appearance: "Görünüm",
    layout: "Yerleşim",
    link: "Bağlantı",
  };
  $("#item-settings-title").textContent = titles[section] || "Ayarlar";
  if (section === "content") {
    fields.innerHTML = `<label>Başlık<input name="title" maxlength="100" value="${escapeAttribute(node.title || "")}"></label><label>Alt başlık<input name="subtitle" maxlength="160" value="${escapeAttribute(node.subtitle || "")}"></label><label>Not<textarea name="note" rows="5">${escapeHtml(node.note || "")}</textarea></label>`;
  } else if (section === "appearance") {
    fields.innerHTML = `<label>Renk<input name="color" type="color" value="${node.color || "#fff0a8"}"></label><label class="settings-check"><input name="noColor" type="checkbox" ${node.color ? "" : "checked"}> Renk kullanma</label><label>Yazı karakteri<select name="font">${selectOptions(
      [
        ["indie", "Indie Flower"],
        ["caveat", "Caveat"],
        ["patrick", "Patrick Hand"],
        ["kalam", "Kalam"],
        ["rounded", "Rounded"],
      ],
      node.font || "indie",
    )}</select></label><fieldset class="live-style-presets"><legend>Stil önizlemeleri</legend><div>${["soft", "note", "outline", "glass", "none", "borderless", "pill", "sketch", "solid"].map((style) => `<label class="style-preset-preview preview-${style}" title="${style}"><input type="radio" name="style" value="${style}" ${style === (node.style || "soft") ? "checked" : ""}><span><i></i><b></b></span></label>`).join("")}</div></fieldset>`;
  } else if (section === "layout") {
    fields.innerHTML = `<label>Hizalama<select name="align">${selectOptions(
      [
        ["left", "Sol"],
        ["center", "Orta"],
        ["right", "Sağ"],
      ],
      node.align || "center",
    )}</select></label><label>İçerik sırası<select name="layout">${selectOptions(
      [
        ["title-media-subtitle", "Başlık · İçerik · Alt"],
        ["title-subtitle-media", "Başlık · Alt · İçerik"],
        ["media-title-subtitle", "İçerik · Başlık · Alt"],
      ],
      node.layout || "media-title-subtitle",
    )}</select></label><label>Boyut<select name="size">${selectOptions(
      [
        ["small", "Small"],
        ["medium", "Medium"],
        ["large", "Large"],
      ],
      node.size || "medium",
    )}</select></label>`;
  } else {
    const link = nodeEditableLink(node);
    fields.innerHTML =
      link === null
        ? `<p class="settings-unavailable">Bu öğe yerel veri kullanıyor; düzenlenebilir harici bağlantısı yok.</p>`
        : `<label>Bağlantı<input name="link" type="${node.type === "map" ? "text" : "url"}" value="${escapeAttribute(link)}"></label>`;
  }
  $("#item-settings-dialog").showModal();
}
$("#details-toggle").onclick = () => {
  const panel = $("#note-panel");
  if (panel.classList.contains("open")) {
    panel.classList.remove("open");
  } else {
    renderNote();
    panel.classList.add("open");
  }
  syncDetailsToggle();
};
$$("#item-context-menu [data-detail-section]").forEach((button) => {
  button.onclick = () => {
    if (!selectedNodeId) return;
    $("#item-context-menu").hidden = true;
    openItemSettingsDialog(button.dataset.detailSection);
  };
});
$("#close-item-settings").onclick = $("#cancel-item-settings").onclick = () =>
  $("#item-settings-dialog").close();
function applyLiveItemSettings() {
  const node = map().nodes.find((item) => item.id === selectedNodeId);
  if (!node) return;
  const data = new FormData($("#item-settings-form"));
  if (itemSettingsSection === "link") {
    return;
  }
  if (!itemSettingsDirty) {
    snapshot();
    itemSettingsDirty = true;
  }
  if (itemSettingsSection === "content") {
    const nextTitle = String(data.get("title") || "").trim();
    if (nextTitle !== node.title) delete node.titleHtml;
    node.title = nextTitle;
    const nextSubtitle = String(data.get("subtitle") || "").trim();
    if (nextSubtitle !== (node.subtitle || "")) delete node.subtitleHtml;
    node.subtitle = nextSubtitle;
    node.note = String(data.get("note") || "");
  } else if (itemSettingsSection === "appearance") {
    node.color = data.get("noColor") ? null : String(data.get("color"));
    node.font = String(data.get("font"));
    node.style = String(data.get("style"));
  } else if (itemSettingsSection === "layout") {
    node.align = String(data.get("align"));
    node.layout = String(data.get("layout"));
    node.size = String(data.get("size"));
  }
  renderNodes();
  renderEdges();
  renderNote();
  scheduleSave();
}
$("#item-settings-form").oninput = applyLiveItemSettings;
$("#item-settings-form").onchange = applyLiveItemSettings;
$("#item-settings-form").onsubmit = (event) => {
  event.preventDefault();
  if (itemSettingsSection === "link") {
    const link = new FormData(event.currentTarget).get("link");
    if (link !== null) {
      $("#node-link").value = String(link);
      $("#node-link").dispatchEvent(new Event("change"));
    }
  } else applyLiveItemSettings();
  $("#item-settings-dialog").close();
};
$("#item-settings-dialog").addEventListener("pointerdown", (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});
$$("[data-style-group]").forEach(
  (select) =>
    (select.onchange = () => {
      const group = select.dataset.styleGroup;
      snapshot();
      map().appearance.itemStyles ||= { ...defaults.itemStyles };
      map().appearance.itemStyles[group] = select.value;
      if ($("#apply-group-existing").checked) {
        map()
          .nodes.filter((node) => (node.type || "text") === group)
          .forEach((node) => (node.style = select.value));
      }
      renderNodes();
      renderNote();
      scheduleSave();
    }),
);
$("#apply-all-style").onclick = () => {
  const style = $("#all-item-style").value;
  if (!style) {
    toast("Önce tüm öğeler için bir stil seç.");
    return;
  }
  snapshot();
  map().appearance.itemStyles = Object.fromEntries(
    Object.keys(defaults.itemStyles).map((group) => [group, style]),
  );
  map().nodes.forEach((node) => (node.style = style));
  renderAll();
  scheduleSave();
  toast("Stil tüm öğelere uygulandı.");
};
function closeSidebar() {
  $(".sidebar").classList.remove("open");
  document.body.classList.remove("sidebar-open");
  $("#sidebar-toggle").setAttribute("aria-expanded", "false");
  $("#sidebar-toggle").setAttribute("title", "Haritaları aç");
  $("#sidebar-toggle").setAttribute("aria-label", "Haritaları aç");
}
$("#sidebar-toggle").onclick = () => {
  const willOpen = !$(".sidebar").classList.contains("open");
  $(".sidebar").classList.toggle("open", willOpen);
  document.body.classList.toggle("sidebar-open", willOpen);
  $("#sidebar-toggle").setAttribute("aria-expanded", String(willOpen));
  $("#sidebar-toggle").setAttribute(
    "title",
    willOpen ? "Haritaları kapat" : "Haritaları aç",
  );
  $("#sidebar-toggle").setAttribute(
    "aria-label",
    willOpen ? "Haritaları kapat" : "Haritaları aç",
  );
};
$("#sidebar-close").onclick = closeSidebar;
$$(".popover-close").forEach(
  (b) => (b.onclick = () => (b.closest(".popover").hidden = true)),
);
function closeFloatingPanels(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (
    target?.closest(".popover") ||
    target?.closest(
      "#appearance-btn,#settings-btn,.node-more,.connector,#item-context-menu,#connection-mode-menu",
    )
  )
    return;
  $$(".popover").forEach((popover) => (popover.hidden = true));
  $("#item-context-menu").hidden = true;
  $("#connection-mode-menu").hidden = true;
}
document.addEventListener("pointerdown", closeFloatingPanels, true);
$$("[data-connection-mode]").forEach((button) => {
  button.onclick = () => {
    connectionMode = button.dataset.connectionMode;
    $("#connection-mode-menu").hidden = true;
    showToast(
      connectionMode === "draw"
        ? "Bağlantı noktasından diğer öğeye çiz"
        : "Bağlantı noktasını diğer öğeye sürükle",
    );
  };
});
$("#item-dialog").addEventListener("pointerdown", (event) => {
  const form = $("#item-form");
  const rect = form.getBoundingClientRect();
  const outside =
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom;
  if (outside) event.currentTarget.close();
});
$("#canvas-color").oninput = (e) =>
  mutateAppearance("canvasColor", e.target.value);
$("#pattern-color").oninput = (e) =>
  mutateAppearance("patternColor", e.target.value);
$("#arrow-color").oninput = (e) =>
  mutateAppearance("arrowColor", e.target.value);
$("#pattern-spacing").oninput = (e) =>
  mutateAppearance("spacing", Number(e.target.value));
$$("#theme-presets button").forEach(
  (button) => (button.onclick = () => applyTheme(button.dataset.theme)),
);
$$("#pattern-options button").forEach(
  (b) => (b.onclick = () => mutateAppearance("pattern", b.dataset.pattern)),
);
function updateSelectedEdge(key, value) {
  const edge = map().edges.find((e) => e.id === selectedEdgeId);
  if (!edge || edge[key] === value) return;
  snapshot();
  edge[key] = value;
  renderEdges();
  syncEdgePopover(edge);
  scheduleSave();
}
$("#edge-label").onchange = (e) =>
  updateSelectedEdge("label", e.target.value.trim());
$("#edge-color").onchange = (e) => updateSelectedEdge("color", e.target.value);
$$("#edge-color-presets button").forEach((button) => {
  button.onclick = () => updateSelectedEdge("color", button.dataset.color);
});
$("#edge-width").onpointerdown = () => snapshot();
$("#edge-width").oninput = (event) => {
  const edge = map().edges.find((item) => item.id === selectedEdgeId);
  if (!edge) return;
  edge.width = Number(event.target.value);
  $("#edge-width-output").value = `${edge.width}px`;
  renderEdges();
  scheduleSave();
};
$$("#edge-direction button").forEach(
  (b) =>
    (b.onclick = () => updateSelectedEdge("direction", b.dataset.direction)),
);
$$("#edge-line-style button").forEach(
  (b) => (b.onclick = () => updateSelectedEdge("lineStyle", b.dataset.style)),
);
$$("#edge-path-style button").forEach(
  (b) => (b.onclick = () => updateSelectedEdge("pathStyle", b.dataset.path)),
);
$("#delete-edge").onclick = () => {
  snapshot();
  map().edges = map().edges.filter((e) => e.id !== selectedEdgeId);
  selectedEdgeId = null;
  $("#edge-popover").hidden = true;
  renderAll();
  scheduleSave();
};
function updateNodeFromPanel() {
  const n = map().nodes.find((n) => n.id === selectedNodeId);
  if (!n) return;
  snapshot();
  const nextTitle = $("#note-title").value.trim();
  if (nextTitle !== n.title) delete n.titleHtml;
  n.title = nextTitle;
  const nextSubtitle = $("#note-subtitle").value.trim();
  if (nextSubtitle !== (n.subtitle || "")) delete n.subtitleHtml;
  n.subtitle = nextSubtitle;
  n.note = $("#note-text").value;
  n.tags = $("#note-tags")
    .value.split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  renderNodes();
  scheduleSave();
}
$("#note-title").onchange = updateNodeFromPanel;
$("#note-subtitle").onchange = updateNodeFromPanel;
$("#note-text").onchange = updateNodeFromPanel;
$("#note-tags").onchange = updateNodeFromPanel;
$("#node-link").onchange = async (event) => {
  const node = map().nodes.find((item) => item.id === selectedNodeId);
  if (!node) return;
  const value = event.target.value.trim();
  let nextUrl = null;
  let nextYoutubeId = null;
  let nextLocation = null;
  if (node.type === "youtube") nextYoutubeId = youtubeId(value);
  else if (node.type === "map") nextLocation = parseMapLocation(value);
  else if (node.type === "music") {
    nextYoutubeId = youtubeId(value);
    if (!nextYoutubeId) nextUrl = normalizeWebUrl(value);
  } else nextUrl = normalizeWebUrl(value);
  if (
    (node.type === "youtube" && !nextYoutubeId) ||
    (node.type === "map" && !nextLocation) ||
    (!["youtube", "map"].includes(node.type) && !nextYoutubeId && !nextUrl)
  ) {
    toast("Geçerli bir bağlantı gir.");
    renderNote();
    return;
  }
  snapshot();
  if (node.type === "youtube") node.mediaUrl = nextYoutubeId;
  else if (node.type === "map") node.mapLocation = nextLocation;
  else if (node.type === "music") {
    node.youtubeId = nextYoutubeId || null;
    node.mediaUrl = nextYoutubeId ? null : nextUrl;
  } else {
    node.mediaUrl = nextUrl;
    if (node.type === "website") {
      node.websiteMetadata = node.websitePreview
        ? await fetchWebsiteMetadata(nextUrl)
        : null;
    }
  }
  renderNodes();
  renderEdges();
  renderNote();
  scheduleSave();
};
$("#website-preview").onchange = async (event) => {
  const node = map().nodes.find((item) => item.id === selectedNodeId);
  if (!node || node.type !== "website") return;
  snapshot();
  node.websitePreview = event.target.checked;
  if (node.websitePreview && !node.websiteMetadata)
    node.websiteMetadata = await fetchWebsiteMetadata(node.mediaUrl);
  renderNodes();
  renderEdges();
  scheduleSave();
};
$("#node-font").onchange = (event) => {
  const node = map().nodes.find((item) => item.id === selectedNodeId);
  if (!node || node.font === event.target.value) return;
  snapshot();
  node.font = event.target.value;
  renderNodes();
  renderEdges();
  scheduleSave();
};
$("#node-font-size").onpointerdown = () => snapshot();
$("#node-font-size").oninput = (event) => {
  const node = map().nodes.find((item) => item.id === selectedNodeId);
  if (!node) return;
  node.fontSize = Number(event.target.value);
  $("#node-font-size-output").value = `${node.fontSize}px`;
  const element = $(`.mind-node[data-id="${node.id}"]`);
  if (element) {
    element.style.setProperty("--node-font-size", `${node.fontSize}px`);
    node.renderWidth = element.offsetWidth;
    node.renderHeight = element.offsetHeight;
  }
  renderEdges();
  scheduleSave();
};
$$("#node-style-options button").forEach(
  (button) =>
    (button.onclick = () => {
      const node = map().nodes.find((item) => item.id === selectedNodeId);
      if (!node || node.style === button.dataset.nodeStyle) return;
      snapshot();
      node.style = button.dataset.nodeStyle;
      renderNodes();
      renderNote();
      scheduleSave();
    }),
);
$$("#node-align-options button").forEach(
  (button) =>
    (button.onclick = () => {
      const node = map().nodes.find((item) => item.id === selectedNodeId);
      if (!node || (node.align || "center") === button.dataset.nodeAlign)
        return;
      snapshot();
      node.align = button.dataset.nodeAlign;
      renderNodes();
      renderEdges();
      renderNote();
      scheduleSave();
    }),
);
$$("#node-layout-options button").forEach(
  (button) =>
    (button.onclick = () => {
      const node = map().nodes.find((item) => item.id === selectedNodeId);
      if (!node || node.type === "text") return;
      if ((node.layout || "media-title-subtitle") === button.dataset.nodeLayout)
        return;
      snapshot();
      node.layout = button.dataset.nodeLayout;
      renderNodes();
      renderEdges();
      renderNote();
      scheduleSave();
    }),
);
$("#node-width").onpointerdown = () => snapshot();
$("#node-width").oninput = (event) => {
  const node = map().nodes.find((item) => item.id === selectedNodeId);
  if (!node || (node.type || "text") !== "text") return;
  node.customWidth = Number(event.target.value);
  node.renderWidth = node.customWidth;
  $("#node-width-output").value = `${node.customWidth}px`;
  const element = $(`.mind-node[data-id="${node.id}"]`);
  if (element) element.style.width = `${node.customWidth}px`;
  renderEdges();
  scheduleSave();
};
$("#node-width-auto").onclick = () => {
  const node = map().nodes.find((item) => item.id === selectedNodeId);
  if (!node) return;
  snapshot();
  delete node.customWidth;
  renderNodes();
  renderEdges();
  renderNote();
  scheduleSave();
};
$$("#node-size-options button").forEach(
  (button) =>
    (button.onclick = () => {
      const node = map().nodes.find((item) => item.id === selectedNodeId);
      if (!node || (node.size || "medium") === button.dataset.nodeSize) return;
      snapshot();
      node.size = button.dataset.nodeSize;
      renderNodes();
      renderEdges();
      renderNote();
      scheduleSave();
    }),
);
$$("#image-shape-options button").forEach(
  (button) =>
    (button.onclick = () => {
      const node = map().nodes.find((item) => item.id === selectedNodeId);
      if (!node || node.type !== "image") return;
      if ((node.imageShape || "original") === button.dataset.imageShape) return;
      snapshot();
      node.imageShape = button.dataset.imageShape;
      renderNodes();
      renderEdges();
      renderNote();
      scheduleSave();
    }),
);
$("#close-note").onclick = () => $("#details-toggle").click();
$("#delete-node").onclick = () => {
  if (!selectedNodeId) return;
  snapshot();
  map().nodes = map().nodes.filter((n) => n.id !== selectedNodeId);
  map().edges = map().edges.filter(
    (e) => e.sourceId !== selectedNodeId && e.targetId !== selectedNodeId,
  );
  selectedNodeId = null;
  renderAll();
  scheduleSave();
};
function zoom(delta) {
  map().viewport.zoom = Math.min(
    1.8,
    Math.max(0.45, map().viewport.zoom + delta),
  );
  renderViewport();
  scheduleSave();
}
$("#zoom-in").onclick = () => zoom(0.1);
$("#zoom-out").onclick = () => zoom(-0.1);
$("#fit-btn").onclick = () => {
  const nodes = map().nodes;
  if (!nodes.length) return;
  const r = canvas.getBoundingClientRect(),
    minX = Math.min(...nodes.map((n) => n.x)),
    minY = Math.min(...nodes.map((n) => n.y)),
    maxX = Math.max(...nodes.map((n) => n.x + nodeDimensions(n).width)),
    maxY = Math.max(...nodes.map((n) => n.y + nodeDimensions(n).height)),
    z = Math.min(
      1.2,
      (r.width - 100) / (maxX - minX),
      (r.height - 100) / (maxY - minY),
    );
  map().viewport = {
    zoom: z,
    x: (r.width - (maxX - minX) * z) / 2 - minX * z,
    y: (r.height - (maxY - minY) * z) / 2 - minY * z,
  };
  renderViewport();
  scheduleSave();
};
$("#undo-btn").onclick = () => {
  if (history.length) restore(history.pop());
};
$("#redo-btn").onclick = () => {
  if (!future.length) return;
  history.push(JSON.stringify(state));
  state = JSON.parse(future.pop());
  renderAll();
  scheduleSave();
};
window.addEventListener("keydown", (e) => {
  const target = e.target instanceof Element ? e.target : null;
  const isInlineEditing = Boolean(
    target?.closest('[contenteditable="true"]') ||
    document.activeElement?.isContentEditable,
  );
  if (
    !isInlineEditing &&
    (e.ctrlKey || e.metaKey) &&
    e.key.toLowerCase() === "z"
  ) {
    e.preventDefault();
    e.shiftKey ? $("#redo-btn").click() : $("#undo-btn").click();
  }
  if (
    (e.key === "Delete" || e.key === "Backspace") &&
    !isInlineEditing &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
  ) {
    selectedNodeId
      ? $("#delete-node").click()
      : selectedEdgeId && $("#delete-edge").click();
  }
  if (e.key === "Escape") {
    $$(".popover").forEach((x) => (x.hidden = true));
    $("#item-context-menu").hidden = true;
  }
});
$("#export-btn").onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `webmind-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};
$("#import-input").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.maps) || !data.maps.length) throw Error();
    snapshot();
    state = data;
    state.activeMapId = state.activeMapId || state.maps[0].id;
    renderAll();
    scheduleSave();
    toast("Harita başarıyla içe aktarıldı");
  } catch {
    toast("Bu dosya geçerli bir WebMind yedeği değil");
  } finally {
    e.target.value = "";
  }
};
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}
async function init() {
  try {
    const stored = await loadWorkspace();
    if (stored?.maps?.length) state = stored;
    else {
      const m = initialMap();
      state = { version: 1, activeMapId: m.id, maps: [m] };
    }
  } catch {
    const m = initialMap();
    state = { version: 1, activeMapId: m.id, maps: [m] };
    toast("Yerel veri deposu kullanılamadı");
  }
  renderAll();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http"))
    navigator.serviceWorker.register("./service-worker.js");
}
init();

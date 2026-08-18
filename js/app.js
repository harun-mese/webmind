import { loadWorkspace, saveWorkspace } from "./database.js";
import {
  buildEdgePath,
  formatBytes,
  nodeDimensions,
  normalizeWebUrl,
  parseMapLocation,
  readableInk,
  youtubeId,
} from "./item-utils.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
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
    textColor: "#f2eee6",
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
  pan = null,
  resize = null,
  pendingItemPosition = null,
  activeTitleEditor = null,
  savedTitleRange = null;
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
  renderEdges();
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
  nodeLayer.innerHTML = "";
  map().nodes.forEach((n) => {
    const el = document.createElement("article");
    const type = n.type || "text";
    const style = n.style || map().appearance.itemStyles?.[type] || "soft";
    const hasColor = Boolean(n.color);
    const nodeColor = n.color || "transparent";
    const nodeText = hasColor ? readableInk(n.color) : "var(--canvas-ink)";
    el.className = `mind-node item-${type} style-${style} font-${n.font || "indie"} size-${n.size || "medium"} ${hasColor ? "" : "no-color"} ${n.customWidth ? "manual-width" : ""} ${type !== "text" ? "media-node" : ""} ${n.id === selectedNodeId ? "selected" : ""}`;
    el.dataset.id = n.id;
    el.style.cssText = `left:${n.x}px;top:${n.y}px;--node-color:${nodeColor};--node-text:${nodeText};--node-font-size:${n.fontSize || 20}px;--title-align:${n.align || "center"}${n.customWidth ? `;width:${n.customWidth}px` : ""}`;
    el.innerHTML = `${renderNodeMedia(n)}<div class="node-title"></div><button class="connector" aria-label="${escapeAttribute(n.title)} öğesinden bağlantı oluştur"></button>${type === "text" ? '<button class="node-resize-handle" aria-label="Genişliği değiştir"></button>' : ""}`;
    const title = el.querySelector(".node-title");
    if (n.titleHtml) title.innerHTML = sanitizeRichText(n.titleHtml);
    else title.textContent = n.title;
    el.addEventListener("pointerdown", onNodeDown);
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      selectNodeWithoutReplacingDraggedElement(n.id);
    });
    el.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      editTitle(title, n);
    });
    el.querySelector(".connector").addEventListener("pointerdown", (e) =>
      startConnection(e, n),
    );
    el.querySelector(".node-resize-handle")?.addEventListener(
      "pointerdown",
      (e) => startResize(e, n, el),
    );
    nodeLayer.append(el);
    n.renderWidth = el.offsetWidth;
    n.renderHeight = el.offsetHeight;
  });
  $("#empty-state").hidden = map().nodes.length > 0;
}
function renderNodeMedia(node) {
  if (node.type === "image" && node.mediaUrl)
    return `<div class="node-media"><img src="${escapeAttribute(node.mediaUrl)}" alt="" draggable="false"></div>`;
  if (node.type === "youtube" && node.mediaUrl)
    return `<div class="node-media"><iframe src="https://www.youtube-nocookie.com/embed/${escapeAttribute(node.mediaUrl)}" title="${escapeAttribute(node.title)}" loading="lazy" allowfullscreen></iframe></div>`;
  if (node.type === "website" && node.mediaUrl) {
    const safeUrl = normalizeWebUrl(node.mediaUrl);
    if (!safeUrl) return "";
    const host = new URL(safeUrl).hostname.replace(/^www\./, "");
    return `<div class="node-media website-card"><span class="website-icon">◎</span><span><strong>${escapeHtml(host)}</strong><small>${escapeHtml(safeUrl)}</small></span></div>`;
  }
  if (node.type === "map" && node.mapLocation) {
    const { lat, lng } = node.mapLocation;
    const delta = 0.012;
    const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&marker=${lat}%2C${lng}`;
    return `<div class="node-media"><iframe class="map-frame" src="${escapeAttribute(src)}" title="${escapeAttribute(node.title)}" loading="lazy"></iframe></div>`;
  }
  if (node.type === "music" && node.mediaUrl)
    return `<div class="node-media music-card"><span class="music-art">♫</span><audio src="${escapeAttribute(node.mediaUrl)}" controls preload="metadata"></audio></div>`;
  if (node.type === "file")
    return `<div class="node-media file-card"><span class="file-card-icon">${fileIcon(node.fileType)}</span><span class="file-card-meta"><span class="file-card-name">${escapeHtml(node.fileName || "Dosya")}</span><span class="file-card-size">${formatBytes(node.fileSize || 0)}</span></span></div>`;
  return "";
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
  const allowed = new Set(["B", "STRONG", "U", "BR", "FONT"]);
  const clean = (parent) => {
    [...parent.childNodes].forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (!allowed.has(node.tagName)) {
        clean(node);
        node.replaceWith(...node.childNodes);
        return;
      }
      [...node.attributes].forEach((attribute) => {
        if (!(node.tagName === "FONT" && attribute.name === "color")) {
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
function editTitle(el, n) {
  el.contentEditable = "true";
  activeTitleEditor = el;
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  const original = n.title;
  const originalHtml = n.titleHtml || escapeHtml(n.title);
  const finish = (cancel) => {
    $("#rich-text-toolbar").hidden = true;
    activeTitleEditor = null;
    savedTitleRange = null;
    el.contentEditable = "false";
    const next = cancel ? original : el.textContent.trim();
    const formatted = sanitizeRichText(el.innerHTML);
    if (!cancel && next && (next !== n.title || formatted !== originalHtml)) {
      snapshot();
      n.title = next;
      n.titleHtml = formatted;
      scheduleSave();
      renderAll();
    } else el.innerHTML = originalHtml;
  };
  el.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      el.blur();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      finish(true);
    }
  };
  el.onblur = () => finish(false);
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
      applyRichCommand(button.dataset.richCommand);
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
  $("#note-panel").classList.add("open");
}
function selectNodeWithoutReplacingDraggedElement(id) {
  selectedNodeId = id;
  selectedEdgeId = null;
  $$(".mind-node").forEach((node) =>
    node.classList.toggle("selected", node.dataset.id === id),
  );
  renderEdges();
  renderNote();
  $("#note-panel").classList.add("open");
}
function onNodeDown(e) {
  if (
    e.target.classList.contains("connector") ||
    e.target.classList.contains("node-resize-handle") ||
    e.target.isContentEditable ||
    e.target.closest("audio")
  )
    return;
  e.stopPropagation();
  const n = map().nodes.find((n) => n.id === e.currentTarget.dataset.id);
  selectNodeWithoutReplacingDraggedElement(n.id);
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
  connect = { source: n.id, x: e.clientX, y: e.clientY };
  e.currentTarget.setPointerCapture(e.pointerId);
  renderEdges();
}
function renderEdges() {
  edgeRoot.setAttribute("transform", currentTransform().replaceAll("px", ""));
  edgeRoot.innerHTML = "";
  map().edges.forEach((edge) => {
    const a = map().nodes.find((n) => n.id === edge.sourceId),
      b = map().nodes.find((n) => n.id === edge.targetId);
    if (!a || !b) return;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute(
      "class",
      `edge-group ${edge.id === selectedEdgeId ? "selected" : ""}`,
    );
    g.dataset.id = edge.id;
    const p = buildEdgePath(a, b, edge.pathStyle);
    const dash =
      edge.lineStyle === "dashed"
        ? "9 7"
        : edge.lineStyle === "dotted"
          ? "2 7"
          : "";
    g.innerHTML = `<path class="edge-hit" d="${p}"/><path class="edge-visible" d="${p}" style="--edge-color:${edge.color};stroke-dasharray:${dash}" ${["forward", "both"].includes(edge.direction) ? 'marker-end="url(#arrow-end)"' : ""} ${["backward", "both"].includes(edge.direction) ? 'marker-start="url(#arrow-start)"' : ""}/>`;
    g.addEventListener("click", (e) => {
      e.stopPropagation();
      selectEdge(edge.id, e.clientX, e.clientY);
    });
    if (edge.label) {
      const ad = nodeDimensions(a),
        bd = nodeDimensions(b);
      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      text.setAttribute("class", "edge-label");
      text.setAttribute("x", (a.x + ad.width / 2 + b.x + bd.width / 2) / 2);
      text.setAttribute(
        "y",
        (a.y + ad.height / 2 + b.y + bd.height / 2) / 2 - 8,
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
}
function syncEdgePopover(edge) {
  $("#edge-label").value = edge.label || "";
  $("#edge-color").value = edge.color;
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
function renderNote() {
  const n = map().nodes.find((n) => n.id === selectedNodeId);
  $("#note-panel").classList.toggle("open", !!n);
  $(".note-empty").hidden = !!n;
  $(".note-content").hidden = !n;
  if (!n) return;
  $("#note-title").value = n.title;
  $("#note-text").value = n.note || "";
  $("#note-tags").value = (n.tags || []).join(", ");
  $("#node-font").value = n.font || "indie";
  $("#node-font-size").value = n.fontSize || 20;
  $("#node-font-size-output").value = `${n.fontSize || 20}px`;
  const isText = (n.type || "text") === "text";
  $("#node-width-field").hidden = !isText;
  $("#node-size-field").hidden = isText;
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
  const attachment = $("#open-attachment");
  const attachmentUrl =
    n.type === "map" && n.mapLocation
      ? `https://www.openstreetmap.org/?mlat=${n.mapLocation.lat}&mlon=${n.mapLocation.lng}#map=15/${n.mapLocation.lat}/${n.mapLocation.lng}`
      : n.mediaUrl;
  attachment.hidden = !attachmentUrl || n.type === "image";
  if (!attachment.hidden) {
    attachment.href =
      n.type === "youtube"
        ? `https://www.youtube.com/watch?v=${n.mediaUrl}`
        : attachmentUrl;
    attachment.download = ["file", "music"].includes(n.type)
      ? n.fileName || "dosya"
      : "";
  }
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
    const el = $(`.mind-node[data-id="${n.id}"] .node-title`);
    editTitle(el, n);
  }, 0);
});
canvas.addEventListener("pointerdown", (e) => {
  if (e.target !== canvas) return;
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
    renderEdges();
  }
  if (drag) {
    const n = map().nodes.find((n) => n.id === drag.id);
    n.x = drag.x + (e.clientX - drag.startX) / map().viewport.zoom;
    n.y = drag.y + (e.clientY - drag.startY) / map().viewport.zoom;
    drag.moved = true;
    const element = $(`.mind-node[data-id="${drag.id}"]`);
    if (element) {
      element.style.left = `${n.x}px`;
      element.style.top = `${n.y}px`;
    }
    renderEdges();
  }
  if (connect) {
    connect.x = e.clientX;
    connect.y = e.clientY;
    renderEdges();
  }
  if (pan) {
    map().viewport.x = pan.vx + e.clientX - pan.x;
    map().viewport.y = pan.vy + e.clientY - pan.y;
    renderViewport();
  }
});
window.addEventListener("pointerup", (e) => {
  if (resize) {
    resize = null;
    scheduleSave();
  }
  if (drag) {
    if (drag.moved) scheduleSave();
    else history.pop();
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
  setItemType("text");
  $("#item-dialog").showModal();
  requestAnimationFrame(() => $("#item-title").focus());
}
function setItemType(type) {
  $("#item-type").value = type;
  $$(".item-type").forEach((button) =>
    button.classList.toggle("active", button.dataset.type === type),
  );
  const needsUrl = ["youtube", "website", "map"].includes(type);
  const needsFile = ["image", "file", "music"].includes(type);
  $("#item-url-field").hidden = !needsUrl;
  $("#item-file-field").hidden = !needsFile;
  $("#item-url").type = type === "map" ? "text" : "url";
  $("#item-url").placeholder =
    type === "youtube"
      ? "https://youtube.com/watch?v=…"
      : type === "website"
        ? "https://example.com"
        : "41.0082, 28.9784 veya harita bağlantısı";
  $("#item-file").accept =
    type === "image" ? "image/*" : type === "music" ? "audio/*" : "";
  $("#item-file-label").textContent =
    type === "image"
      ? "Bir görsel seç"
      : type === "music"
        ? "Bir müzik dosyası seç"
        : "Dosya seç veya buraya bırak";
}
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
async function createItemFromDialog() {
  const type = $("#item-type").value,
    file = $("#item-file").files[0],
    position = pendingItemPosition || { x: 300, y: 200 },
    node = {
      id: uid(),
      type,
      style: map().appearance.itemStyles?.[type] || "soft",
      title:
        $("#item-title").value.trim() ||
        {
          text: "Yeni fikir",
          image: "Yeni görsel",
          youtube: "YouTube videosu",
          file: file?.name || "Yeni dosya",
          website: "Web sitesi",
          map: "Harita konumu",
          music: file?.name || "Müzik",
        }[type],
      x: position.x - (type === "text" ? 78 : 115),
      y: position.y - 31,
      color: COLORS[map().nodes.length % COLORS.length],
      note: "",
      tags: [],
    };
  if (["image", "file", "music"].includes(type)) {
    if (!file) throw new Error("Lütfen bir dosya seç.");
    const maxSize = type === "music" ? 24 : 12;
    if (file.size > maxSize * 1024 * 1024)
      throw new Error(`Dosya en fazla ${maxSize} MB olabilir.`);
    node.mediaUrl = await readFileAsDataUrl(file);
    node.fileName = file.name;
    node.fileType = file.type;
    node.fileSize = file.size;
  }
  if (type === "youtube") {
    node.mediaUrl = youtubeId($("#item-url").value.trim());
    if (!node.mediaUrl) throw new Error("Geçerli bir YouTube bağlantısı gir.");
  }
  if (type === "website") {
    node.mediaUrl = normalizeWebUrl($("#item-url").value.trim());
    if (!node.mediaUrl)
      throw new Error("Geçerli bir web sitesi bağlantısı gir.");
  }
  if (type === "map") {
    node.mapLocation = parseMapLocation($("#item-url").value.trim());
    if (!node.mapLocation)
      throw new Error("Geçerli bir enlem ve boylam gir: 41.0082, 28.9784");
  }
  snapshot();
  map().nodes.push(node);
  selectedNodeId = node.id;
  $("#item-dialog").close();
  renderAll();
  scheduleSave();
}
$("#add-item-btn").onclick = () => openItemDialog();
$$(".item-type").forEach(
  (button) => (button.onclick = () => setItemType(button.dataset.type)),
);
$("#close-item-dialog").onclick = $("#cancel-item").onclick = () =>
  $("#item-dialog").close();
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
    target?.closest("#appearance-btn,#settings-btn")
  )
    return;
  $$(".popover").forEach((popover) => (popover.hidden = true));
}
document.addEventListener("pointerdown", closeFloatingPanels, true);
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
  const nextTitle = $("#note-title").value.trim() || n.title;
  if (nextTitle !== n.title) delete n.titleHtml;
  n.title = nextTitle;
  n.note = $("#note-text").value;
  n.tags = $("#note-tags")
    .value.split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  renderNodes();
  scheduleSave();
}
$("#note-title").onchange = updateNodeFromPanel;
$("#note-text").onchange = updateNodeFromPanel;
$("#note-tags").onchange = updateNodeFromPanel;
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
$("#close-note").onclick = () => {
  $("#note-panel").classList.remove("open");
  selectedNodeId = null;
  renderAll();
};
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

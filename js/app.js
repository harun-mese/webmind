import { loadWorkspace, saveWorkspace } from "./database.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const COLORS = [
  "#fff0a8",
  "#ffd5c7",
  "#d9edc5",
  "#cde7f5",
  "#ddd6fa",
  "#f8d7ec",
];
const defaults = {
  canvasColor: "#fbf8f0",
  patternColor: "#d8d1c3",
  pattern: "dots",
  spacing: 24,
  arrowColor: "#6d685f",
};
const initialMap = () => ({
  id: uid(),
  title: "İlk Haritam",
  appearance: { ...defaults },
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [
    {
      id: uid(),
      title: "Ana fikir",
      x: 340,
      y: 220,
      color: COLORS[0],
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
  pan = null;
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
      renderAll();
      scheduleSave();
    };
    $("#map-list").append(b);
  });
}
function renderAppearance() {
  const a = map().appearance;
  canvas.className = `canvas pattern-${a.pattern}`;
  canvas.style.setProperty("--canvas", a.canvasColor);
  canvas.style.setProperty("--pattern", a.patternColor);
  canvas.style.setProperty("--spacing", `${a.spacing}px`);
  canvas.style.setProperty("--arrow", a.arrowColor);
  $("#canvas-color").value = a.canvasColor;
  $("#pattern-color").value = a.patternColor;
  $("#pattern-spacing").value = a.spacing;
  $("#spacing-output").value = `${a.spacing}px`;
  $("#arrow-color").value = a.arrowColor;
  $$("#pattern-options button").forEach((b) =>
    b.classList.toggle("active", b.dataset.pattern === a.pattern),
  );
}
function renderNodes() {
  nodeLayer.style.transform = currentTransform();
  nodeLayer.innerHTML = "";
  map().nodes.forEach((n) => {
    const el = document.createElement("article");
    el.className = `mind-node ${n.id === selectedNodeId ? "selected" : ""}`;
    el.dataset.id = n.id;
    el.style.cssText = `left:${n.x}px;top:${n.y}px;--node-color:${n.color}`;
    el.innerHTML = `<div class="node-title"></div><button class="connector" aria-label="${escapeHtml(n.title)} öğesinden bağlantı oluştur"></button>`;
    const title = el.querySelector(".node-title");
    title.textContent = n.title;
    el.addEventListener("pointerdown", onNodeDown);
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      selectNode(n.id);
    });
    el.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      editTitle(title, n);
    });
    el.querySelector(".connector").addEventListener("pointerdown", (e) =>
      startConnection(e, n),
    );
    nodeLayer.append(el);
  });
  $("#empty-state").hidden = map().nodes.length > 0;
}
function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
function editTitle(el, n) {
  el.contentEditable = "true";
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  const original = n.title;
  const finish = (cancel) => {
    el.contentEditable = "false";
    const next = cancel ? original : el.textContent.trim();
    if (next && next !== n.title) {
      snapshot();
      n.title = next;
      scheduleSave();
      renderAll();
    } else el.textContent = n.title;
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
  if (e.target.classList.contains("connector") || e.target.isContentEditable)
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
function startConnection(e, n) {
  e.stopPropagation();
  e.preventDefault();
  snapshot();
  connect = { source: n.id, x: e.clientX, y: e.clientY };
  e.currentTarget.setPointerCapture(e.pointerId);
  renderEdges();
}
function pathFor(a, b, style = "curved") {
  const aw = 156,
    ah = 62,
    bw = 156,
    bh = 62;
  let x1 = a.x + aw / 2,
    y1 = a.y + ah / 2,
    x2 = b.x + bw / 2,
    y2 = b.y + bh / 2;
  const dx = x2 - x1,
    dy = y2 - y1;
  if (Math.abs(dx) > Math.abs(dy)) {
    x1 += (Math.sign(dx) * aw) / 2;
    x2 -= (Math.sign(dx) * bw) / 2;
  } else {
    y1 += (Math.sign(dy) * ah) / 2;
    y2 -= (Math.sign(dy) * bh) / 2;
  }
  if (style === "straight") return `M${x1},${y1} L${x2},${y2}`;
  if (style === "elbow")
    return `M${x1},${y1} L${(x1 + x2) / 2},${y1} L${(x1 + x2) / 2},${y2} L${x2},${y2}`;
  const bend = Math.max(35, Math.abs(dx) * 0.45);
  return `M${x1},${y1} C${x1 + Math.sign(dx || 1) * bend},${y1} ${x2 - Math.sign(dx || 1) * bend},${y2} ${x2},${y2}`;
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
    const p = pathFor(a, b, edge.pathStyle);
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
      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      text.setAttribute("class", "edge-label");
      text.setAttribute("x", (a.x + b.x + 156) / 2);
      text.setAttribute("y", (a.y + b.y + 62) / 2 - 8);
      text.textContent = edge.label;
      g.append(text);
    }
    edgeRoot.append(g);
  });
  if (connect) {
    const s = map().nodes.find((n) => n.id === connect.source),
      p = screenToWorld(connect.x, connect.y),
      temp = document.createElementNS("http://www.w3.org/2000/svg", "path");
    temp.setAttribute("class", "temp-edge");
    temp.setAttribute("d", `M${s.x + 156},${s.y + 31} L${p.x},${p.y}`);
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
  $(".note-empty").hidden = !!n;
  $(".note-content").hidden = !n;
  if (!n) return;
  $("#note-title").value = n.title;
  $("#note-text").value = n.note || "";
  $("#note-tags").value = (n.tags || []).join(", ");
  $("#node-colors").innerHTML = COLORS.map(
    (c) =>
      `<button class="swatch ${c === n.color ? "active" : ""}" data-color="${c}" style="background:${c}" aria-label="Renk seç"></button>`,
  ).join("");
  $$(".swatch").forEach(
    (b) =>
      (b.onclick = () => {
        snapshot();
        n.color = b.dataset.color;
        renderAll();
        scheduleSave();
      }),
  );
}
function mutateAppearance(key, value) {
  snapshot();
  map().appearance[key] = value;
  renderAppearance();
  scheduleSave();
}
canvas.addEventListener("dblclick", (e) => {
  if (e.target !== canvas && e.target !== nodeLayer) return;
  const p = screenToWorld(e.clientX, e.clientY);
  snapshot();
  const n = {
    id: uid(),
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
  renderAll();
  pan = {
    x: e.clientX,
    y: e.clientY,
    vx: map().viewport.x,
    vy: map().viewport.y,
  };
  canvas.setPointerCapture(e.pointerId);
});
window.addEventListener("pointermove", (e) => {
  if (drag) {
    const n = map().nodes.find((n) => n.id === drag.id);
    n.x = drag.x + (e.clientX - drag.startX) / map().viewport.zoom;
    n.y = drag.y + (e.clientY - drag.startY) / map().viewport.zoom;
    drag.moved = true;
    renderNodes();
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
    renderNodes();
    renderEdges();
  }
});
window.addEventListener("pointerup", (e) => {
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
    renderAll();
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
$("#appearance-btn").onclick = () => {
  $("#appearance-popover").hidden = !$("#appearance-popover").hidden;
};
$$(".popover-close").forEach(
  (b) => (b.onclick = () => (b.closest(".popover").hidden = true)),
);
$("#canvas-color").oninput = (e) =>
  mutateAppearance("canvasColor", e.target.value);
$("#pattern-color").oninput = (e) =>
  mutateAppearance("patternColor", e.target.value);
$("#arrow-color").oninput = (e) =>
  mutateAppearance("arrowColor", e.target.value);
$("#pattern-spacing").oninput = (e) =>
  mutateAppearance("spacing", Number(e.target.value));
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
  n.title = $("#note-title").value.trim() || n.title;
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
  renderAll();
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
    maxX = Math.max(...nodes.map((n) => n.x + 156)),
    maxY = Math.max(...nodes.map((n) => n.y + 62)),
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
  renderAll();
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
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    e.shiftKey ? $("#redo-btn").click() : $("#undo-btn").click();
  }
  if (
    (e.key === "Delete" || e.key === "Backspace") &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
  ) {
    selectedNodeId
      ? $("#delete-node").click()
      : selectedEdgeId && $("#delete-edge").click();
  }
  if (e.key === "Escape") {
    $$("#appearance-popover,#edge-popover").forEach((x) => (x.hidden = true));
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

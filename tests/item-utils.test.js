import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEdgePath,
  buildFreehandPath,
  formatBytes,
  freehandEndpointGuides,
  nodeDimensions,
  nodeBoundaryPoint,
  normalizeWebUrl,
  parseMapLocation,
  readableInk,
  youtubeId,
} from "../js/item-utils.js";

test("YouTube watch, short and embed URLs are normalized", () => {
  const id = "dQw4w9WgXcQ";
  assert.equal(youtubeId(`https://www.youtube.com/watch?v=${id}`), id);
  assert.equal(youtubeId(`https://youtu.be/${id}`), id);
  assert.equal(youtubeId(`https://youtube.com/shorts/${id}`), id);
  assert.equal(youtubeId(`https://youtube.com/embed/${id}`), id);
  assert.equal(youtubeId(`https://music.youtube.com/watch?v=${id}`), id);
});

test("untrusted or malformed video URLs are rejected", () => {
  assert.equal(youtubeId("not a url"), null);
  assert.equal(youtubeId("https://example.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(youtubeId("https://youtube.com/watch?v=bad"), null);
});

test("website URLs and map coordinates are normalized safely", () => {
  assert.equal(
    normalizeWebUrl("https://example.com/page"),
    "https://example.com/page",
  );
  assert.equal(normalizeWebUrl("javascript:alert(1)"), null);
  assert.deepEqual(parseMapLocation("41.0082, 28.9784"), {
    lat: 41.0082,
    lng: 28.9784,
  });
  assert.deepEqual(parseMapLocation("https://maps.example/@40.7,-74.0,12z"), {
    lat: 40.7,
    lng: -74,
  });
  assert.equal(parseMapLocation("999, 999"), null);
});

test("item sizes reflect their rich media layout", () => {
  assert.deepEqual(nodeDimensions({ type: "text" }), {
    width: 156,
    height: 62,
  });
  assert.deepEqual(nodeDimensions({ type: "image" }), {
    width: 230,
    height: 230,
  });
  assert.deepEqual(nodeDimensions({ type: "youtube" }), {
    width: 230,
    height: 180,
  });
  assert.deepEqual(nodeDimensions({ type: "file" }), {
    width: 230,
    height: 105,
  });
  assert.deepEqual(nodeDimensions({ type: "website" }), {
    width: 260,
    height: 125,
  });
  assert.deepEqual(nodeDimensions({ type: "map" }), {
    width: 280,
    height: 220,
  });
  assert.deepEqual(nodeDimensions({ type: "music" }), {
    width: 270,
    height: 125,
  });
  assert.deepEqual(nodeDimensions({ type: "recording" }), {
    width: 270,
    height: 125,
  });
  assert.deepEqual(nodeDimensions({ type: "text", width: 244, height: 74 }), {
    width: 244,
    height: 74,
  });
  assert.deepEqual(
    nodeDimensions({ type: "image", renderWidth: 320, renderHeight: 280 }),
    { width: 320, height: 280 },
  );
});

test("file sizes are human readable", () => {
  assert.equal(formatBytes(0), "Dosya");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2 KB");
  assert.equal(formatBytes(1572864), "1.5 MB");
});

test("curved edges expose a directional tangent for arrow markers", () => {
  const down = buildEdgePath(
    { type: "text", x: 0, y: 0 },
    { type: "text", x: 0, y: 200 },
  );
  const up = buildEdgePath(
    { type: "text", x: 0, y: 200 },
    { type: "text", x: 0, y: 0 },
  );
  assert.equal(down, "M78,74 C78,131 78,151.52 78,188");
  assert.equal(up, "M78,188 C78,131 78,110.48 78,74");

  const diagonal = buildEdgePath(
    { type: "text", x: 0, y: 0 },
    { type: "text", x: 160, y: 100 },
  );
  const values = diagonal.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const controlX = values.at(-4);
  const controlY = values.at(-3);
  const endX = values.at(-2);
  const endY = values.at(-1);
  const tangentX = endX - controlX;
  const tangentY = endY - controlY;
  assert.ok(Math.abs(tangentX * 100 - tangentY * 160) < 1);
});

test("vertical elbow paths enter from the top or bottom edge", () => {
  assert.equal(
    buildEdgePath(
      { type: "text", x: 0, y: 0 },
      { type: "text", x: 100, y: 200 },
      "elbow",
    ),
    "M98.87,72.73 L98.87,131 L157.13,131 L157.13,189.27",
  );
});

test("decorative edge paths keep directional endpoints", () => {
  const source = { id: "source", type: "text", x: 0, y: 0 };
  const target = { id: "target", type: "text", x: 360, y: 120 };
  const wavy = buildEdgePath(source, target, "wavy");
  const curved = buildEdgePath(source, target, "curved");
  const zigzag = buildEdgePath(source, target, "zigzag");
  assert.ok((wavy.match(/ C/g) || []).length >= 3);
  assert.equal((curved.match(/ C/g) || []).length, 1);
  assert.ok((zigzag.match(/ L/g) || []).length >= 4);
  for (const path of [wavy, zigzag]) {
    const values = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const tangentX = values.at(-2) - values.at(-4);
    const tangentY = values.at(-1) - values.at(-3);
    assert.ok(Math.abs(tangentX * 120 - tangentY * 360) < 2);
  }
});

test("freehand points become a smooth editable SVG path", () => {
  assert.equal(buildFreehandPath([]), "");
  assert.equal(
    buildFreehandPath([
      { x: 0, y: 0 },
      { x: 20, y: 15 },
      { x: 40, y: 5 },
      { x: 60, y: 20 },
    ]),
    "M0,0 Q20,15 30,10 Q40,5 50,12.5 L60,20",
  );
});

test("drawn arrows attach to the approached side of each item", () => {
  const node = { type: "text", x: 100, y: 100 };
  assert.deepEqual(nodeBoundaryPoint(node, { x: 400, y: 131 }), {
    x: 268,
    y: 131,
  });
  assert.deepEqual(nodeBoundaryPoint(node, { x: 178, y: 400 }), {
    x: 178,
    y: 174,
  });
});

test("drawn arrow endpoint guides ignore noisy points beside items", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 2, y: 1 },
    { x: 8, y: 4 },
    { x: 45, y: 30 },
    { x: 92, y: 48 },
    { x: 100, y: 50 },
  ];
  assert.deepEqual(freehandEndpointGuides(points), {
    start: points[3],
    end: points[3],
  });
});

test("toolbar ink remains readable against light and dark canvases", () => {
  assert.equal(readableInk("#fbf8f0"), "#292722");
  assert.equal(readableInk("#17181b"), "#fffdf8");
  assert.equal(readableInk("invalid"), "#302e29");
});

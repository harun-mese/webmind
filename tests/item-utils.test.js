import test from "node:test";
import assert from "node:assert/strict";
import { formatBytes, nodeDimensions, youtubeId } from "../js/item-utils.js";

test("YouTube watch, short and embed URLs are normalized", () => {
  const id = "dQw4w9WgXcQ";
  assert.equal(youtubeId(`https://www.youtube.com/watch?v=${id}`), id);
  assert.equal(youtubeId(`https://youtu.be/${id}`), id);
  assert.equal(youtubeId(`https://youtube.com/shorts/${id}`), id);
  assert.equal(youtubeId(`https://youtube.com/embed/${id}`), id);
});

test("untrusted or malformed video URLs are rejected", () => {
  assert.equal(youtubeId("not a url"), null);
  assert.equal(youtubeId("https://example.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(youtubeId("https://youtube.com/watch?v=bad"), null);
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
});

test("file sizes are human readable", () => {
  assert.equal(formatBytes(0), "Dosya");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2 KB");
  assert.equal(formatBytes(1572864), "1.5 MB");
});

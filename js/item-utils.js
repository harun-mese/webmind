export function formatBytes(bytes) {
  if (!bytes) return "Dosya";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function nodeDimensions(node) {
  if (node.type === "image") return { width: 230, height: 230 };
  if (node.type === "youtube") return { width: 230, height: 180 };
  if (node.type === "file") return { width: 230, height: 105 };
  return { width: 156, height: 62 };
}

export function buildEdgePath(source, target, style = "curved") {
  const sourceSize = nodeDimensions(source);
  const targetSize = nodeDimensions(target);
  let x1 = source.x + sourceSize.width / 2;
  let y1 = source.y + sourceSize.height / 2;
  let x2 = target.x + targetSize.width / 2;
  let y2 = target.y + targetSize.height / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const horizontal = Math.abs(dx) > Math.abs(dy);

  if (horizontal) {
    x1 += (Math.sign(dx) * sourceSize.width) / 2;
    x2 -= (Math.sign(dx) * targetSize.width) / 2;
  } else {
    y1 += (Math.sign(dy) * sourceSize.height) / 2;
    y2 -= (Math.sign(dy) * targetSize.height) / 2;
  }

  if (style === "straight") return `M${x1},${y1} L${x2},${y2}`;
  if (style === "elbow") {
    return horizontal
      ? `M${x1},${y1} L${(x1 + x2) / 2},${y1} L${(x1 + x2) / 2},${y2} L${x2},${y2}`
      : `M${x1},${y1} L${x1},${(y1 + y2) / 2} L${x2},${(y1 + y2) / 2} L${x2},${y2}`;
  }

  if (horizontal) {
    const bend = Math.min(
      Math.max(35, Math.abs(dx) * 0.35),
      Math.max(18, Math.abs(x2 - x1) / 2),
    );
    return `M${x1},${y1} C${x1 + Math.sign(dx || 1) * bend},${y1} ${x2 - Math.sign(dx || 1) * bend},${y2} ${x2},${y2}`;
  }
  const bend = Math.min(
    Math.max(35, Math.abs(dy) * 0.35),
    Math.max(18, Math.abs(y2 - y1) / 2),
  );
  return `M${x1},${y1} C${x1},${y1 + Math.sign(dy || 1) * bend} ${x2},${y2 - Math.sign(dy || 1) * bend} ${x2},${y2}`;
}

export function youtubeId(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, "");
    let id = null;
    if (hostname === "youtu.be") id = url.pathname.slice(1).split("/")[0];
    if (["youtube.com", "m.youtube.com"].includes(hostname)) {
      if (
        url.pathname.startsWith("/shorts/") ||
        url.pathname.startsWith("/embed/")
      ) {
        id = url.pathname.split("/")[2];
      } else {
        id = url.searchParams.get("v");
      }
    }
    return /^[\w-]{6,20}$/.test(id || "") ? id : null;
  } catch {
    return null;
  }
}

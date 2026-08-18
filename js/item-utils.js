export function formatBytes(bytes) {
  if (!bytes) return "Dosya";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function nodeDimensions(node) {
  if (Number.isFinite(node.renderWidth) && Number.isFinite(node.renderHeight)) {
    return { width: node.renderWidth, height: node.renderHeight };
  }
  if (Number.isFinite(node.width) && Number.isFinite(node.height)) {
    return { width: node.width, height: node.height };
  }
  if (node.type === "image") return { width: 230, height: 230 };
  if (node.type === "youtube") return { width: 230, height: 180 };
  if (node.type === "file") return { width: 230, height: 105 };
  if (node.type === "website") return { width: 260, height: 125 };
  if (node.type === "map") return { width: 280, height: 220 };
  if (node.type === "music") return { width: 270, height: 125 };
  return { width: 156, height: 62 };
}

export function normalizeWebUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function parseMapLocation(value) {
  const coordinateMatch = value.match(
    /(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)/,
  );
  if (!coordinateMatch) return null;
  const lat = Number(coordinateMatch[1]);
  const lng = Number(coordinateMatch[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
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
  const gap = 12;

  if (horizontal) {
    x1 += Math.sign(dx) * (sourceSize.width / 2 + gap);
    x2 -= Math.sign(dx) * (targetSize.width / 2 + gap);
  } else {
    y1 += Math.sign(dy) * (sourceSize.height / 2 + gap);
    y2 -= Math.sign(dy) * (targetSize.height / 2 + gap);
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

export function readableInk(hexColor) {
  const hex = hexColor.replace("#", "");
  if (!/^[\da-f]{6}$/i.test(hex)) return "#302e29";
  const luminance = relativeLuminance(hex);
  const dark = "292722";
  const light = "fffdf8";
  const darkContrast = contrastRatio(luminance, relativeLuminance(dark));
  const lightContrast = contrastRatio(luminance, relativeLuminance(light));
  return darkContrast >= lightContrast ? `#${dark}` : `#${light}`;
}

function relativeLuminance(hex) {
  return [0, 2, 4]
    .map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    );
}

function contrastRatio(first, second) {
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
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

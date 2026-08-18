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
  if (node.type === "recording") return { width: 270, height: 125 };
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
  const sourceCenter = {
    x: source.x + sourceSize.width / 2,
    y: source.y + sourceSize.height / 2,
  };
  const targetCenter = {
    x: target.x + targetSize.width / 2,
    y: target.y + targetSize.height / 2,
  };
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const unitX = dx / distance;
  const unitY = dy / distance;
  const horizontal = Math.abs(dx) > Math.abs(dy);
  const gap = 12;
  const rayDistance = (size) =>
    Math.min(
      Math.abs(unitX) > 0.0001 ? size.width / 2 / Math.abs(unitX) : Infinity,
      Math.abs(unitY) > 0.0001 ? size.height / 2 / Math.abs(unitY) : Infinity,
    );
  const sourceDistance = rayDistance(sourceSize) + gap;
  const targetDistance = rayDistance(targetSize) + gap;
  const round = (value) => Math.round(value * 100) / 100;
  const x1 = round(sourceCenter.x + unitX * sourceDistance);
  const y1 = round(sourceCenter.y + unitY * sourceDistance);
  const x2 = round(targetCenter.x - unitX * targetDistance);
  const y2 = round(targetCenter.y - unitY * targetDistance);

  if (style === "straight") return `M${x1},${y1} L${x2},${y2}`;
  if (style === "elbow") {
    return horizontal
      ? `M${x1},${y1} L${(x1 + x2) / 2},${y1} L${(x1 + x2) / 2},${y2} L${x2},${y2}`
      : `M${x1},${y1} L${x1},${(y1 + y2) / 2} L${x2},${(y1 + y2) / 2} L${x2},${y2}`;
  }

  const pathDistance = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
  const travel = Math.min(110, Math.max(24, pathDistance * 0.34));
  const curve = Math.min(72, Math.max(0, pathDistance * 0.16));
  const normalX = -unitY;
  const normalY = unitX;
  const middleX = round((x1 + x2) / 2 + normalX * curve);
  const middleY = round((y1 + y2) / 2 + normalY * curve);
  const middleHandle = Math.min(48, travel * 0.45);
  const control1X = round(x1 + unitX * travel);
  const control1Y = round(y1 + unitY * travel);
  const middleInX = round(middleX - unitX * middleHandle);
  const middleInY = round(middleY - unitY * middleHandle);
  const middleOutX = round(middleX + unitX * middleHandle);
  const middleOutY = round(middleY + unitY * middleHandle);
  const control2X = round(x2 - unitX * travel);
  const control2Y = round(y2 - unitY * travel);
  return `M${x1},${y1} C${control1X},${control1Y} ${middleInX},${middleInY} ${middleX},${middleY} C${middleOutX},${middleOutY} ${control2X},${control2Y} ${x2},${y2}`;
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
    if (
      ["youtube.com", "m.youtube.com", "music.youtube.com"].includes(hostname)
    ) {
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

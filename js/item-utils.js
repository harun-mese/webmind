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

export function nodeBoundaryPoint(node, toward, gap = 12) {
  const size = nodeDimensions(node);
  const center = {
    x: node.x + size.width / 2,
    y: node.y + size.height / 2,
  };
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const unitX = dx / distance;
  const unitY = dy / distance;
  const edgeDistance = Math.min(
    Math.abs(unitX) > 0.0001 ? size.width / 2 / Math.abs(unitX) : Infinity,
    Math.abs(unitY) > 0.0001 ? size.height / 2 / Math.abs(unitY) : Infinity,
  );
  return {
    x: Math.round((center.x + unitX * (edgeDistance + gap)) * 100) / 100,
    y: Math.round((center.y + unitY * (edgeDistance + gap)) * 100) / 100,
  };
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

export function buildFreehandPath(points = []) {
  const clean = points.filter(
    (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y),
  );
  if (clean.length < 2) return "";
  const round = (value) => Math.round(value * 100) / 100;
  const kept = [clean[0]];
  for (let index = 1; index < clean.length - 1; index += 1) {
    const previous = kept.at(-1);
    const point = clean[index];
    if (Math.hypot(point.x - previous.x, point.y - previous.y) >= 3) {
      kept.push(point);
    }
  }
  kept.push(clean.at(-1));
  if (kept.length === 2) {
    return `M${round(kept[0].x)},${round(kept[0].y)} L${round(kept[1].x)},${round(kept[1].y)}`;
  }
  let path = `M${round(kept[0].x)},${round(kept[0].y)}`;
  for (let index = 1; index < kept.length - 1; index += 1) {
    const point = kept[index];
    const next = kept[index + 1];
    path += ` Q${round(point.x)},${round(point.y)} ${round((point.x + next.x) / 2)},${round((point.y + next.y) / 2)}`;
  }
  const last = kept.at(-1);
  return `${path} L${round(last.x)},${round(last.y)}`;
}

export function freehandEndpointGuides(points = [], distance = 32) {
  if (points.length < 2) return { start: null, end: null };
  const first = points[0];
  const last = points.at(-1);
  const start =
    points.find(
      (point, index) =>
        index > 0 &&
        Math.hypot(point.x - first.x, point.y - first.y) >= distance,
    ) || points[Math.min(1, points.length - 1)];
  const end =
    points
      .slice(0, -1)
      .reverse()
      .find(
        (point) => Math.hypot(point.x - last.x, point.y - last.y) >= distance,
      ) || points[Math.max(0, points.length - 2)];
  return { start, end };
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
  const normalX = -unitY;
  const normalY = unitX;
  if (style === "wavy") {
    const waves = Math.max(3, Math.min(7, Math.round(pathDistance / 90)));
    const amplitude = Math.min(28, Math.max(12, pathDistance * 0.08));
    let path = `M${x1},${y1}`;
    let previous = { x: x1, y: y1, offset: 0 };
    for (let index = 1; index <= waves; index += 1) {
      const progress = index / waves;
      const offset = index === waves ? 0 : (index % 2 ? 1 : -1) * amplitude;
      const next = {
        x: round(x1 + (x2 - x1) * progress + normalX * offset),
        y: round(y1 + (y2 - y1) * progress + normalY * offset),
        offset,
      };
      const step = pathDistance / waves / 3;
      const control1X = round(previous.x + unitX * step);
      const control1Y = round(previous.y + unitY * step);
      const control2X = round(next.x - unitX * step);
      const control2Y = round(next.y - unitY * step);
      path += ` C${control1X},${control1Y} ${control2X},${control2Y} ${next.x},${next.y}`;
      previous = next;
    }
    return path;
  }
  if (style === "zigzag") {
    const turns = Math.max(4, Math.min(8, Math.round(pathDistance / 75)));
    const amplitude = Math.min(30, Math.max(14, pathDistance * 0.09));
    let path = `M${x1},${y1}`;
    for (let index = 1; index < turns; index += 1) {
      const progress = index / turns;
      const offset = (index % 2 ? 1 : -1) * amplitude;
      path += ` L${round(x1 + (x2 - x1) * progress + normalX * offset)},${round(y1 + (y2 - y1) * progress + normalY * offset)}`;
    }
    const finalLead = Math.min(28, pathDistance * 0.12);
    return `${path} L${round(x2 - unitX * finalLead)},${round(y2 - unitY * finalLead)} L${x2},${y2}`;
  }
  if (horizontal) {
    const middleX = round((x1 + x2) / 2);
    const lead = Math.min(64, pathDistance * 0.32);
    return `M${x1},${y1} C${middleX},${y1} ${round(x2 - unitX * lead)},${round(y2 - unitY * lead)} ${x2},${y2}`;
  }
  const middleY = round((y1 + y2) / 2);
  const lead = Math.min(64, pathDistance * 0.32);
  return `M${x1},${y1} C${x1},${middleY} ${round(x2 - unitX * lead)},${round(y2 - unitY * lead)} ${x2},${y2}`;
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

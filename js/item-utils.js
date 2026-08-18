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

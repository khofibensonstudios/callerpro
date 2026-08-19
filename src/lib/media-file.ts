export function isVideoFile(file: File) {
  if (file.type.startsWith("video/")) return true;
  return /\.(mp4|mov|m4v|webm|qt)$/i.test(file.name || "");
}

export function isImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name || "");
}

export function mediaFormData(file: File, kind: "video" | "image") {
  const fd = new FormData();
  fd.append("file", file);
  return fd;
}

export function sniffMedia(bytes: Uint8Array, name: string, type: string) {
  const t = (type || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (t.startsWith("audio/") || /\.(ogg|mp3|m4a|wav|weba)$/.test(n) || n.includes("voice-") || t === "audio/webm") {
    if (n.endsWith(".mp3") || t.includes("mpeg")) return { kind: "audio" as const, ext: "mp3", mime: "audio/mpeg" };
    if (n.endsWith(".m4a") || (t.includes("mp4") && t.startsWith("audio")))
      return { kind: "audio" as const, ext: "m4a", mime: "audio/mp4" };
    return { kind: "audio" as const, ext: "weba", mime: "audio/webm" };
  }
  if (t.startsWith("video/") || /\.(mp4|mov|m4v|webm|qt)$/.test(n)) {
    return n.endsWith(".webm") || t.includes("webm")
      ? { kind: "video" as const, ext: "webm", mime: "video/webm" }
      : n.endsWith(".mov") || t.includes("quicktime")
        ? { kind: "video" as const, ext: "mov", mime: "video/quicktime" }
        : { kind: "video" as const, ext: "mp4", mime: "video/mp4" };
  }
  if (t.startsWith("image/") || /\.(jpe?g|png|gif|webp|heic|heif)$/.test(n)) {
    if (n.endsWith(".png") || t.includes("png")) return { kind: "image" as const, ext: "png", mime: "image/png" };
    return { kind: "image" as const, ext: "jpg", mime: "image/jpeg" };
  }
  if (bytes.length >= 12) {
    const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (ftyp === "ftyp") {
      const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).replace(/\0/g, " ");
      if (/heic|heix|mif1|msf1|hevc/i.test(brand)) return { kind: "image" as const, ext: "jpg", mime: "image/jpeg" };
      if (brand.startsWith("qt")) return { kind: "video" as const, ext: "mov", mime: "video/quicktime" };
      return { kind: "video" as const, ext: "mp4", mime: "video/mp4" };
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return { kind: "image" as const, ext: "jpg", mime: "image/jpeg" };
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return { kind: "image" as const, ext: "png", mime: "image/png" };
  }
  return null;
}

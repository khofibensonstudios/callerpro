import fs from "fs";
import path from "path";
import { fileRangeResponse } from "@/lib/file-range";

function mediaType(name: string) {
  if (name.endsWith(".weba")) return "audio/webm";
  if (name.endsWith(".mp3")) return "audio/mpeg";
  if (name.endsWith(".m4a")) return "audio/mp4";
  if (name.endsWith(".ogg")) return "audio/ogg";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp")) return "image/jpeg";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return new Response("Not found", { status: 404 });
  const file = path.join(process.cwd(), "data", "media", name);
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });
  return fileRangeResponse(file, req, mediaType(name));
}

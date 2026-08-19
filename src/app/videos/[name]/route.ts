import fs from "fs";
import path from "path";
import { fileRangeResponse } from "@/lib/file-range";

const ALLOWED = new Set(["a.mp4", "b.mp4", "c.mp4"]);

function findFile(name: string) {
  const candidates = [
    path.join(process.cwd(), "public", "videos", name),
    path.join(process.cwd(), "web", "public", "videos", name),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!ALLOWED.has(name)) return new Response("Not found", { status: 404 });
  const file = findFile(name);
  if (!file) return new Response("Not found", { status: 404 });
  return fileRangeResponse(file, req, "video/mp4");
}

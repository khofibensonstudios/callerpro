import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { json, options } from "@/lib/http";
import { userIdFromRequest } from "@/lib/auth";
import { sniffMedia } from "@/lib/media-file";

export const runtime = "nodejs";

export function OPTIONS() {
  return options();
}

function uploadedBlob(value: FormDataEntryValue | null) {
  if (!value || typeof value === "string") return null;
  const blob = value as Blob & { name?: string };
  if (typeof blob.arrayBuffer !== "function" || blob.size < 1) return null;
  return blob;
}

export async function POST(req: Request) {
  const me = await userIdFromRequest(req);
  if (!me) return json({ error: "Sign in required." }, 401);
  let form: FormData | null = null;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "The video is too large for this connection. Try a shorter clip." }, 413);
  }
  const file = uploadedBlob(form.get("file"));
  if (!file) return json({ error: "The video did not arrive. Try posting again." }, 400);
  if (file.size > 80 * 1024 * 1024) return json({ error: "That file is too large." }, 400);
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length < 32) return json({ error: "The video did not arrive complete. Try posting again." }, 400);
  const sniffed = sniffMedia(new Uint8Array(buf.subarray(0, 32)), file.name || "", file.type || "") || {
    kind: "video" as const,
    ext: "mp4",
    mime: "video/mp4",
  };
  const name = `${crypto.randomUUID()}.${sniffed.ext}`;
  const dir = path.join(process.cwd(), "data", "media");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return json({ url: `/api/media/${name}` });
}

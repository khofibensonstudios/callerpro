import fs from "fs";

function webStream(node: fs.ReadStream, req: Request) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const stop = () => {
        try {
          node.destroy();
        } catch {
          /* already closed */
        }
      };
      const close = () => {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        stop();
      };

      node.on("data", (chunk: Buffer | string) => {
        try {
          const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
          controller.enqueue(new Uint8Array(bytes));
        } catch {
          stop();
        }
      });
      node.on("end", close);
      node.on("error", () => {
        try {
          controller.error(new Error("read failed"));
        } catch {
          /* already closed */
        }
        stop();
      });
      req.signal?.addEventListener("abort", close, { once: true });
    },
    cancel() {
      try {
        node.destroy();
      } catch {
        /* already closed */
      }
    },
  });
}

export function fileRangeResponse(file: string, req: Request, contentType: string) {
  const stat = fs.statSync(file);
  const range = req.headers.get("range");
  const common = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
  };

  if (!range) {
    return new Response(webStream(fs.createReadStream(file), req), {
      headers: {
        ...common,
        "Content-Length": String(stat.size),
      },
    });
  }

  const match = /bytes=(\d+)-(\d*)/.exec(range);
  if (!match) return new Response("Invalid range", { status: 416 });
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : Math.min(start + 1024 * 1024 - 1, stat.size - 1);
  if (start >= stat.size || start > end) {
    return new Response("Invalid range", {
      status: 416,
      headers: { "Content-Range": `bytes */${stat.size}` },
    });
  }
  const stop = Math.min(end, stat.size - 1);
  const len = stop - start + 1;
  return new Response(webStream(fs.createReadStream(file, { start, end: stop }), req), {
    status: 206,
    headers: {
      ...common,
      "Content-Range": `bytes ${start}-${stop}/${stat.size}`,
      "Content-Length": String(len),
    },
  });
}

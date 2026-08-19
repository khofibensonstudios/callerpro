export function dataUrlToResponse(dataUrl: string | undefined) {
  if (!dataUrl) return new Response("Not found", { status: 404 });
  if (!dataUrl.startsWith("data:")) {
    return Response.redirect(dataUrl, 302);
  }
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "public, max-age=86400",
    },
  });
}

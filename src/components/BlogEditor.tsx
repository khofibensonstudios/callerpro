"use client";

import { useRef } from "react";
import { ImagePlus, Link2 } from "lucide-react";
import { fileToJpeg } from "@/lib/resize-image";

export function BlogEditor({ onChange }: { onChange: (html: string) => void }) {
  const editor = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);

  function sync() {
    onChange(editor.current?.innerHTML || "");
  }

  function insertLink() {
    const href = window.prompt("Paste the link");
    if (!href) return;
    editor.current?.focus();
    document.execCommand("createLink", false, href);
    sync();
  }

  async function insertImage(file: File | undefined) {
    if (!file) return;
    const src = await fileToJpeg(file, 1200, 0.8);
    editor.current?.focus();
    document.execCommand("insertHTML", false, `<p><img src="${src}" alt="" /></p><p><br></p>`);
    sync();
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-fb-bg">
      <div className="flex flex-wrap gap-1 border-b border-black/5 px-2 py-2">
        <button type="button" onClick={insertLink} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold">
          <Link2 className="h-4 w-4 text-accent" />
          Insert link
        </button>
        <button
          type="button"
          onClick={() => imageInput.current?.click()}
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold"
        >
          <ImagePlus className="h-4 w-4 text-accent" />
          Insert image
        </button>
        <button
          type="button"
          onClick={() => imageInput.current?.click()}
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold"
        >
          <ImagePlus className="h-4 w-4 text-accent" />
          Add another image
        </button>
        <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(e) => insertImage(e.target.files?.[0])} />
      </div>
      <div
        ref={editor}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        className="min-h-[calc(100dvh-24rem)] px-4 py-4 text-[17px] leading-8 outline-none empty:before:text-fb-muted empty:before:content-[attr(data-placeholder)] [&_img]:my-3 [&_img]:max-h-80 [&_img]:w-full [&_img]:rounded-xl [&_img]:object-cover [&_a]:text-accent [&_a]:underline"
        data-placeholder="Write the article"
      />
    </div>
  );
}

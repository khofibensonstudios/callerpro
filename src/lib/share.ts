export async function copyUrl(url: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return "copied" as const;
    }
  } catch {
    /* insecure context */
  }
  const field = document.createElement("textarea");
  field.value = url;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.left = "-9999px";
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  field.remove();
  return "copied" as const;
}

export async function shareUrl(url: string) {
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ url });
      return "shared" as const;
    }
  } catch {
    /* cancelled or blocked */
  }
  return copyUrl(url);
}

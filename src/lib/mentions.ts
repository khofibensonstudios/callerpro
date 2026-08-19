export function mentionedUsers<T extends { id: string; name: string }>(body: string, users: T[]) {
  const lower = body.toLowerCase();
  return users.filter((u) => {
    const name = u.name.toLowerCase().trim();
    if (!name) return false;
    return lower.includes(`@${name}`) || lower.includes(`@${name.replace(/\s+/g, "")}`);
  });
}

export function mentionQuery(text: string) {
  const at = text.lastIndexOf("@");
  if (at < 0) return null;
  const before = text[at - 1];
  if (before && !/\s/.test(before)) return null;
  const token = text.slice(at + 1);
  if (token.includes("\n")) return null;
  return token;
}

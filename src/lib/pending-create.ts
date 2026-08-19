export type CreateMediaKind = "note" | "video";

let pending: { kind: CreateMediaKind; file: File } | null = null;

export function stashCreateMedia(kind: CreateMediaKind, file: File) {
  pending = { kind, file };
}

export function peekCreateMedia() {
  return pending;
}

export function takeCreateMedia() {
  return pending;
}

export function clearCreateMedia() {
  pending = null;
}

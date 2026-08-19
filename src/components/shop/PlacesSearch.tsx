"use client";

import { useEffect, useState } from "react";

type Prediction = { placeId: string; label: string };

export function PlacesSearch({
  value,
  onPick,
  onClear,
}: {
  value: string;
  onPick: (next: { label: string; lat: number; lng: number }) => void;
  onClear?: () => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Prediction[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || q === value) {
      setItems([]);
      return;
    }
    const t = window.setTimeout(() => {
      setBusy(true);
      fetch(`/api/places/autocomplete?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.error) {
            setError(d.error);
            setItems([]);
            return;
          }
          setError("");
          setItems(d.predictions ?? []);
          setOpen(true);
        })
        .catch(() => setError("Could not search places."))
        .finally(() => setBusy(false));
    }, 280);
    return () => window.clearTimeout(t);
  }, [query, value]);

  async function pick(item: Prediction) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(item.placeId)}`);
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Could not load that place.");
      return;
    }
    setQuery(d.label);
    setOpen(false);
    setItems([]);
    onPick({ label: d.label, lat: d.lat, lng: d.lng });
  }

  return (
    <div className="relative mt-3">
      <input
        className="h-12 w-full rounded-xl border border-black/15 bg-white px-4 text-[15px] outline-none focus:border-[#141414]"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (e.target.value !== value) onClear?.();
        }}
        onFocus={() => items.length && setOpen(true)}
        placeholder="Search a place"
        autoComplete="off"
      />
      {open && items.length ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/10">
          {items.map((item) => (
            <li key={item.placeId}>
              <button
                type="button"
                onClick={() => void pick(item)}
                className="flex w-full px-4 py-3 text-left text-[14px] leading-5 hover:bg-black/5"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {busy ? <p className="mt-2 text-[12px] text-fb-muted">Searching</p> : null}
      {error ? <p className="mt-2 text-[12px] text-[#ff3b30]">{error}</p> : null}
    </div>
  );
}

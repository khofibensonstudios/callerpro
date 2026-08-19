"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "./Avatar";
import { useAuth } from "./AuthProvider";

type Person = {
  id: string;
  name: string;
  headline?: string;
  avatarHue: number;
  avatarUrl?: string;
};

export function PeopleTagger({
  selected,
  onChange,
}: {
  selected: Person[];
  onChange: (people: Person[]) => void;
}) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    fetch("/api/creators")
      .then((r) => r.json())
      .then((d) => setPeople((d.creators ?? []).filter((p: Person) => p.id !== user?.id)));
  }, [user]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 1) return [];
    return people.filter((p) => p.name.toLowerCase().includes(query)).slice(0, 8);
  }, [people, q]);

  function toggle(person: Person) {
    if (selected.some((p) => p.id === person.id)) onChange(selected.filter((p) => p.id !== person.id));
    else onChange([...selected, person].slice(0, 12));
  }

  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-fb-muted uppercase">Tag people</p>
      {selected.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p)}
              className="flex items-center gap-2 rounded-full bg-[#f4f1eb] py-1 pr-3 pl-1 text-sm"
            >
              <Avatar name={p.name} hue={p.avatarHue} src={p.avatarUrl} size={22} />
              {p.name}
            </button>
          ))}
        </div>
      ) : null}
      <input
        className="mt-2 h-11 w-full rounded-xl bg-[#f4f1eb] px-3 text-sm outline-none"
        placeholder="Type a name to tag"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {q.trim() && results.length ? (
        <ul className="mt-2 max-h-48 overflow-y-auto">
          {results.map((p) => {
            const on = selected.some((s) => s.id === p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left ${on ? "bg-[#f4f1eb]" : "hover:bg-[#faf8f4]"}`}
                >
                  <Avatar name={p.name} hue={p.avatarHue} src={p.avatarUrl} size={36} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className="block truncate text-xs text-fb-muted">{p.headline}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

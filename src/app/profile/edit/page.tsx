"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteChrome } from "@/components/SiteChrome";
import { useAuth } from "@/components/AuthProvider";
import { ChevronLeft } from "lucide-react";
import { SKILLS } from "@/lib/constants";

const field =
  "mt-2 h-12 w-full border-0 border-b border-[#141414]/20 bg-transparent text-lg outline-none transition focus:border-accent";

export default function EditProfilePage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [callerId, setCallerId] = useState("");
  const [form, setForm] = useState({ name: "", headline: "", bio: "", skills: [] as string[] });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/me", { credentials: "include" }).then(async (r) => {
      if (!r.ok) {
        setReady(true);
        return;
      }
      const d = await r.json();
      const u = d.user;
      if (!u) {
        setReady(true);
        return;
      }
      setCallerId(u.callerId || "");
      setForm({
        name: u.name || "",
        headline: u.headline || "",
        bio: u.bio || "",
        skills: u.skills || [],
      });
      setReady(true);
    });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      await refresh();
      router.push("/profile");
    }
  }

  function toggleSkill(skill: string) {
    setForm((s) => ({
      ...s,
      skills: s.skills.includes(skill) ? s.skills.filter((x) => x !== skill) : [...s.skills, skill].slice(0, 8),
    }));
  }

  return (
    <SiteChrome variant="page">
      <div className="rounded-2xl bg-white px-5 py-6 shadow-sm md:px-10 md:py-10">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => router.push("/profile")} className="-ml-2 grid h-10 w-10 place-items-center" aria-label="Back">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">Edit profile</h1>
        </div>

        {ready ? (
          <form onSubmit={submit} className="mt-10 max-w-lg space-y-8">
            <label className="block">
              <span className="text-xs tracking-wide text-[#6f6a64] uppercase">Name</span>
              <input
                className={field}
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-xs tracking-wide text-[#6f6a64] uppercase">Caller ID</span>
              <input className={`${field} tracking-[0.18em] text-[#6f6a64]`} value={callerId} readOnly tabIndex={-1} />
              <span className="mt-2 block text-xs text-[#8a8580]">This is how people search for you. It cannot be changed.</span>
            </label>
            <label className="block">
              <span className="text-xs tracking-wide text-[#6f6a64] uppercase">Headline</span>
              <input
                className={field}
                value={form.headline}
                onChange={(e) => setForm((s) => ({ ...s, headline: e.target.value }))}
                placeholder="What you make, in one line"
              />
            </label>
            <label className="block">
              <span className="text-xs tracking-wide text-[#6f6a64] uppercase">About</span>
              <textarea
                className="mt-2 min-h-28 w-full resize-none border-0 border-b border-[#141414]/20 bg-transparent py-2 text-lg leading-7 outline-none transition focus:border-accent"
                value={form.bio}
                onChange={(e) => setForm((s) => ({ ...s, bio: e.target.value }))}
                placeholder="A short bio people see on your profile"
              />
            </label>
            <div>
              <p className="text-xs tracking-wide text-[#6f6a64] uppercase">Skills</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {SKILLS.map((skill) => {
                  const on = form.skills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className={`rounded-full px-4 py-2 text-sm ${
                        on ? "bg-[#141414] text-white" : "bg-[#f4f1eb] text-[#141414]"
                      }`}
                    >
                      {skill}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-5 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="h-12 rounded-full bg-[#141414] px-8 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving" : "Save"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-10 h-40 rounded-xl bg-[#f4f1eb]" />
        )}
      </div>
    </SiteChrome>
  );
}

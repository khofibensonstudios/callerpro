"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { SiteChrome } from "@/components/SiteChrome";
import { useAuth } from "@/components/AuthProvider";
import { PlacesSearch } from "@/components/shop/PlacesSearch";
import { SHOP_CATEGORIES, SHOP_SOCIALS, type Shop, type ShopSocials } from "@/lib/shop-shared";

const STEPS = ["Name", "Category", "Logo", "Location", "Selling", "Contact", "Review"] as const;

const field =
  "mt-3 h-12 w-full rounded-xl border border-black/15 bg-white px-4 text-[15px] outline-none focus:border-[#141414]";

function startStep(shop: Shop | null) {
  if (!shop || shop.status === "off") return 0;
  if (!shop.name.trim()) return 0;
  if (!shop.category) return 1;
  if (!shop.logoUrl) return 2;
  if (!shop.location.trim()) return 3;
  if (!shop.sells.trim()) return 4;
  return 6;
}

export function ShopSetup() {
  const router = useRouter();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [sells, setSells] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [socials, setSocials] = useState<ShopSocials>({});
  const [socialPick, setSocialPick] = useState<string[]>([]);
  const [socialOpen, setSocialOpen] = useState(false);
  const [placePicked, setPlacePicked] = useState(false);

  function apply(s: Shop | null) {
    setShop(s);
    setName(s?.name || user?.name || "");
    setCategory(s?.category || "");
    setLogoUrl(s?.logoUrl || "");
    setLocation(s?.location || "");
    setLat(s?.locationLat);
    setLng(s?.locationLng);
    setPlacePicked(Boolean(s?.location?.trim() && s?.locationLat != null && s?.locationLng != null));
    setSells(s?.sells || "");
    setEmail(s?.email || "");
    setPhone(s?.phone || "");
    setSocials(s?.socials || {});
    setSocialPick(SHOP_SOCIALS.filter((row) => s?.socials?.[row.id]).map((row) => row.id));
  }

  useEffect(() => {
    fetch("/api/shop/mine", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const s = (d.shop ?? null) as Shop | null;
        apply(s);
        setStep(startStep(s));
        setReady(true);
      })
      .catch(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

  const status = shop?.status || "off";
  const on = status !== "off";
  const wizard = on && status !== "pending" && status !== "verified";

  async function setEnabled(enabled: boolean) {
    setBusy(true);
    const res = await fetch("/api/shop/mine", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return;
    apply(d.shop);
    if (enabled) setStep(0);
  }

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch("/api/shop/mine", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return null;
    apply(d.shop);
    return d.shop as Shop;
  }

  async function next() {
    if (step === 0) {
      if (name.trim().length < 2) return;
      await patch({ name: name.trim() });
    } else if (step === 1) {
      if (!category) return;
      await patch({ category });
    } else if (step === 2) {
      if (!logoUrl) return;
      await patch({ logoUrl });
    } else if (step === 3) {
      if (!placePicked || !location.trim()) return;
      await patch({ location: location.trim(), locationLat: lat ?? null, locationLng: lng ?? null });
    } else if (step === 4) {
      if (!sells.trim()) return;
      await patch({ sells: sells.trim() });
    } else if (step === 5) {
      if (!email.includes("@") || phone.replace(/\D/g, "").length < 7) return;
      await patch({ email: email.trim(), phone: phone.trim(), socials });
    }
    setStep((s) => Math.min(s + 1, 6));
  }

  async function submit() {
    const saved = await patch({
      name: name.trim(),
      category,
      logoUrl,
      location: location.trim(),
      locationLat: lat ?? null,
      locationLng: lng ?? null,
      sells: sells.trim(),
      email: email.trim(),
      phone: phone.trim(),
      socials,
      submit: true,
    });
    if (saved) setStep(0);
  }

  async function uploadLogo(file?: File) {
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: form });
    const d = await res.json();
    setBusy(false);
    if (res.ok && d.url) {
      setLogoUrl(d.url);
      await patch({ logoUrl: d.url });
    }
  }

  const canNext =
    (step === 0 && name.trim().length >= 2) ||
    (step === 1 && Boolean(category)) ||
    (step === 2 && Boolean(logoUrl)) ||
    (step === 3 && placePicked && location.trim().length >= 2) ||
    (step === 4 && sells.trim().length >= 2) ||
    (step === 5 && email.includes("@") && phone.replace(/\D/g, "").length >= 7);

  return (
    <SiteChrome variant="wide">
      <div className="px-5 pt-2 pb-10">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (wizard && step > 0) setStep((s) => s - 1);
              else router.push("/settings");
            }}
            className="-ml-2 grid h-10 w-10 place-items-center"
            aria-label="Back"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold tracking-tight">{wizard ? "Set up shop" : "Shop"}</h1>
        </div>

        {!ready ? <p className="mt-6 text-sm text-fb-muted">Loading</p> : null}

        {ready && !wizard ? (
          <div className="mt-6">
            <div className="rounded-2xl bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-semibold">Enable shop</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  disabled={busy}
                  onClick={() => void setEnabled(!on)}
                  className={`relative h-8 w-[52px] shrink-0 rounded-full border ${
                    on ? "border-[#141414] bg-[#141414]" : "border-black/25 bg-[#f4f1eb]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-[left] ${
                      on ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            {status === "pending" ? (
              <div className="mt-8">
                <p className="text-xs font-semibold tracking-wide text-fb-muted uppercase">Status</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">Account pending</p>
              </div>
            ) : null}

            {status === "verified" ? (
              <div className="mt-8 space-y-3">
                <p className="text-xs font-semibold tracking-wide text-fb-muted uppercase">Status</p>
                <p className="text-3xl font-bold tracking-tight">On</p>
                <button
                  type="button"
                  onClick={() => user && router.push(`/shop/u/${user.id}`)}
                  className="mt-4 flex h-12 w-full items-center justify-between rounded-xl bg-white px-4 text-left text-sm font-semibold"
                >
                  Visit shop
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/shop/manage/products")}
                  className="flex h-12 w-full items-center justify-between rounded-xl bg-white px-4 text-left text-sm font-semibold"
                >
                  Products
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {ready && wizard ? (
          <div className="mt-5">
            {status === "rejected" ? (
              <p className="mb-4 text-sm font-semibold text-red-700">Not approved — update your details and submit again.</p>
            ) : null}
            <div className="flex gap-1">
              {STEPS.map((label, i) => (
                <span key={label} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-[#141414]" : "bg-black/10"}`} />
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold tracking-wide text-fb-muted uppercase">
              {step + 1} / {STEPS.length} · {STEPS[step]}
            </p>

            {step === 0 ? (
              <div className="mt-6">
                <p className="text-[15px] font-semibold">Shop name</p>
                <input className={field} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
              </div>
            ) : null}

            {step === 1 ? (
              <div className="mt-6">
                <p className="text-[15px] font-semibold">Category</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SHOP_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`h-10 rounded-full px-4 text-sm font-semibold ${
                        category === c ? "bg-[#141414] text-white" : "bg-white text-[#141414]"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="mt-6">
                <p className="text-[15px] font-semibold">Logo</p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-3 grid h-36 w-36 place-items-center overflow-hidden rounded-2xl bg-white"
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold text-fb-muted">Upload</span>
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    void uploadLogo(file);
                  }}
                />
              </div>
            ) : null}

            {step === 3 ? (
              <div className="mt-6">
                <p className="text-[15px] font-semibold">Location</p>
                <PlacesSearch
                  value={location}
                  onPick={({ label, lat: nextLat, lng: nextLng }) => {
                    setLocation(label);
                    setLat(nextLat);
                    setLng(nextLng);
                    setPlacePicked(true);
                  }}
                  onClear={() => setPlacePicked(false)}
                />
              </div>
            ) : null}

            {step === 4 ? (
              <div className="mt-6">
                <p className="text-[15px] font-semibold">What you sell</p>
                <textarea
                  className="mt-3 min-h-28 w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-[15px] outline-none focus:border-[#141414]"
                  value={sells}
                  onChange={(e) => setSells(e.target.value)}
                  maxLength={400}
                />
              </div>
            ) : null}

            {step === 5 ? (
              <div className="mt-6 space-y-4">
                <p className="text-[15px] font-semibold">Contact details</p>
                <label className="block">
                  <span className="text-xs font-semibold tracking-wide text-fb-muted uppercase">Email</span>
                  <input
                    className={field}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={120}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold tracking-wide text-fb-muted uppercase">Number</span>
                  <input
                    className={field}
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={40}
                  />
                </label>
                {SHOP_SOCIALS.filter((row) => socialPick.includes(row.id)).map((row) => (
                  <label key={row.id} className="block">
                    <span className="text-xs font-semibold tracking-wide text-fb-muted uppercase">{row.label}</span>
                    <input
                      className={field}
                      value={socials[row.id] || ""}
                      onChange={(e) => setSocials((s) => ({ ...s, [row.id]: e.target.value }))}
                      placeholder="URL"
                      maxLength={200}
                    />
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => setSocialOpen(true)}
                  className="h-12 w-full rounded-xl bg-white text-sm font-semibold"
                >
                  Add socials
                </button>
              </div>
            ) : null}

            {step === 6 ? (
              <div className="mt-6">
                <p className="text-[15px] font-semibold">Review</p>
                <ul className="mt-3 divide-y divide-black/10 overflow-hidden rounded-2xl bg-white">
                  <ReviewRow label="Name" value={name} />
                  <ReviewRow label="Category" value={category} />
                  <li className="flex items-center gap-3 px-4 py-3">
                    <span className="w-24 shrink-0 text-[13px] text-fb-muted">Logo</span>
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <span className="text-sm font-medium">—</span>
                    )}
                  </li>
                  <ReviewRow label="Location" value={location} />
                  <ReviewRow label="Selling" value={sells} />
                  <ReviewRow label="Email" value={email} />
                  <ReviewRow label="Number" value={phone} />
                  {SHOP_SOCIALS.filter((row) => socials[row.id]).map((row) => (
                    <ReviewRow key={row.id} label={row.label} value={socials[row.id]} />
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-8 flex items-center justify-end gap-3">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="h-11 rounded-xl bg-white px-5 text-sm font-semibold"
                >
                  Previous
                </button>
              ) : null}
              {step < 6 ? (
                <button
                  type="button"
                  disabled={busy || !canNext}
                  onClick={() => void next()}
                  className="h-11 rounded-xl bg-[#141414] px-6 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submit()}
                  className="h-11 rounded-xl bg-[#141414] px-6 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Submit
                </button>
              )}
            </div>

            {socialOpen
              ? createPortal(
                  <div className="fixed inset-0 z-[400] flex items-end bg-black/40" onClick={() => setSocialOpen(false)}>
                    <div
                      className="w-full rounded-t-2xl bg-[#f4f1eb] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/20" />
                      <div className="flex items-center justify-between">
                        <p className="text-base font-semibold">Socials</p>
                        <button type="button" onClick={() => setSocialOpen(false)} className="grid h-9 w-9 place-items-center" aria-label="Close">
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <ul className="mt-3 divide-y divide-black/10 overflow-hidden rounded-2xl bg-white">
                        {SHOP_SOCIALS.map((row) => {
                          const on = socialPick.includes(row.id);
                          return (
                            <li key={row.id}>
                              <button
                                type="button"
                                onClick={() =>
                                  setSocialPick((list) => (on ? list.filter((id) => id !== row.id) : [...list, row.id]))
                                }
                                className="flex h-12 w-full items-center justify-between px-4 text-left text-[15px] font-medium"
                              >
                                {row.label}
                                <span className="text-[13px] text-fb-muted">{on ? "Added" : "Add"}</span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      <button
                        type="button"
                        onClick={() => {
                          setSocials((s) => {
                            const next = { ...s };
                            for (const row of SHOP_SOCIALS) {
                              if (!socialPick.includes(row.id)) delete next[row.id];
                            }
                            return next;
                          });
                          setSocialOpen(false);
                        }}
                        className="mt-4 h-12 w-full rounded-xl bg-[#141414] text-sm font-semibold text-white"
                      >
                        Done
                      </button>
                    </div>
                  </div>,
                  document.body,
                )
              : null}
          </div>
        ) : null}
      </div>
    </SiteChrome>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="w-24 shrink-0 pt-0.5 text-[13px] text-fb-muted">{label}</span>
      <span className="min-w-0 flex-1 text-[15px] font-medium break-words">{value?.trim() || "—"}</span>
    </li>
  );
}

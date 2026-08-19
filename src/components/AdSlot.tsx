export function AdSlot({ slotLabel = "Sponsored" }: { slotLabel?: string }) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT;

  if (client && slot) {
    return (
      <aside className="my-4" aria-label="Advertisement">
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </aside>
    );
  }

  return (
    <aside className="my-4 rounded-lg bg-fb-hover px-3 py-2 text-sm text-fb-muted" aria-label="Advertisement">
      <p className="text-[11px] font-semibold uppercase">{slotLabel} · AdSense</p>
      <p>Ad unit. Goes live after publisher approval.</p>
    </aside>
  );
}

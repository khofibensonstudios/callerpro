type Point = {
  label: string;
  key: string;
  users: number;
  posts: number;
  comments: number;
  views: number;
  earn: number;
};

function pathFrom(values: number[], w: number, h: number, padX: number, padY: number) {
  const max = Math.max(1, ...values);
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  return values
    .map((v, i) => {
      const x = padX + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
      const y = padY + innerH - (v / max) * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function areaFrom(values: number[], w: number, h: number, padX: number, padY: number) {
  const line = pathFrom(values, w, h, padX, padY);
  const lastX = w - padX;
  const base = h - padY;
  return `${line} L${lastX},${base} L${padX},${base} Z`;
}

export function OpsChart({ days, title }: { days: Point[]; title: string }) {
  const w = 920;
  const h = 260;
  const padX = 28;
  const padY = 24;
  const activity = days.map((d) => d.posts + d.comments + d.users);
  const earn = days.map((d) => d.earn);
  const activityPath = pathFrom(activity, w, h, padX, padY);
  const earnPath = pathFrom(earn, w, h, padX, padY);
  const activityArea = areaFrom(activity, w, h, padX, padY);
  const tickEvery = Math.max(1, Math.ceil(days.length / 8));
  const ticks = days.filter((_, i) => i % tickEvery === 0 || i === days.length - 1);

  if (!days.length) {
    return (
      <div className="ops-panel px-5 py-10">
        <p className="text-lg font-bold">{title}</p>
        <p className="ops-muted mt-2 text-sm">Nothing in this window yet.</p>
      </div>
    );
  }

  return (
    <div className="ops-panel overflow-hidden px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-lg font-bold tracking-tight">{title}</p>
        <div className="ops-muted flex gap-4 text-xs font-semibold">
          <span className="inline-flex items-center gap-2">
            <i className="h-2 w-4 rounded-full bg-[#e85d04]" /> Activity
          </span>
          <span className="inline-flex items-center gap-2">
            <i className="h-2 w-4 rounded-full bg-[#6b8ecf]" /> Earnings
          </span>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-[240px] w-full min-w-[560px]" role="img" aria-label={title}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              className="ops-grid-line"
              x1={padX}
              x2={w - padX}
              y1={padY + (h - padY * 2) * t}
              y2={padY + (h - padY * 2) * t}
            />
          ))}
          <path d={activityArea} fill="rgba(232,93,4,0.16)" />
          <path d={activityPath} fill="none" stroke="#e85d04" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
          <path d={earnPath} fill="none" stroke="#6b8ecf" strokeWidth="2" strokeDasharray="5 4" />
        </svg>
      </div>
      <div className="ops-muted mt-1 flex justify-between px-1 text-[11px] font-semibold">
        {ticks.map((d) => (
          <span key={d.key}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

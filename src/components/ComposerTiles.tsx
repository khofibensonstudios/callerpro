import Link from "next/link";
import { ImageIcon, Video } from "lucide-react";

export function ComposerTiles() {
  return (
    <div className="mt-3 grid grid-cols-2 border-t border-black/10 pt-2">
      <Tile href="/create?kind=video" label="Video" icon={Video} color="#e11d48" />
      <Tile href="/create?kind=note" label="Photo" icon={ImageIcon} color="#16a34a" />
    </div>
  );
}

function Tile({
  href,
  label,
  icon: Icon,
  color,
}: {
  href: string;
  label: string;
  icon: typeof Video;
  color: string;
}) {
  return (
    <Link href={href} className="flex items-center justify-center gap-2 rounded-md py-2 hover:bg-fb-hover">
      <Icon className="h-5 w-5" style={{ color }} strokeWidth={2} />
      <span className="text-sm font-semibold">{label}</span>
    </Link>
  );
}

"use client";

import Link from "next/link";

export function PersonLink({
  userId,
  className,
  children,
  onClick,
}: {
  userId: string;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link href={`/u/${userId}`} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

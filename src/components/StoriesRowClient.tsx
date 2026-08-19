"use client";

import dynamic from "next/dynamic";

export const StoriesRowClient = dynamic(() => import("./StoriesRow").then((m) => m.StoriesRow), {
  ssr: false,
});

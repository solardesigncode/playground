"use client";

import dynamic from "next/dynamic";
import { Segment } from "@/lib/segments";

const Map = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-sm text-zinc-500">
      Ładowanie mapy…
    </div>
  ),
});

export default function MapClient({ segments }: { segments: Segment[] }) {
  return <Map segments={segments} />;
}

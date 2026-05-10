"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  KIND_COLOR,
  KIND_LABEL,
  Segment,
  TIER_LABEL,
  TIER_WEIGHT,
} from "@/lib/segments";

type MapProps = {
  segments: Segment[];
};

export default function Map({ segments }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([52.0, 19.5], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const layerGroup = L.layerGroup().addTo(map);

    for (const seg of segments) {
      const latlngs: [number, number][] = seg.geometry.coordinates.map(
        ([lon, lat]) => [lat, lon]
      );
      const polyline = L.polyline(latlngs, {
        color: KIND_COLOR[seg.kind],
        weight: TIER_WEIGHT[seg.tier],
        opacity: 0.9,
      }).addTo(layerGroup);

      const km = (seg.distance_m / 1000).toFixed(2);
      const date = (seg.recorded_at ?? seg.created_at).slice(0, 10);
      polyline.bindPopup(
        `<strong>${escapeHTML(seg.name)}</strong><br>` +
          `${KIND_LABEL[seg.kind]} · ${TIER_LABEL[seg.tier]}<br>` +
          `${km} km · <small>${date}</small>`
      );
    }

    if (segments.length > 0) {
      const allLatlngs = segments.flatMap((s) =>
        s.geometry.coordinates.map(
          ([lon, lat]) => [lat, lon] as [number, number]
        )
      );
      map.fitBounds(L.latLngBounds(allLatlngs), { padding: [40, 40] });
    }

    return () => {
      layerGroup.remove();
    };
  }, [segments]);

  return <div ref={containerRef} className="h-full w-full" />;
}

function escapeHTML(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c]!)
  );
}

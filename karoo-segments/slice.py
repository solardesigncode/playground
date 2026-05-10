#!/usr/bin/env python3
"""
Tnie plik .fit z Karoo na fragmenty między kolejnymi naciśnięciami Lap.
Interaktywnie pytasz które fragmenty zapisać i z jaką kategorią,
a wybrane dopisuje do segments.geojson w formacie LineString.

Użycie:
    python slice.py ride.fit
    python slice.py ride.fit --out ../map/segments.geojson
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    from fitparse import FitFile
except ImportError:
    sys.exit("Brak biblioteki fitparse. Zainstaluj: pip install -r requirements.txt")


SEMICIRCLE_TO_DEG = 180.0 / 2**31

KIND_CHOICES = {
    "s": ("gravel_premium", "szuter premium"),
    "a": ("asphalt_s_tier", "asfalt S-tier"),
}


@dataclass
class TrackPoint:
    time: dt.datetime
    lat: float
    lon: float
    alt: float | None


def parse_fit(path: Path) -> tuple[list[TrackPoint], list[dt.datetime]]:
    fit = FitFile(str(path))

    points: list[TrackPoint] = []
    for rec in fit.get_messages("record"):
        d = {f.name: f.value for f in rec.fields}
        lat_raw, lon_raw, ts = d.get("position_lat"), d.get("position_long"), d.get("timestamp")
        if lat_raw is None or lon_raw is None or ts is None:
            continue
        lat = lat_raw * SEMICIRCLE_TO_DEG if isinstance(lat_raw, int) else lat_raw
        lon = lon_raw * SEMICIRCLE_TO_DEG if isinstance(lon_raw, int) else lon_raw
        points.append(TrackPoint(time=ts, lat=lat, lon=lon, alt=d.get("altitude")))

    lap_boundaries: list[dt.datetime] = []
    for lap in fit.get_messages("lap"):
        d = {f.name: f.value for f in lap.fields}
        ts = d.get("start_time")
        if ts is not None:
            lap_boundaries.append(ts)

    if not points:
        sys.exit("Plik FIT nie zawiera punktów GPS.")

    return points, sorted(set(lap_boundaries))


def slice_into_segments(
    points: list[TrackPoint], boundaries: list[dt.datetime]
) -> list[list[TrackPoint]]:
    if not boundaries:
        return [points]

    cuts = sorted(set([points[0].time, *boundaries, points[-1].time]))
    segments: list[list[TrackPoint]] = []
    idx = 0
    for start, end in zip(cuts, cuts[1:]):
        seg: list[TrackPoint] = []
        while idx < len(points) and points[idx].time < start:
            idx += 1
        j = idx
        while j < len(points) and points[j].time <= end:
            seg.append(points[j])
            j += 1
        if len(seg) >= 2:
            segments.append(seg)
    return segments


def haversine_m(a: TrackPoint, b: TrackPoint) -> float:
    r = 6371000.0
    p1, p2 = math.radians(a.lat), math.radians(b.lat)
    dp = math.radians(b.lat - a.lat)
    dl = math.radians(b.lon - a.lon)
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(x))


def segment_stats(seg: list[TrackPoint]) -> dict:
    dist = sum(haversine_m(a, b) for a, b in zip(seg, seg[1:]))
    duration = (seg[-1].time - seg[0].time).total_seconds()
    alts = [p.alt for p in seg if p.alt is not None]
    gain = 0.0
    if len(alts) >= 2:
        for a, b in zip(alts, alts[1:]):
            if b > a:
                gain += b - a
    return {
        "distance_m": round(dist, 1),
        "duration_s": round(duration, 1),
        "elev_gain_m": round(gain, 1),
        "start_time": seg[0].time.isoformat(),
    }


def load_geojson(path: Path) -> dict:
    if path.exists():
        try:
            data = json.loads(path.read_text())
            if data.get("type") == "FeatureCollection":
                return data
        except json.JSONDecodeError:
            pass
    return {"type": "FeatureCollection", "features": []}


def feature_for(seg: list[TrackPoint], stats: dict, kind: str, name: str) -> dict:
    return {
        "type": "Feature",
        "properties": {
            "name": name,
            "kind": kind,
            "distance_m": stats["distance_m"],
            "duration_s": stats["duration_s"],
            "elev_gain_m": stats["elev_gain_m"],
            "recorded_at": stats["start_time"],
        },
        "geometry": {
            "type": "LineString",
            "coordinates": [[p.lon, p.lat] + ([p.alt] if p.alt is not None else []) for p in seg],
        },
    }


def fmt_time(t: dt.datetime) -> str:
    return t.strftime("%H:%M:%S")


def interactive_pick(segments: list[list[TrackPoint]], out_path: Path) -> None:
    geo = load_geojson(out_path)
    print(f"\nZnaleziono {len(segments)} fragmentów (między Lapami).\n")

    added = 0
    for i, seg in enumerate(segments, 1):
        stats = segment_stats(seg)
        km = stats["distance_m"] / 1000
        mins = stats["duration_s"] / 60
        print(
            f"[{i}/{len(segments)}] {fmt_time(seg[0].time)}–{fmt_time(seg[-1].time)}  "
            f"{km:.2f} km  {mins:.1f} min  +{stats['elev_gain_m']:.0f} m"
        )
        choice = input("  [s] szuter / [a] asfalt / [p] pomiń / [q] zakończ: ").strip().lower()
        if choice == "q":
            break
        if choice not in KIND_CHOICES:
            continue
        kind, label = KIND_CHOICES[choice]
        default_name = f"{label} {seg[0].time:%Y-%m-%d}"
        name = input(f"  nazwa [{default_name}]: ").strip() or default_name
        geo["features"].append(feature_for(seg, stats, kind, name))
        added += 1
        print(f"  + zapisano jako {kind}\n")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(geo, indent=2, ensure_ascii=False))
    print(f"\nDodano {added} segmentów. Łącznie w bazie: {len(geo['features'])}.")
    print(f"Plik: {out_path}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Karoo Lap → segments.geojson")
    ap.add_argument("fit", type=Path, help="ścieżka do .fit z Karoo")
    ap.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).parent / "map" / "segments.geojson",
        help="docelowy plik geojson (domyślnie map/segments.geojson)",
    )
    args = ap.parse_args()

    if not args.fit.exists():
        sys.exit(f"Nie znaleziono pliku: {args.fit}")

    points, boundaries = parse_fit(args.fit)
    print(f"Punktów GPS: {len(points)}, lapów: {len(boundaries)}")
    segments = slice_into_segments(points, boundaries)
    interactive_pick(segments, args.out)


if __name__ == "__main__":
    main()

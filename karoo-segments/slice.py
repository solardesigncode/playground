#!/usr/bin/env python3
"""
Tnie plik .fit z Karoo na fragmenty na podstawie naciśnięć Lap.
Konwencja: na końcu fajnego odcinka klikasz przycisk Lap N razy:
    1 klik  -> C-tier
    2 kliki -> B-tier
    3 kliki -> A-tier
Kliknięcia w odstępie krótszym niż --burst-gap sekund są traktowane
jako jeden "burst" — czyli granica segmentu plus ocena tieru.

Segment to fragment trasy od poprzedniego burstu (albo od początku
nagrania) do bieżącego burstu.

Użycie:
    python slice.py ride.fit
    python slice.py ride.fit --burst-gap 5 --out ../map/segments.geojson
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
    "s": ("gravel", "szuter"),
    "a": ("asphalt", "asfalt"),
}


@dataclass
class TrackPoint:
    time: dt.datetime
    lat: float
    lon: float
    alt: float | None


@dataclass
class Burst:
    time: dt.datetime
    clicks: int

    @property
    def tier(self) -> str:
        return {1: "c", 2: "b"}.get(self.clicks, "a")


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

    lap_times: list[dt.datetime] = []
    for lap in fit.get_messages("lap"):
        d = {f.name: f.value for f in lap.fields}
        ts = d.get("start_time") or d.get("timestamp")
        if ts is not None:
            lap_times.append(ts)

    if not points:
        sys.exit("Plik FIT nie zawiera punktów GPS.")

    return points, sorted(set(lap_times))


def cluster_bursts(lap_times: list[dt.datetime], gap_seconds: float) -> list[Burst]:
    bursts: list[Burst] = []
    for t in lap_times:
        if bursts and (t - bursts[-1].time).total_seconds() <= gap_seconds:
            bursts[-1] = Burst(time=bursts[-1].time, clicks=bursts[-1].clicks + 1)
        else:
            bursts.append(Burst(time=t, clicks=1))
    return bursts


def slice_into_segments(
    points: list[TrackPoint], bursts: list[Burst]
) -> list[tuple[list[TrackPoint], Burst | None]]:
    """Zwraca listę (punkty_segmentu, burst_konczacy). Pierwszy segment kończy
    pierwszy burst, ostatni może mieć burst=None jeśli trasa kończy się bez kliku."""
    segments: list[tuple[list[TrackPoint], Burst | None]] = []
    if not bursts:
        return [(points, None)] if len(points) >= 2 else []

    cursor = 0
    seg_start_time = points[0].time
    for burst in bursts:
        seg: list[TrackPoint] = []
        while cursor < len(points) and points[cursor].time <= burst.time:
            if points[cursor].time >= seg_start_time:
                seg.append(points[cursor])
            cursor += 1
        if len(seg) >= 2:
            segments.append((seg, burst))
        seg_start_time = burst.time

    # ogonek po ostatnim burście (bez tieru)
    tail = [p for p in points[cursor:] if p.time >= seg_start_time]
    if len(tail) >= 2:
        segments.append((tail, None))

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


def feature_for(
    seg: list[TrackPoint], stats: dict, kind: str, tier: str, name: str
) -> dict:
    return {
        "type": "Feature",
        "properties": {
            "name": name,
            "kind": kind,
            "tier": tier,
            "distance_m": stats["distance_m"],
            "duration_s": stats["duration_s"],
            "elev_gain_m": stats["elev_gain_m"],
            "recorded_at": stats["start_time"],
        },
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [p.lon, p.lat] + ([p.alt] if p.alt is not None else []) for p in seg
            ],
        },
    }


def fmt_time(t: dt.datetime) -> str:
    return t.strftime("%H:%M:%S")


def interactive_pick(
    segments: list[tuple[list[TrackPoint], Burst | None]], out_path: Path
) -> None:
    geo = load_geojson(out_path)
    print(f"\nZnaleziono {len(segments)} fragmentów.\n")

    added = 0
    for i, (seg, burst) in enumerate(segments, 1):
        stats = segment_stats(seg)
        km = stats["distance_m"] / 1000
        mins = stats["duration_s"] / 60
        if burst is None:
            tier_label = "—  (brak kliku na końcu)"
            default_tier = None
        else:
            tier_label = f"{burst.tier.upper()}-tier  ({burst.clicks}× lap)"
            default_tier = burst.tier
        print(
            f"[{i}/{len(segments)}] {fmt_time(seg[0].time)}–{fmt_time(seg[-1].time)}  "
            f"{km:.2f} km  {mins:.1f} min  +{stats['elev_gain_m']:.0f} m  →  {tier_label}"
        )
        if default_tier is None:
            choice = input("  brak tieru — [s] szuter / [a] asfalt / [p] pomiń / [q] zakończ: ").strip().lower()
        else:
            choice = input("  [s] szuter / [a] asfalt / [p] pomiń / [q] zakończ: ").strip().lower()
        if choice == "q":
            break
        if choice not in KIND_CHOICES:
            continue
        kind, kind_label = KIND_CHOICES[choice]
        tier = default_tier
        if tier is None:
            t_in = input("  tier [a/b/c]: ").strip().lower()
            if t_in not in ("a", "b", "c"):
                print("  pomijam (zły tier)\n")
                continue
            tier = t_in
        default_name = f"{kind_label} {tier.upper()} {seg[0].time:%Y-%m-%d}"
        name = input(f"  nazwa [{default_name}]: ").strip() or default_name
        geo["features"].append(feature_for(seg, stats, kind, tier, name))
        added += 1
        print(f"  + zapisano: {kind} / {tier.upper()}-tier\n")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(geo, indent=2, ensure_ascii=False))
    print(f"\nDodano {added} segmentów. Łącznie w bazie: {len(geo['features'])}.")
    print(f"Plik: {out_path}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Karoo Lap-burst → segments.geojson")
    ap.add_argument("fit", type=Path, help="ścieżka do .fit z Karoo")
    ap.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).parent / "map" / "segments.geojson",
        help="docelowy plik geojson (domyślnie map/segments.geojson)",
    )
    ap.add_argument(
        "--burst-gap",
        type=float,
        default=5.0,
        help="maks. odstęp w sekundach między klikami w jednym burście (domyślnie 5)",
    )
    args = ap.parse_args()

    if not args.fit.exists():
        sys.exit(f"Nie znaleziono pliku: {args.fit}")

    points, lap_times = parse_fit(args.fit)
    bursts = cluster_bursts(lap_times, args.burst_gap)
    print(f"Punktów GPS: {len(points)}, lapów: {len(lap_times)}, burstów: {len(bursts)}")
    for b in bursts:
        print(f"  {fmt_time(b.time)}  {b.clicks}× → {b.tier.upper()}-tier")
    segments = slice_into_segments(points, bursts)
    interactive_pick(segments, args.out)


if __name__ == "__main__":
    main()

export type SegmentKind = "gravel" | "asphalt";
export type SegmentTier = "a" | "b" | "c";

export type Segment = {
  id: string;
  name: string;
  kind: SegmentKind;
  tier: SegmentTier;
  distance_m: number;
  recorded_at: string | null;
  created_at: string;
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
};

export const KIND_LABEL: Record<SegmentKind, string> = {
  gravel: "Szuter",
  asphalt: "Asfalt",
};

export const TIER_LABEL: Record<SegmentTier, string> = {
  a: "A-tier",
  b: "B-tier",
  c: "C-tier",
};

export const KIND_COLOR: Record<SegmentKind, string> = {
  gravel: "#c2410c",
  asphalt: "#1d4ed8",
};

export const TIER_WEIGHT: Record<SegmentTier, number> = {
  a: 7,
  b: 5,
  c: 3,
};

export const SEED_SEGMENTS: Segment[] = [
  {
    id: "seed-1",
    name: "Stary trakt na Łysą Górę",
    kind: "gravel",
    tier: "a",
    distance_m: 4200,
    recorded_at: "2026-04-12T09:14:00Z",
    created_at: "2026-04-12T18:00:00Z",
    geometry: {
      type: "LineString",
      coordinates: [
        [21.05, 50.85],
        [21.07, 50.86],
        [21.09, 50.87],
        [21.11, 50.875],
      ],
    },
  },
  {
    id: "seed-2",
    name: "Asfaltowa pętla pod Tarnowem",
    kind: "asphalt",
    tier: "a",
    distance_m: 8400,
    recorded_at: "2026-04-20T11:00:00Z",
    created_at: "2026-04-20T17:30:00Z",
    geometry: {
      type: "LineString",
      coordinates: [
        [20.98, 50.0],
        [21.01, 50.02],
        [21.04, 50.03],
        [21.07, 50.025],
      ],
    },
  },
  {
    id: "seed-3",
    name: "Średni szuter koło jeziora",
    kind: "gravel",
    tier: "b",
    distance_m: 2800,
    recorded_at: null,
    created_at: "2026-05-01T12:00:00Z",
    geometry: {
      type: "LineString",
      coordinates: [
        [19.5, 53.5],
        [19.52, 53.51],
        [19.54, 53.515],
      ],
    },
  },
];

export async function listSegments(): Promise<Segment[]> {
  return SEED_SEGMENTS;
}

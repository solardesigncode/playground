# szutry.cc

Społecznościowa mapa szutrów premium i asfaltów S-tier do jazdy na rowerze.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind 4
- **Leaflet** (CSR przez `next/dynamic`)
- **Supabase** (Postgres + Auth + RLS) — dochodzi w fazie 2
- **Vercel** (Renton Media team) — hosting

## Lokalnie

```bash
npm install
npm run dev
# http://localhost:3000
```

## Build

```bash
npm run build
npm start
```

## Deploy

Repo: `solardesigncode/playground` (subkatalog `szutry/`).
Vercel project root directory: `szutry/`.

## Status

- **Faza 1** (current): publiczna mapa z seed data, bez auth, bez DB.
- **Faza 2**: Supabase Auth (magic link + invite codes), Postgres + PostGIS, role admin/editor/contributor.
- **Faza 3**: tworzenie segmentów (FIT import + manual draw), edycja własnych.
- **Faza 4**: proposals, flagi, review queue.
- **Faza 5**: bbox loading, og:image, SEO dla publicznych segmentów.

Pełny plan: rozmowa w głównym wątku (`claude/karoo-segment-export-tsTGK`).

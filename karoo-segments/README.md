# Karoo segments

Workflow do budowania własnej mapy fajnych szutrów i asfaltów na podstawie nagrań z Karoo Hammerhead.

## Jak to działa

1. **Na rowerze** — jedziesz normalnie, Karoo nagrywa do FIT. Naciskasz **Lap** na granicach ciekawych fragmentów (start i koniec — nie musi to być para; każdy Lap to po prostu boundary).
2. **W domu** — kopiujesz `.fit` z Karoo (USB albo z folderu sync na Stravę/Dropboxa).
3. **Skrypt** dzieli trasę na fragmenty między kolejnymi Lapami i pyta cię o każdy: szuter / asfalt / pomiń.
4. **Mapa** (Leaflet) pokazuje wszystko, co zapisałeś, pokolorowane po kategorii.

## Setup

```bash
cd karoo-segments
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Użycie

```bash
python slice.py /sciezka/do/ride.fit
```

Skrypt wypisze listę fragmentów i dla każdego zapyta:

```
[3/12] 11:24:08–11:38:51  4.21 km  14.7 min  +52 m
  [s] szuter / [a] asfalt / [p] pomiń / [q] zakończ: s
  nazwa [szuter premium 2026-05-10]: Stary trakt na Łysą Górę
  + zapisano jako gravel_premium
```

Wybrane fragmenty są dopisywane do `map/segments.geojson` (nie nadpisuje — dokłada do tego co już masz).

## Mapa

```bash
cd map
python -m http.server 8000
# otwórz http://localhost:8000
```

Albo wrzuć cały folder `map/` na GitHub Pages — działa jako statyczna strona.

## Format danych

`segments.geojson` to zwykły FeatureCollection. Każdy segment to `LineString` z polami:

- `name` — twoja nazwa
- `kind` — `gravel_premium` albo `asphalt_s_tier`
- `distance_m`, `duration_s`, `elev_gain_m`
- `recorded_at` — ISO timestamp początku fragmentu

Możesz edytować ręcznie albo importować do innych narzędzi (Komoot, QGIS, geojson.io).

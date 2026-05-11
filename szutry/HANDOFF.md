# szutry.cc — handoff dla nowego agenta

Witaj. Ten dokument to pełny briefing produktu i status prac. Zacznij od przeczytania go w całości, potem `AGENTS.md`, `DESIGN.md`, `README.md`.

**Środowisko, w którym pracujesz:** VS Code + Claude plugin, lokalna maszyna ownera. Masz pełny dostęp do `gh` CLI, `git`, `vercel` CLI, npm, możesz pushować do dowolnego repo do którego owner ma uprawnienia, możesz tworzyć repo na GitHub. Poprzednia sesja była w restryktywnym sandboxie i dlatego pewne kroki zostały tobie.

---

## 0. Action items na start (zrób te kroki w kolejności)

### 0.1 — Migracja kodu do dedykowanego repo `solardesigncode/szutry.cc`

Repo **istnieje ale jest puste** (owner utworzył w poprzedniej sesji). Kod siedzi w `solardesigncode/playground` na branchu `claude/karoo-segment-export-tsTGK` w podkatalogu `szutry/`. Cel: wyciągnij `szutry/` jako root nowego repo z zachowaną historią.

Z poziomu klona `playground` (jeśli nie masz — `gh repo clone solardesigncode/playground`):

```bash
cd ścieżka/do/playground
git fetch origin
git checkout claude/karoo-segment-export-tsTGK
git pull --ff-only

# Wyciągnij szutry/ jako osobną historię z plikami w roocie
git subtree split --prefix=szutry -b szutry-only

# Podłącz nowe repo i wypchnij na main
git remote add szutry git@github.com:solardesigncode/szutry.cc.git
git push -u szutry szutry-only:main

# Sprzątanie
git remote remove szutry
git branch -D szutry-only
```

Sprawdź `gh repo view solardesigncode/szutry.cc` — powinno mieć `package.json`, `src/`, `DESIGN.md`, `HANDOFF.md`, `AGENTS.md` itd. **w roocie**.

Następnie sklonuj nowe repo do nowej lokalnej ścieżki i pracuj już tam:

```bash
cd ~
gh repo clone solardesigncode/szutry.cc
cd szutry.cc
npm install
npm run dev   # sanity check, http://localhost:3000
```

Od tej pory wszystkie commity idą do `solardesigncode/szutry.cc`. Pracuj na branchach (nie pushuj bezpośrednio do `main` — otwieraj PR-y dla ownera).

### 0.2 — Deploy na Vercel (Renton Media team)

Owner ma plan Vercel Pro w teamie **Renton Media**. Dwie ścieżki:

**Ścieżka A — UI (zalecane, owner klika):**
1. Powiedz ownerowi żeby otworzył `https://vercel.com/new`
2. Wybór team: **Renton Media**
3. Import Git Repository: **`solardesigncode/szutry.cc`**
4. Project Name: `szutry-cc`
5. Application Preset: **Next.js** (ważne — Vercel sam wykryje, ale potwierdź)
6. Root Directory: `./` (kod w roocie po migracji)
7. Production Branch: `main`
8. Environment Variables: **na razie żadne** (dodamy w 0.3 po Supabase)
9. Deploy

Po pierwszym deployu otrzymasz preview URL typu `szutry-cc.vercel.app`. Potwierdź że homepage renderuje mapę z 3 seed segmentami.

**Ścieżka B — CLI (jeśli owner zaufał ci `vercel login`):**

```bash
cd ~/szutry.cc
npx vercel login   # owner robi to raz interaktywnie
npx vercel link --scope=renton-media   # albo bez --scope, wybierz w prompcie
npx vercel --prod
```

**Domeny `szutry.cc` jeszcze nie podpinaj.** Zrobimy to dopiero po Fazie 2, gdy auth działa.

### 0.3 — Założenie projektu Supabase (Faza 2 start)

Owner musi sam utworzyć projekt (wymaga jego konta + ewentualnie karty dla większego planu):

1. Powiedz ownerowi żeby założył projekt na `https://supabase.com/dashboard` — free tier wystarczy na start.
2. Project name: `szutry-cc` (albo cokolwiek), region: **Frankfurt** (najbliżej Polski).
3. Po utworzeniu, owner wkleja ci:
   - `SUPABASE_URL` (Project Settings → API → Project URL)
   - `SUPABASE_ANON_KEY` (Project Settings → API → anon public)
   - `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API → service_role — **TYLKO server-side, nigdy nie ujawniaj klientowi**)
4. Dodaj do `.env.local` lokalnie i do Environment Variables na Vercel (Production + Preview).
5. Włącz PostGIS w SQL Editor: `CREATE EXTENSION IF NOT EXISTS postgis;`

Następnie napisz pliki migracji SQL w `supabase/migrations/` (patrz sekcja 5 — Faza 2 — pełne schema). Użyj Supabase CLI lokalnie:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <ref-z-dashboarda>
supabase db push   # po napisaniu migracji
```

Owner musi po pierwszym pushu **ręcznie ustawić swoją rolę** w SQL Editor:

```sql
update profiles set role = 'admin' where id = (
  select id from auth.users where email = 'mail.ownera@domena'
);
```

### 0.4 — Wire auth (po 0.3)

- Zainstaluj `@supabase/ssr` (nowy, nie `auth-helpers-nextjs` który jest **deprecated**).
- Middleware `src/middleware.ts` do refreshu sesji.
- Strona `/login` z formem: email + invite_code.
- Server action `redeemInvite(email, code)` — waliduje kod (`invite_codes.uses < max_uses`, nie wygasły), tworzy `profile` z rolą `contributor`, wysyła magic link przez `auth.signInWithOtp`.
- Trigger PostgreSQL po `auth.users` insert → tworzy `profiles` row (na wypadek logowania bez invite, którego nie powinno być, ale safety).
- W `src/app/page.tsx` zastąp `listSegments()` callem do Supabase server-side (`createServerClient` z `@supabase/ssr`).
- Header: jeśli zalogowany → pokaż email + Logout; jeśli nie → link do `/login`.

### 0.5 — Co po Fazie 2

Gdy auth + DB działają (owner zalogowany jako admin, segmenty czytane z bazy, viewer wciąż public dla anonimowych) — odpalcie razem **Fazę 3 (Authoring)**. Szczegóły w sekcji 5.

---

## 1. Produkt

**szutry.cc** — społecznościowa mapa **premium szutrów** i **S-tier asfaltów** do jazdy na rowerze (gravel/road). Język UI: polski.

- **Użytkownicy**: początkowo kilku znajomych właściciela, docelowo małe community gravelowe.
- **Wartość**: znaleźć dobre szutry/asfalty bez przebijania się przez Strava heatmapy i własną intuicję.
- **Domena**: `szutry.cc` (do podpięcia na koniec do Vercel).

### Geneza — mechanika Karoo (do Fazy 3)

Pomysł wystartował od chęci oznaczania segmentów z poziomu komputera rowerowego **Hammerhead Karoo** podczas jazdy:

- W trakcie jazdy: **1 klik Lap** = start segmentu, **kolejny 1 klik Lap** = koniec segmentu.
- **Na końcu** segmentu, w „okienku" (<5s burst po końcowym klik-end) **liczba klików = tier**:
  - 1 klik = **C-tier**
  - 2 kliki = **B-tier**
  - 3 kliki = **A-tier**
- Po jeździe użytkownik wgrywa plik FIT, parser wyciąga segmenty + tier z burstów i wrzuca na mapę.

To trafia do **Fazy 3 (Authoring)**. Faza 1 (gotowa) i Faza 2 (Supabase) tego jeszcze nie ruszają.

### Tier semantics (uniwersalne, nie tylko Karoo)

- **A** — premium, „must ride"
- **B** — bardzo dobre
- **C** — dobre, warto rozważyć

Plus typ: **gravel** (szuter) / **asphalt** (asfalt S-tier).

### Role i moderacja

- **admin** — właściciel produktu, absolutna władza, może wszystko.
- **editor** (ranked) — zaufani userzy, mogą dodawać/edytować segmenty bezpośrednio.
- **contributor** — domyślna rola po wejściu z invite code; może tylko **proponować** segmenty (`segment_proposals`), które admin/editor akceptuje.
- **Flagi moderacyjne** na każdym segmencie (`segment_flags`) — userzy zgłaszają, admin rozpatruje.

### Auth

- **Invite codes + magic link** (bez haseł). Userzy dostają kod jednorazowy / wielorazowy, logują się mailem, w pierwszym logowaniu kod konsumuje się i tworzy `profile` z rolą `contributor`.

---

## 2. Tech stack

| Warstwa     | Wybór                                                        |
| ----------- | ------------------------------------------------------------ |
| Framework   | **Next.js 16** (App Router, Turbopack) + React 19.2.4        |
| Język       | **TypeScript** (strict)                                      |
| Style       | **Tailwind 4** (CSS-first, `@theme inline` w `globals.css`)  |
| Mapa        | **Leaflet** (CSR przez `next/dynamic` z `ssr: false`)        |
| Font        | **Inter** (substytut Notion Sans) przez `next/font/google`   |
| Backend     | **Supabase** planowany (Postgres + PostGIS + Auth + RLS)     |
| Hosting     | **Vercel Pro** (team: **Renton Media**)                      |
| Design sys  | **Notion-inspired** via `getdesign@latest add notion`        |

**Next.js 16 ma breaking changes** — zanim cokolwiek napiszesz, przeczytaj relevantne pliki w `node_modules/next/dist/docs/`. Nie zakładaj że API to to samo co w 14/15.

---

## 3. Stan obecny — Faza 1 ✅ ZROBIONA

Działający **publiczny viewer** z hardcoded seed data. Build zielony, statyczne prerenderowanie.

### Co jest

- `src/app/layout.tsx` — root layout, Inter font, metadata `szutry.cc`
- `src/app/page.tsx` — server component, public viewer: header (logo + przycisk Zaloguj disabled), sidebar 260px (filtry kind/tier + lista segmentów), main z mapą
- `src/components/Map.tsx` — `"use client"` Leaflet, polyline'y kolorowane wg `KIND_COLOR`, grubość wg `TIER_WEIGHT`, popupy
- `src/components/MapClient.tsx` — `dynamic({ ssr: false })` wrapper na Mapę
- `src/lib/segments.ts` — typy + 3 seed segmenty (Łysa Góra gravel A, Tarnów asphalt A, jezioro gravel B) + `listSegments()`
- `src/app/globals.css` — pełne tokeny Notion (kolory/radii/spacing/shadows) + Leaflet restyling
- `DESIGN.md` — 35KB pełnej specyfikacji designu Notion (821 linii, generowane przez `getdesign`)
- `AGENTS.md` — reguły dla agentów (Next.js 16 caveat + design system rules)
- `README.md` — stack + dev commands + phase status

### Co działa

- `npm run dev` → mapa Polski z 3 segmentami, filtry w sidebarze (jeszcze disabled — to dla Fazy 2)
- `npm run build` → 4 static pages, zielony build
- Notion design tokens dostępne jako CSS vars (`var(--color-primary)`, `var(--radius-md)` itd.)

### Czego NIE ma jeszcze

- Bazy danych (segments są w pamięci, w `src/lib/segments.ts`)
- Auth (przycisk Zaloguj disabled z tooltipem „faza 2")
- Edycji / dodawania segmentów
- Importu FIT
- Filtrów (checkboxy są disabled, render-only)
- Deployu na Vercel (gotowe do deployu, czeka na akcję ownera)

---

## 4. Gdzie żyje kod (**ważne — sytuacja repo**)

**Obecnie**: `solardesigncode/playground`, branch `claude/karoo-segment-export-tsTGK`, podkatalog `szutry/`.

**Dedykowane puste repo**: `solardesigncode/szutry.cc` zostało utworzone przez ownera, ale jest **puste** — kod jeszcze tam nie trafił. Powód: poprzednia sesja Claude była zamknięta w sandboxie z dostępem tylko do `playground`, push do innego repo był zablokowany przez lokalny proxy.

### Plan migracji (rób kiedy ci wygodnie z lokalnej maszyny)

```bash
# z poziomu lokalnego klona playgrounda
git fetch origin
git checkout claude/karoo-segment-export-tsTGK
git pull --ff-only

git subtree split --prefix=szutry -b szutry-only
git remote add szutry git@github.com:solardesigncode/szutry.cc.git
git push -u szutry szutry-only:main

# sprzątanie
git remote remove szutry
git branch -D szutry-only
```

Po tym `szutry.cc:main` ma **całą appkę w roocie** (bez folderu `szutry/`, bez śmieci playgrounda) z zachowaną historią fazy 1.

### Alternatywa — deploy bez migracji

Vercel umie deployować z podkatalogu monorepo. W UI Vercel:
- Import: `solardesigncode/playground`
- Root Directory: `szutry`
- Application Preset: **Next.js**
- Production Branch: `claude/karoo-segment-export-tsTGK` (albo zmerguj do `main`)

To działa od razu bez subtree split.

---

## 5. Roadmap — co dalej

### Faza 2 — Supabase backend (NEXT)

1. Owner zakłada projekt na supabase.com (free tier OK na start).
2. SQL schema:
   - `profiles` (id uuid PK ref auth.users, role enum 'admin'|'editor'|'contributor', display_name, created_at)
   - `invite_codes` (code text PK, max_uses int, uses int, expires_at, created_by)
   - `invite_redemptions` (code FK, user_id FK, redeemed_at)
   - `segments` (id uuid PK, name, kind, tier, distance_m, geometry geography(LineString,4326), recorded_at, created_by, created_at, updated_at)
   - `segment_proposals` (id, payload jsonb, proposer_id, status 'pending'|'approved'|'rejected', reviewer_id, reviewed_at)
   - `segment_flags` (id, segment_id FK, flagger_id, reason text, status, resolved_by, resolved_at)
3. RLS policies:
   - `segments` SELECT: public (auth or anon)
   - `segments` INSERT/UPDATE: editor + admin
   - `segment_proposals` INSERT: any authenticated
   - `segment_proposals` UPDATE: editor + admin
   - `segment_flags` INSERT: any authenticated
   - role checks via `profiles.role`
4. PostGIS:
   - `CREATE EXTENSION postgis;`
   - GIST index na `segments.geometry`
   - RPC `segments_in_bbox(min_lon, min_lat, max_lon, max_lat)` używające `ST_Intersects` — pod fazę 5 (lazy loading mapy)
5. Auth wiring w Next.js:
   - `@supabase/ssr` (nowy preferowany pakiet, nie `auth-helpers-nextjs` który jest deprecated)
   - middleware do refresha sesji
   - `/login` z magic link form (email + invite_code)
   - server action `redeem-invite` która waliduje code i ustawia rolę `contributor`
   - po loginie redirect do `/`, header pokazuje email + Logout
6. Zastąp `listSegments()` z `src/lib/segments.ts` callem do Supabase (server-side w RSC).
7. Migracja: invite code dla admina (ownera) → zaloguj się → ręcznie ustaw `role = 'admin'` w SQL.

### Faza 3 — Authoring

- Manualne dodawanie segmentu (klikanie po mapie → polyline → metadata form → submit)
- Import FIT (port logiki z `karoo-segments/` które było w playgroundzie wcześniej, w głównej linii historii; szukaj commitów `a20b9c1`, `99609bc`)
- Karoo lap mechanic w parserze FIT: wykryj burst klików Lap na końcu segmentu (<5s gap), policz, mapuj 1/2/3 → C/B/A
- Edycja własnych segmentów (RLS: `created_by = auth.uid()` OR editor/admin)
- Drafty w localStorage z prompt „masz N niezsynchronizowanych segmentów, chcesz przenieść do konta?"

### Faza 4 — Community

- `/proposals` — kolejka propozycji dla editorów/admina, accept/reject z komentarzem
- `/flags` — kolejka flag, resolve/dismiss
- Notyfikacje email (Resend albo Supabase native): propozycja zaakceptowana, twój segment oflagowany
- Profile pages `/u/[handle]` — segmenty usera, statystyki

### Faza 5 — Skala i polish

- Bbox-based loading mapy (PostGIS `ST_Intersects` po viewport bounds, nie całe DB)
- `og:image` generowane per segment (`@vercel/og`)
- `sitemap.xml`, `robots.txt`
- CDN cache headers (`s-maxage`, `stale-while-revalidate`)
- Dark mode (Notion ma dark theme — patrz `DESIGN.md`)
- Mobile gestures na mapie (lepsze niż domyślny Leaflet)

---

## 6. Kluczowe decyzje i ograniczenia (NIE łamać bez rozmowy z ownerem)

- **Notion design system** — czytaj `DESIGN.md` zanim cokolwiek wyrenderujesz w UI. Tokeny przez `var(--color-*)`. Buttons radius-md, cards radius-lg, pills radius-full. Patrz `AGENTS.md`.
- **Polski język** w UI. Komentarze w kodzie mogą być po angielsku.
- **Bez haseł** — tylko magic link + invite code.
- **Admin zna wszystkich** na start (mała community). Nie ma rejestracji otwartej; tylko invite-only do co najmniej Fazy 4.
- **Tier semantyka jest święta** — A/B/C, nie zmieniaj na S/A/B czy gwiazdki bez rozmowy.
- **Karoo lap mechanic** — 1/2/3 klik na końcu = C/B/A. Jeśli to się zmieni, zaktualizuj `HANDOFF.md`.
- **Vercel team**: Renton Media (Pro plan). Owner ma dostęp.

---

## 7. Pierwsze kroki dla nowego agenta

1. Przeczytaj `AGENTS.md` (zwłaszcza fragment o Next.js 16 — czytaj docs przed kodowaniem).
2. Przejrzyj `DESIGN.md` — wystarczy zrozumieć tokeny i grupy komponentów; szczegóły wracaj sprawdzać.
3. Otwórz `src/app/page.tsx` i `src/components/Map.tsx` — to cała powierzchnia fazy 1.
4. Zapytaj ownera w jakiej fazie zaczynasz pracę. Jeśli faza 2 — czekaj aż założy projekt Supabase i da ci `SUPABASE_URL` + `SUPABASE_ANON_KEY` + service role key.
5. Nie deployuj sam na Vercel. Owner sam klika Import w Vercel UI.
6. Pracuj na branchu (nie commituj do main bezpośrednio). Owner reviewuje i merguje.

---

## 8. Stan plików / commitów na moment handoff

- Branch: `claude/karoo-segment-export-tsTGK` w `solardesigncode/playground`
- Ostatnie commity:
  - `84f9789` adopt notion design system tokens
  - `a10689c` phase 1: szutry.cc next.js skeleton with public leaflet map
- Vercel: **projekt jeszcze nie utworzony** (czeka na ownera).
- Supabase: **projekt jeszcze nie utworzony** (czeka na ownera).
- Domena `szutry.cc`: **niepodpięta** (faza końcowa, owner ją wpina po pierwszych deployach).

Powodzenia. Owner mówi po polsku, jest techniczny ale woli krótkie komunikaty i konkretne propozycje. Jak coś niejasne — pytaj.

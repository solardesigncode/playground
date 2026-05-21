#!/usr/bin/env node
// Test połączenia z intervals.icu REST API.
//
// Konfiguracja (zmienne środowiskowe lub plik .env obok skryptu):
//   INTERVALS_API_KEY     - klucz z intervals.icu -> Settings -> Developer Settings (WYMAGANE)
//   INTERVALS_ATHLETE_ID  - id atlety, domyślnie "0" = zalogowany atleta
//
// Użycie:
//   node intervals.mjs                 # podsumowanie: profil, aktywności, wellness, kalendarz
//   node intervals.mjs --days 14       # zakres dni (wstecz dla danych, w przód dla planu)
//   node intervals.mjs --athlete i123  # nadpisz id atlety
//   node intervals.mjs --json          # zrzuć surowe odpowiedzi JSON
//   node intervals.mjs --help

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE_URL = "https://intervals.icu/api/v1";
const __dirname = dirname(fileURLToPath(import.meta.url));

// --- prosty loader .env (KEY=VALUE, bez zależności) ---
function loadDotEnv() {
  try {
    const raw = readFileSync(join(__dirname, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // brak .env to nie błąd – można podać zmienne środowiskowo
  }
}

// --- parsowanie argumentów ---
function parseArgs(argv) {
  const args = { days: 30, json: false, help: false, athlete: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--json") args.json = true;
    else if (a === "--days") args.days = parseInt(argv[++i], 10);
    else if (a === "--athlete") args.athlete = argv[++i];
  }
  if (!Number.isFinite(args.days) || args.days <= 0) args.days = 30;
  return args;
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function authHeader(apiKey) {
  // intervals.icu: HTTP Basic, login dosłownie "API_KEY", hasło = klucz
  const token = Buffer.from(`API_KEY:${apiKey}`).toString("base64");
  return `Basic ${token}`;
}

async function api(path, { apiKey, params } = {}) {
  const url = new URL(BASE_URL + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v != null) url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url, {
    headers: { Authorization: authHeader(apiKey), Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let hint = "";
    if (res.status === 401 || res.status === 403)
      hint = " -> sprawdź INTERVALS_API_KEY (Settings -> Developer Settings).";
    else if (res.status === 404)
      hint = " -> sprawdź INTERVALS_ATHLETE_ID lub ścieżkę.";
    else if (res.status === 429) hint = " -> limit zapytań, spróbuj później.";
    throw new Error(
      `HTTP ${res.status} ${res.statusText} dla ${url.pathname}${hint}\n${body.slice(0, 300)}`
    );
  }
  return res.json();
}

// --- formatowanie ---
function fmtDuration(secs) {
  if (secs == null) return "-";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
}

function fmtKm(meters) {
  if (meters == null) return "-";
  return `${(meters / 1000).toFixed(1)} km`;
}

function num(v, digits = 0) {
  return v == null ? "-" : Number(v).toFixed(digits);
}

function header(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(
      [
        "Test połączenia z intervals.icu REST API.",
        "",
        "Konfiguracja: INTERVALS_API_KEY (wymagane), INTERVALS_ATHLETE_ID (domyślnie 0).",
        "Można użyć pliku .env obok skryptu (zobacz .env.example).",
        "",
        "Opcje:",
        "  --days N         zakres dni (domyślnie 30)",
        "  --athlete ID     nadpisz id atlety",
        "  --json           surowy JSON zamiast podsumowania",
        "  --help           ta pomoc",
      ].join("\n")
    );
    return;
  }

  const apiKey = process.env.INTERVALS_API_KEY;
  if (!apiKey) {
    console.error(
      "Brak INTERVALS_API_KEY. Ustaw zmienną środowiskową albo wpisz do pliku .env.\n" +
        "Klucz wygenerujesz w intervals.icu -> Settings -> Developer Settings."
    );
    process.exit(1);
  }
  const athleteId = args.athlete || process.env.INTERVALS_ATHLETE_ID || "0";

  const today = new Date();
  const past = new Date(today);
  past.setDate(past.getDate() - args.days);
  const future = new Date(today);
  future.setDate(future.getDate() + args.days);
  const oldest = fmtDate(past);
  const newest = fmtDate(today);
  const planNewest = fmtDate(future);

  console.log(`intervals.icu API @ ${BASE_URL}`);
  console.log(`Atleta: ${athleteId} | zakres danych: ${oldest} .. ${newest}`);

  // pobieramy równolegle
  const [profile, activities, wellness, events] = await Promise.all([
    api(`/athlete/${athleteId}/profile`, { apiKey }).catch((e) => ({ __error: e.message })),
    api(`/athlete/${athleteId}/activities`, {
      apiKey,
      params: { oldest, newest },
    }).catch((e) => ({ __error: e.message })),
    api(`/athlete/${athleteId}/wellness`, {
      apiKey,
      params: { oldest, newest },
    }).catch((e) => ({ __error: e.message })),
    api(`/athlete/${athleteId}/events`, {
      apiKey,
      params: { oldest: newest, newest: planNewest },
    }).catch((e) => ({ __error: e.message })),
  ]);

  if (args.json) {
    console.log(JSON.stringify({ profile, activities, wellness, events }, null, 2));
    return;
  }

  const results = { profile, activities, wellness, events };
  const errors = Object.values(results).filter((r) => r && r.__error);
  const blocked = errors.some((r) => /allowlist|ENOTFOUND|EAI_AGAIN/i.test(r.__error));

  // --- PROFIL ---
  header("Profil atlety");
  if (profile.__error) {
    console.log("Błąd:", profile.__error);
  } else {
    const a = profile.athlete || profile;
    console.log("Imię:    ", a.name ?? a.firstname ?? "-");
    console.log("Id:      ", a.id ?? athleteId);
    if (a.email) console.log("Email:   ", a.email);
    if (a.city || a.country)
      console.log("Lokacja: ", [a.city, a.country].filter(Boolean).join(", "));
    const ss = profile.sportSettings?.[0];
    if (ss) console.log("FTP/strefy: skonfigurowane sporty:", profile.sportSettings.length);
  }

  // --- AKTYWNOŚCI ---
  header(`Aktywności (ostatnie ${args.days} dni)`);
  if (activities.__error) {
    console.log("Błąd:", activities.__error);
  } else if (!Array.isArray(activities) || activities.length === 0) {
    console.log("Brak aktywności w tym zakresie.");
  } else {
    console.log(`Liczba: ${activities.length}`);
    for (const act of activities.slice(0, 10)) {
      const date = (act.start_date_local || act.start_date || "").slice(0, 10);
      console.log(
        `  ${date}  ${(act.type || "?").padEnd(10)}  ` +
          `${fmtKm(act.distance).padStart(9)}  ${fmtDuration(act.moving_time).padStart(6)}  ` +
          `${act.name ?? ""}`
      );
    }
    if (activities.length > 10) console.log(`  ... i ${activities.length - 10} więcej`);
  }

  // --- WELLNESS / FORMA ---
  header(`Wellness / forma (ostatnie ${args.days} dni)`);
  if (wellness.__error) {
    console.log("Błąd:", wellness.__error);
  } else if (!Array.isArray(wellness) || wellness.length === 0) {
    console.log("Brak danych wellness w tym zakresie.");
  } else {
    const latest = wellness[wellness.length - 1];
    console.log(`Rekordów: ${wellness.length}, najnowszy: ${latest.id || latest.date || "?"}`);
    console.log(
      `  CTL (Fitness):  ${num(latest.ctl, 1)}\n` +
        `  ATL (Fatigue):  ${num(latest.atl, 1)}\n` +
        `  Form (CTL-ATL): ${num((latest.ctl ?? 0) - (latest.atl ?? 0), 1)}\n` +
        `  Waga:           ${num(latest.weight, 1)} kg\n` +
        `  RHR:            ${num(latest.restingHR)} bpm\n` +
        `  HRV:            ${num(latest.hrv, 1)}`
    );
  }

  // --- KALENDARZ / PLAN ---
  header(`Kalendarz / plan (najbliższe ${args.days} dni)`);
  if (events.__error) {
    console.log("Błąd:", events.__error);
  } else if (!Array.isArray(events) || events.length === 0) {
    console.log("Brak zaplanowanych wydarzeń.");
  } else {
    console.log(`Liczba: ${events.length}`);
    for (const ev of events.slice(0, 10)) {
      const date = (ev.start_date_local || ev.date || "").slice(0, 10);
      console.log(
        `  ${date}  ${(ev.category || ev.type || "?").padEnd(12)}  ${ev.name ?? ""}`
      );
    }
    if (events.length > 10) console.log(`  ... i ${events.length - 10} więcej`);
  }

  if (blocked) {
    console.log(
      "\nUwaga: host intervals.icu wygląda na zablokowany przez politykę sieciową " +
        "tego środowiska (allowlist). Uruchom skrypt lokalnie albo dodaj intervals.icu " +
        "do dozwolonych hostów środowiska."
    );
  }
  if (errors.length === 4) {
    console.error("\nPołączenie nieudane: wszystkie zapytania zwróciły błąd.");
    process.exit(1);
  }
  console.log("\nGotowe.");
}

main().catch((e) => {
  console.error("\nBłąd:", e.message);
  process.exit(1);
});

import MapClient from "@/components/MapClient";
import {
  KIND_COLOR,
  KIND_LABEL,
  TIER_LABEL,
  TIER_WEIGHT,
  listSegments,
} from "@/lib/segments";

export default async function Home() {
  const segments = await listSegments();
  const kinds: ("gravel" | "asphalt")[] = ["gravel", "asphalt"];
  const tiers: ("a" | "b" | "c")[] = ["a", "b", "c"];

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-[var(--border)] bg-background px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--sidebar)] text-sm">
            🛣
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">szutry.cc</div>
            <div className="text-[11px] text-[var(--subtle)]">
              Mapa szutrów premium i asfaltów S-tier
            </div>
          </div>
        </div>
        <button
          disabled
          title="Auth dochodzi w fazie 2"
          className="rounded-md border border-[var(--border-strong)] bg-background px-2.5 py-1 text-xs font-medium text-[var(--subtle)] opacity-60"
        >
          Zaloguj
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-[260px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-[var(--border)] bg-[var(--sidebar)] px-3 py-4 md:flex">
          <section>
            <div className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]">
              Filtry
            </div>
            <div className="flex flex-col gap-0.5">
              {kinds.map((k) => (
                <label
                  key={k}
                  className="flex cursor-pointer items-center gap-2 rounded-[4px] px-2 py-1 text-sm hover:bg-[var(--hover)]"
                >
                  <input
                    type="checkbox"
                    defaultChecked
                    disabled
                    className="h-3.5 w-3.5"
                  />
                  <span
                    className="inline-block h-[3px] w-4 rounded-full"
                    style={{ background: KIND_COLOR[k] }}
                  />
                  <span>{KIND_LABEL[k]}</span>
                </label>
              ))}
              <div className="mt-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]">
                Tier
              </div>
              {tiers.map((t) => (
                <label
                  key={t}
                  className="flex cursor-pointer items-center gap-2 rounded-[4px] px-2 py-1 text-sm hover:bg-[var(--hover)]"
                >
                  <input
                    type="checkbox"
                    defaultChecked
                    disabled
                    className="h-3.5 w-3.5"
                  />
                  <span
                    className="inline-block w-4 rounded-full bg-[var(--foreground)]"
                    style={{ height: `${TIER_WEIGHT[t]}px` }}
                  />
                  <span>{TIER_LABEL[t]}</span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-1.5 flex items-center justify-between px-2">
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]">
                Segmenty
              </div>
              <div className="text-[11px] text-[var(--faint)]">
                {segments.length}
              </div>
            </div>
            <ul className="flex flex-col gap-0.5">
              {segments.map((s) => (
                <li
                  key={s.id}
                  className="cursor-pointer rounded-[4px] px-2 py-1.5 text-sm hover:bg-[var(--hover)]"
                  title={s.name}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-[3px] w-4 shrink-0 rounded-full"
                      style={{ background: KIND_COLOR[s.kind] }}
                    />
                    <span className="truncate">{s.name}</span>
                  </div>
                  <div className="ml-6 text-[11px] text-[var(--subtle)]">
                    {TIER_LABEL[s.tier]} · {(s.distance_m / 1000).toFixed(1)} km
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-auto px-2 text-[11px] text-[var(--faint)]">
            Faza 1 · seed data · auth + DB w fazie 2
          </div>
        </aside>

        <main className="relative flex-1">
          <MapClient segments={segments} />
        </main>
      </div>
    </div>
  );
}

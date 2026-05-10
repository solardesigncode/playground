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
    <div className="flex h-screen flex-col bg-[var(--color-canvas)] text-[var(--color-ink)]">
      {/* Top nav: 64px sticky white bar with hairline bottom border (per Notion) */}
      <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-[var(--color-hairline)] bg-[var(--color-canvas)] px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface)] text-[14px]">
            🛣
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-[15px] font-semibold tracking-tight text-[var(--color-ink)]">
              szutry.cc
            </div>
            <div className="hidden text-[13px] text-[var(--color-steel)] sm:block">
              Mapa szutrów premium i asfaltów S-tier
            </div>
          </div>
        </div>
        <button
          disabled
          title="Auth dochodzi w fazie 2"
          className="cursor-not-allowed rounded-[var(--radius-md)] border border-[var(--color-hairline-strong)] bg-[var(--color-canvas)] px-[14px] py-[8px] text-[14px] font-medium text-[var(--color-steel)] opacity-60"
        >
          Zaloguj
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — Notion surface tone */}
        <aside className="hidden w-[260px] shrink-0 flex-col gap-6 overflow-y-auto border-r border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-4 md:flex">
          <section>
            <div className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[1px] text-[var(--color-stone)]">
              Filtry
            </div>
            <div className="flex flex-col gap-0.5">
              {kinds.map((k) => (
                <label
                  key={k}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-xs)] px-2 py-[6px] text-[14px] text-[var(--color-charcoal)] hover:bg-black/5"
                >
                  <input
                    type="checkbox"
                    defaultChecked
                    disabled
                    className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                  />
                  <span
                    className="inline-block h-[3px] w-4 rounded-full"
                    style={{ background: KIND_COLOR[k] }}
                  />
                  <span>{KIND_LABEL[k]}</span>
                </label>
              ))}

              <div className="mt-3 mb-1 px-2 text-[11px] font-semibold uppercase tracking-[1px] text-[var(--color-stone)]">
                Tier
              </div>
              {tiers.map((t) => (
                <label
                  key={t}
                  className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-xs)] px-2 py-[6px] text-[14px] text-[var(--color-charcoal)] hover:bg-black/5"
                >
                  <input
                    type="checkbox"
                    defaultChecked
                    disabled
                    className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                  />
                  <span
                    className="inline-block w-4 rounded-full bg-[var(--color-charcoal)]"
                    style={{ height: `${TIER_WEIGHT[t]}px` }}
                  />
                  <span>{TIER_LABEL[t]}</span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-1.5 flex items-center justify-between px-2">
              <div className="text-[11px] font-semibold uppercase tracking-[1px] text-[var(--color-stone)]">
                Segmenty
              </div>
              <div className="text-[11px] text-[var(--color-stone)]">
                {segments.length}
              </div>
            </div>
            <ul className="flex flex-col gap-0.5">
              {segments.map((s) => (
                <li
                  key={s.id}
                  className="cursor-pointer rounded-[var(--radius-xs)] px-2 py-2 hover:bg-black/5"
                  title={s.name}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="inline-block h-[3px] w-4 shrink-0 rounded-full"
                      style={{ background: KIND_COLOR[s.kind] }}
                    />
                    <span className="truncate text-[14px] text-[var(--color-charcoal)]">
                      {s.name}
                    </span>
                  </div>
                  <div className="ml-[26px] text-[12px] text-[var(--color-steel)]">
                    {TIER_LABEL[s.tier]} · {(s.distance_m / 1000).toFixed(1)} km
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-auto px-2 text-[12px] text-[var(--color-stone)]">
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

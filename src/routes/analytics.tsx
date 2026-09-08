import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavTabs } from "@/components/nav-tabs";
import { useReturnsList } from "@/hooks/use-returns-list";
import { computeStats, getDaysAging } from "@/lib/returns-shared";
import type { ReturnEntry } from "@/lib/returns.functions";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [{ title: "Analytics — SKC Digital Returns Tracker" }],
  }),
  component: AnalyticsPage,
});

const parseAmt = (v: string) => {
  const n = parseFloat((v || "").replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
};

const rand = (n: number) =>
  n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Ordered severity bands → one hue, light to dark (a sequential ramp, not
// four unrelated colors).
const AGE_BANDS = [
  { label: "0–7d", min: 0, max: 7, color: "#fcd34d" },
  { label: "8–30d", min: 8, max: 30, color: "#fbbf24" },
  { label: "31–90d", min: 31, max: 90, color: "#f59e0b" },
  { label: "90d+", min: 91, max: Infinity, color: "#d97706" },
] as const;

function AnalyticsPage() {
  const { data, isLoading } = useReturnsList();
  const stats = computeStats(data);

  // Which retailers actually drive the returns load, and what they owe.
  const byStore = useMemo(() => {
    const map = new Map<string, { count: number; outstanding: number }>();
    for (const r of data) {
      const name = (r.storeName || "").trim() || "Unspecified";
      const prev = map.get(name) ?? { count: 0, outstanding: 0 };
      const owed = Math.max(
        0,
        parseAmt(r.requestedCreditAmount) - parseAmt(r.supplierCreditAmount),
      );
      map.set(name, { count: prev.count + 1, outstanding: prev.outstanding + owed });
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [data]);

  const ageBands = useMemo(() => {
    const open = data
      .map((r: ReturnEntry) => getDaysAging(r))
      .filter((d): d is number => d !== null);
    return AGE_BANDS.map((band) => ({
      ...band,
      count: open.filter((d) => d >= band.min && d <= band.max).length,
    }));
  }, [data]);

  const openTotal = ageBands.reduce((s, b) => s + b.count, 0);
  const maxStoreCount = byStore[0]?.count ?? 1;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <NavTabs />
        <div className="flex items-center justify-center py-32 text-slate-400 gap-2 font-mono text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> crunching numbers…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavTabs />

      <main className="mx-auto max-w-[1400px] px-4 sm:px-6 py-5 space-y-4 pb-14">
        {/* ── Command bar ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#161d22] px-3.5 py-2.5 font-mono text-xs">
          <p className="text-slate-400">
            <span className="text-primary">$</span> returns --analyse --group-by=store
            <span className="ml-1 inline-block h-3.5 w-[7px] translate-y-[2px] bg-primary/70 animate-pulse" />
          </p>
          <p className="text-slate-500">{stats.total} records analysed</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-4 items-start">
          {/* ── Where returns come from ── */}
          <section className="rounded-xl border border-white/10 bg-[#20282f] overflow-hidden">
            <div className="flex items-baseline justify-between gap-3 px-5 py-3.5 border-b border-white/10">
              <h2 className="text-sm font-semibold text-slate-200">Where returns come from</h2>
              <p className="font-mono text-[11px] text-slate-500">top {byStore.length} stores</p>
            </div>
            <div className="p-5 space-y-3.5">
              {byStore.map((s) => (
                <div key={s.name}>
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <p className="min-w-0 truncate text-xs text-slate-300">{s.name}</p>
                    <p className="flex-shrink-0 font-mono text-[11px] text-slate-500 tabular-nums">
                      {s.outstanding > 0 && (
                        <span className="text-rose-400/90 mr-2">R {rand(s.outstanding)}</span>
                      )}
                      <span className="text-slate-300 font-semibold">{s.count}</span>
                    </p>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-primary/80"
                      style={{ width: `${Math.max(2, (s.count / maxStoreCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {byStore.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">No returns logged yet.</p>
              )}
            </div>
            <p className="px-5 pb-4 font-mono text-[11px] text-slate-500">
              bar = volume · red = still owed
            </p>
          </section>

          {/* ── How long they sit ── */}
          <section className="rounded-xl border border-white/10 bg-[#20282f] overflow-hidden">
            <div className="flex items-baseline justify-between gap-3 px-5 py-3.5 border-b border-white/10">
              <h2 className="text-sm font-semibold text-slate-200">How long they sit</h2>
              <p className="font-mono text-[11px] text-slate-500">{openTotal} still open</p>
            </div>
            <div className="p-5">
              <div className="flex gap-[3px] h-2.5" role="img" aria-label="Open returns by age band">
                {ageBands.map((b) =>
                  b.count === 0 ? null : (
                    <div
                      key={b.label}
                      title={`${b.label}: ${b.count}`}
                      className="rounded-full"
                      style={{
                        width: `${(b.count / Math.max(1, openTotal)) * 100}%`,
                        backgroundColor: b.color,
                        minWidth: 6,
                      }}
                    />
                  ),
                )}
              </div>

              <div className="mt-5 space-y-3">
                {ageBands.map((b) => (
                  <div key={b.label} className="flex items-center gap-3">
                    <span
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: b.color }}
                    />
                    <span className="font-mono text-xs text-slate-400 w-14">{b.label}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${openTotal ? (b.count / openTotal) * 100 : 0}%`,
                          backgroundColor: b.color,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-white tabular-nums w-8 text-right">
                      {b.count}
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-5 border-t border-white/10 pt-3 font-mono text-[11px] text-slate-500">
                {openTotal > 0
                  ? `${Math.round(((ageBands[2].count + ageBands[3].count) / openTotal) * 100)}% of open returns are older than a month`
                  : "nothing open"}
              </p>
            </div>
          </section>
        </div>

        {/* ── Mix breakdowns ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MixPanel
            title="Document type"
            rows={[
              { label: "RFC", value: stats.byType.RFC },
              { label: "GRS", value: stats.byType.GRS },
              { label: "GRN", value: stats.byType.GRN },
            ]}
            total={stats.total}
          />
          <MixPanel
            title="Product"
            rows={[
              { label: "Laptop", value: stats.byProduct.laptop },
              { label: "Printer", value: stats.byProduct.printer },
              { label: "RMA", value: stats.byProduct.rma },
            ]}
            total={stats.total}
          />
          <MixPanel
            title="Credit status"
            rows={[
              { label: "Supplier credit", value: stats.supplierCredit },
              { label: "Unit on hand", value: stats.unitOnHand },
              { label: "No physical unit", value: stats.noPhysicalUnit },
            ]}
            total={stats.total}
          />
        </div>

        <p className="pt-1 text-center font-mono text-[11px] text-slate-600">
          SKC Digital · built to scale
        </p>
      </main>
    </div>
  );
}

function MixPanel({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { label: string; value: number }[];
  total: number;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#20282f] p-5">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {title}
      </p>
      <div className="mt-4 space-y-3">
        {rows.map((r) => {
          const pct = total ? (r.value / total) * 100 : 0;
          return (
            <div key={r.label}>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-xs text-slate-400 truncate">{r.label}</span>
                <span className="font-mono text-[11px] text-slate-500 tabular-nums flex-shrink-0">
                  <span className="text-slate-300 font-semibold">{r.value}</span>
                  <span className="ml-1.5">{pct.toFixed(0)}%</span>
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/5">
                <div
                  className={cn("h-full rounded-full bg-primary/70")}
                  style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

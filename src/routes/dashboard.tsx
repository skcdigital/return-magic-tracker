import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import { format } from "date-fns";
import { ArrowRight, Loader2 } from "lucide-react";
import { NavTabs } from "@/components/nav-tabs";
import { useReturnsList } from "@/hooks/use-returns-list";
import {
  AGING_THRESHOLD_DAYS,
  computeStats,
  computeWeeklyTrend,
  getDaysAging,
} from "@/lib/returns-shared";
import type { ReturnEntry } from "@/lib/returns.functions";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — SKC Digital Returns Tracker" }],
  }),
  component: DashboardPage,
});

const rand = (n: number) => n.toLocaleString("en-ZA", { minimumFractionDigits: 2 });

// Four stages the business actually thinks in, rather than seven raw statuses.
// Status colors, since each segment means a state (open / done / paid / lost).
const STAGES = [
  { key: "open", label: "Open", color: "#22d3ee" },
  { key: "completed", label: "Completed", color: "#34d399" },
  { key: "credited", label: "Credited", color: "#a78bfa" },
  { key: "missing", label: "Missing", color: "#fb7185" },
] as const;

function DashboardPage() {
  const { data, isLoading } = useReturnsList();

  const stats = computeStats(data);
  const weeklyTrend = computeWeeklyTrend(data);

  const oldestOpen = useMemo(() => {
    return data
      .map((r) => ({ entry: r, days: getDaysAging(r) }))
      .filter((x): x is { entry: ReturnEntry; days: number } => x.days !== null)
      .filter((x) => x.days > AGING_THRESHOLD_DAYS)
      .sort((a, b) => b.days - a.days)
      .slice(0, 6);
  }, [data]);

  const openCount = stats.pending + stats.started + stats.inProgress + stats.incomplete;
  const stageCounts = {
    open: openCount,
    completed: stats.completed,
    credited: stats.creditProcessed,
    missing: stats.missing,
  } as const;

  const recoveredPct =
    stats.totalRequestedCredit > 0
      ? (stats.totalSupplierCredit / stats.totalRequestedCredit) * 100
      : 0;
  const outstanding = Math.max(0, stats.totalRequestedCredit - stats.totalSupplierCredit);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <NavTabs />
        <div className="flex items-center justify-center py-32 text-slate-400 gap-2 font-mono text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> loading returns…
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
            <span className="text-primary">$</span> returns --status --outstanding
            <span className="ml-1 inline-block h-3.5 w-[7px] translate-y-[2px] bg-primary/70 animate-pulse" />
          </p>
          <p className="text-slate-500">
            {stats.total} records · synced {format(new Date(), "dd MMM HH:mm")}
          </p>
        </div>

        {/* ── Money + pipeline ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4">
          {/* Hero: what the business is owed */}
          <section className="relative overflow-hidden rounded-xl border border-white/10 bg-[#20282f] p-5 sm:p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-primary/15 blur-3xl"
            />
            <div className="relative">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Outstanding credit
              </p>
              <p className="mt-1.5 text-[clamp(2.25rem,5.5vw,3.5rem)] font-semibold leading-none tracking-tight text-white">
                <span className="text-slate-500 text-[0.45em] align-top mr-1.5">R</span>
                {rand(outstanding)}
              </p>

              {/* Meter: recovered against what was requested */}
              <div className="mt-6">
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <p className="text-xs text-slate-400">
                    <span className="font-semibold text-emerald-400">R {rand(stats.totalSupplierCredit)}</span>{" "}
                    recovered
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    of R {rand(stats.totalRequestedCredit)}
                  </p>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-white/8"
                  role="img"
                  aria-label={`${recoveredPct.toFixed(1)} percent of requested credit recovered`}
                >
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-[width] duration-700"
                    style={{ width: `${Math.min(100, recoveredPct)}%` }}
                  />
                </div>
                <p className="mt-2 font-mono text-[11px] text-slate-500">
                  {recoveredPct.toFixed(1)}% recovered · {(100 - recoveredPct).toFixed(1)}% still owed
                </p>
              </div>
            </div>
          </section>

          {/* Pipeline: part-to-whole across the four stages */}
          <section className="rounded-xl border border-white/10 bg-[#20282f] p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Pipeline
              </p>
              <p className="font-mono text-xs text-slate-500">{stats.total} total</p>
            </div>

            <div className="mt-5 flex gap-[3px] h-2.5" role="img" aria-label="Returns by stage">
              {STAGES.map(({ key, label, color }) => {
                const count = stageCounts[key];
                if (count === 0) return null;
                const pct = stats.total ? (count / stats.total) * 100 : 0;
                return (
                  <div
                    key={key}
                    title={`${label}: ${count}`}
                    className="rounded-full transition-opacity hover:opacity-80"
                    style={{ width: `${pct}%`, backgroundColor: color, minWidth: 6 }}
                  />
                );
              })}
            </div>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-4">
              {STAGES.map(({ key, label, color }) => (
                <div key={key}>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[11px] text-slate-400">{label}</span>
                  </div>
                  <p className="mt-1 pl-3 text-2xl font-semibold text-white">{stageCounts[key]}</p>
                </div>
              ))}
            </div>

            <p className="mt-4 border-t border-white/10 pt-3 font-mono text-[11px] text-slate-500">
              pending={stats.pending} started={stats.started} in_progress={stats.inProgress}{" "}
              incomplete={stats.incomplete}
            </p>
          </section>
        </div>

        {/* ── Aging + trend ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Oldest open: magnitude, one hue, worst first */}
          <section className="rounded-xl border border-white/10 bg-[#20282f] overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <h2 className="text-sm font-semibold text-slate-200">Oldest still open</h2>
              </div>
              <Link
                to="/returns"
                className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-400 hover:text-primary transition-colors"
              >
                all {stats.aging} aging <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {oldestOpen.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                Nothing open past {AGING_THRESHOLD_DAYS} days. Clean sheet.
              </p>
            ) : (
              <div className="p-5 pt-4 space-y-3">
                {oldestOpen.map(({ entry, days }) => {
                  const worst = oldestOpen[0].days;
                  return (
                    <div key={entry.id}>
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <p className="min-w-0 text-xs text-slate-300 truncate">
                          <span className="font-mono text-slate-500 mr-1.5">{entry.refType}</span>
                          <span className="font-mono">{entry.refNumber || "—"}</span>
                          <span className="text-slate-500"> · {entry.storeName || "no store"}</span>
                        </p>
                        <p className="font-mono text-xs font-semibold text-amber-400 tabular-nums flex-shrink-0">
                          {days}d
                        </p>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-amber-400/70"
                          style={{ width: `${Math.max(3, (days / worst) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Weekly trend */}
          <section className="rounded-xl border border-white/10 bg-[#20282f] overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/10">
              <h2 className="text-sm font-semibold text-slate-200">Returns logged</h2>
              <p className="font-mono text-[11px] text-slate-500">last 8 weeks</p>
            </div>
            <div className="px-2 py-4 h-[232px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyTrend} margin={{ top: 8, right: 18, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#ffffff0f" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={{ stroke: "#ffffff14" }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={26}
                  />
                  <RechartsTooltip
                    cursor={{ stroke: "#ffffff26", strokeWidth: 1 }}
                    contentStyle={{
                      background: "#161d22",
                      border: "1px solid #ffffff1a",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                    formatter={(value: number) => [value, "Returns"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    fill="url(#trendCount)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "#161d22" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <p className="pt-1 text-center font-mono text-[11px] text-slate-600">
          SKC Digital · built to scale
        </p>
      </main>
    </div>
  );
}

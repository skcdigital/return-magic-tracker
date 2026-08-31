import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import { AlertTriangle, TrendingUp, Loader2, LayoutDashboard, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavTabs } from "@/components/nav-tabs";
import { useReturnsList } from "@/hooks/use-returns-list";
import { AGING_THRESHOLD_DAYS, StatCard, computeStats, computeWeeklyTrend } from "@/lib/returns-shared";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — SKC Digital Returns Tracker" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useReturnsList();
  const [agingOnly, setAgingOnly] = useState(false);

  const stats = computeStats(data);
  const weeklyTrend = computeWeeklyTrend(data);

  return (
    <div className="min-h-screen bg-background">
      <NavTabs />

      <main className="mx-auto max-w-[1400px] px-6 py-6 space-y-6 pb-12">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">Dashboard</h1>
            <p className="text-xs text-slate-400">
              Live overview of every RFC / GRS / GRN return on file
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              <StatCard label="Total Returns" value={stats.total} color="text-white" dot="bg-slate-500" />
              <StatCard
                label="Active"
                value={stats.started + stats.inProgress + stats.pending + stats.incomplete}
                color="text-blue-400"
                dot="bg-blue-500"
              />
              <StatCard
                label="Completed"
                value={stats.completed}
                color="text-emerald-400"
                dot="bg-emerald-500"
              />
              <StatCard
                label="Credited"
                value={stats.creditProcessed}
                color="text-violet-400"
                dot="bg-violet-500"
              />
              <StatCard label="Missing" value={stats.missing} color="text-rose-400" dot="bg-rose-500" />
              <StatCard
                label="Incomplete"
                value={stats.incomplete}
                color="text-amber-400"
                dot="bg-amber-500"
              />
              <button
                onClick={() => setAgingOnly((v) => !v)}
                className="text-left"
                title={`Returns open more than ${AGING_THRESHOLD_DAYS} days`}
              >
                <StatCard
                  label={`Aging (>${AGING_THRESHOLD_DAYS}d)`}
                  value={stats.aging}
                  color="text-amber-400"
                  dot="bg-amber-400"
                  highlighted={agingOnly}
                  pulse={stats.aging > 0}
                />
              </button>
            </div>

            {agingOnly && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  {stats.aging} return{stats.aging === 1 ? "" : "s"} open more than{" "}
                  {AGING_THRESHOLD_DAYS} days.{" "}
                  <a href="/returns" className="underline underline-offset-2 hover:text-white">
                    View them on the Returns page →
                  </a>
                </span>
                <button
                  onClick={() => setAgingOnly(false)}
                  className="ml-auto text-amber-300 hover:text-white underline underline-offset-2"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Financial overview + trend, side by side on wide screens */}
            <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4 items-stretch">
              {/* Financial overview */}
              <div className="bg-[#20282f] rounded-xl border border-white/10 shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-slate-400" />
                    <h2 className="text-sm font-semibold text-slate-200">Financial Overview</h2>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-[11px] text-slate-400 font-medium">Live</span>
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-center gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                      Total Requested
                    </p>
                    <p className="text-xl font-bold text-white">
                      R{" "}
                      {stats.totalRequestedCredit.toLocaleString("en-ZA", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                      Supplier Credited
                    </p>
                    <p className="text-xl font-bold text-emerald-400">
                      R{" "}
                      {stats.totalSupplierCredit.toLocaleString("en-ZA", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  {stats.totalRequestedCredit > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                        Outstanding
                      </p>
                      <p
                        className={cn(
                          "text-xl font-bold",
                          stats.totalRequestedCredit - stats.totalSupplierCredit > 0
                            ? "text-rose-400"
                            : "text-emerald-400",
                        )}
                      >
                        R{" "}
                        {Math.abs(
                          stats.totalRequestedCredit - stats.totalSupplierCredit,
                        ).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  {stats.totalRequestedCredit === 0 && stats.totalSupplierCredit === 0 && (
                    <p className="text-xs text-slate-400">
                      No credit amounts logged yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Trend chart */}
              <div className="bg-[#20282f] rounded-xl border border-white/10 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-slate-400" />
                    <h2 className="text-sm font-semibold text-slate-200">Weekly Trend</h2>
                  </div>
                  <span className="text-[11px] text-slate-400">Last 8 weeks</span>
                </div>
                <div className="p-5 pl-1 h-72 xl:h-[calc(100%-52px)]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyTrend} margin={{ top: 5, right: 20, left: 5, bottom: 0 }}>
                      <defs>
                        <linearGradient id="trendCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={{ stroke: "#ffffff1a" }}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          background: "#1c242a",
                          border: "1px solid #ffffff1a",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "#e2e8f0" }}
                        formatter={(value: number, name: string) => [
                          name === "credit" ? `R ${value.toLocaleString("en-ZA")}` : value,
                          name === "credit" ? "Supplier credit" : "Returns",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#22d3ee"
                        strokeWidth={2}
                        fill="url(#trendCount)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
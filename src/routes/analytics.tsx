import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavTabs } from "@/components/nav-tabs";
import { useReturnsList } from "@/hooks/use-returns-list";
import { computeStats } from "@/lib/returns-shared";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [{ title: "Analytics — SKC Digital Returns Tracker" }],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data, isLoading } = useReturnsList();
  const stats = computeStats(data);
  const activeData = data.filter((r) => r.status !== "credit_processed");

  return (
    <div className="min-h-screen bg-background">
      <NavTabs />

      <main className="mx-auto max-w-[1400px] px-6 py-6 space-y-5 pb-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-slate-400 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…
          </div>
        ) : (
          <div className="bg-[#20282f] rounded-xl border border-white/10 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-200">Analytics</h2>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Live
              </span>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-6">
              {/* By Type */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                  Document Type
                </p>
                {(["RFC", "GRS", "GRN"] as const).map((t) => (
                  <div key={t} className="mb-3 last:mb-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-300">{t}</span>
                      <span className="text-xs font-bold text-white">{stats.byType[t]}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#232e36] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-800 transition-all duration-700"
                        style={{
                          width: stats.total ? `${(stats.byType[t] / stats.total) * 100}%` : "0%",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {/* By Status */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                  Status
                </p>
                {(
                  [
                    { k: "completed", label: "Completed", color: "bg-emerald-500" },
                    { k: "in_progress", label: "In Progress", color: "bg-blue-500" },
                    { k: "started", label: "Started", color: "bg-sky-400" },
                    { k: "pending", label: "Pending", color: "bg-amber-400" },
                    { k: "incomplete", label: "Incomplete", color: "bg-orange-400" },
                    { k: "missing", label: "Missing", color: "bg-rose-500" },
                  ] as const
                ).map(({ k, label, color }) => {
                  const count = activeData.filter((d) => d.status === k).length;
                  if (count === 0) return null;
                  return (
                    <div key={k} className="mb-2 last:mb-0">
                      <div className="flex justify-between mb-0.5">
                        <span className="text-xs text-slate-400">{label}</span>
                        <span className="text-xs font-bold text-slate-100">{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#232e36] overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-700", color)}
                          style={{
                            width: activeData.length
                              ? `${(count / activeData.length) * 100}%`
                              : "0%",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* By Product */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                  Product Type
                </p>
                {[
                  { label: "Laptop", val: stats.byProduct.laptop, color: "bg-sky-500" },
                  { label: "Printer", val: stats.byProduct.printer, color: "bg-violet-500" },
                  { label: "RMA", val: stats.byProduct.rma, color: "bg-amber-400" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="mb-3 last:mb-0">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-300">{label}</span>
                      <span className="text-xs font-bold text-white">{val}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#232e36] overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-700", color)}
                        style={{ width: stats.total ? `${(val / stats.total) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {/* Credit Status */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                  Credit Status
                </p>
                {[
                  { label: "Supplier Credit", val: stats.supplierCredit, color: "bg-emerald-500" },
                  { label: "Unit on Hand", val: stats.unitOnHand, color: "bg-slate-500" },
                  { label: "No Physical Unit", val: stats.noPhysicalUnit, color: "bg-rose-400" },
                  { label: "Credited ✓", val: stats.creditProcessed, color: "bg-violet-500" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="mb-2 last:mb-0">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs text-slate-400">{label}</span>
                      <span className="text-xs font-bold text-slate-100">{val}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#232e36] overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-700", color)}
                        style={{ width: stats.total ? `${(val / stats.total) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";

// ── Animated counter hook ──
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (from === target) return;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * ease));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
import { format, isWithinInterval, parseISO } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import {
  PackageOpen,
  Plus,
  Download,
  Search,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  PlayCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  Calendar as CalendarIcon,
  ArrowUpDown,
  Check,
  Loader2,
  Eye,
  EyeOff,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  DollarSign,
  Activity,
  CreditCard,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  listReturns,
  createReturn,
  updateReturn,
  deleteReturn,
  type ReturnEntry,
  type RefType,
  type Status,
  type Bundle,
  type ProductType,
  type CreditStatus,
} from "@/lib/returns.functions";
import { SignOutButton } from "@/components/auth-gate";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Returns Tracker — SKC Digital" },
      {
        name: "description",
        content:
          "Professional tracker for RFC, GRS and GRN retail credit returns — log references, job numbers, serials, stores, locations and statuses.",
      },
    ],
  }),
  component: ReturnsTrackerPage,
});

const RETAILERS = [
  "OK Furniture",
  "Lewis Stores",
  "Beares",
  "Pick n Pay",
  "Checkers",
  "Makro",
  "Game",
  "Russells",
  "Bradlows",
  "Hi-Fi Corp",
  "Incredible Connection",
  "House and Home",
  "Railway Funishers",
];

const emptyEntry = (): Omit<ReturnEntry, "id" | "createdAt"> => ({
  refType: "RFC",
  refNumber: "",
  jobNumber: "",
  serialNumber: "",
  storeName: "",
  productType: "laptop",
  bundle: "no",
  unitLocation: "",
  date: format(new Date(), "yyyy-MM-dd"),
  status: "pending",
  creditStatus: "unit_on_hand",
  creditNoteNumber: "",
  notes: "",
  requestedCreditAmount: "",
  supplierCreditAmount: "",
});

const STATUS_META: Record<Status, { label: string; icon: typeof Clock; cls: string }> = {
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    cls: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  },
  started: {
    label: "Started",
    icon: PlayCircle,
    cls: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    cls: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  },
  missing: {
    label: "Missing",
    icon: AlertTriangle,
    cls: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
  },
  incomplete: {
    label: "Incomplete",
    icon: AlertTriangle,
    cls: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200",
  },
  in_progress: {
    label: "In Progress",
    icon: Activity,
    cls: "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200",
  },
  credit_processed: {
    label: "Credit Processed",
    icon: CreditCard,
    cls: "bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200",
  },
};

function ProductTypeCell({ value }: { value: ProductType }) {
  const config: Record<ProductType, { label: string; color: string }> = {
    laptop: { label: "Laptop", color: "bg-sky-50 text-sky-700 ring-sky-200" },
    printer: { label: "Printer", color: "bg-violet-50 text-violet-700 ring-violet-200" },
    rma: { label: "RMA", color: "bg-amber-50 text-amber-700 ring-amber-200" },
  };
  const { label, color } = config[value] || config.laptop;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        color,
      )}
    >
      {label}
    </span>
  );
}

function BundleCell({ value }: { value: Bundle }) {
  if (value === "yes")
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">
        <Check className="h-3.5 w-3.5" /> Yes
      </span>
    );
  if (value === "partial")
    return (
      <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-semibold">
        <AlertTriangle className="h-3.5 w-3.5" /> Partial
      </span>
    );
  if (value === "standalone_laptop")
    return (
      <span className="inline-flex items-center gap-1 text-blue-700 text-xs font-semibold">
        <Check className="h-3.5 w-3.5" /> Standalone
      </span>
    );
  if (value === "none")
    return (
      <span className="inline-flex items-center gap-1 text-slate-200 text-xs font-semibold">
        <X className="h-3.5 w-3.5" /> None
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-rose-700 text-xs font-semibold">
      <X className="h-3.5 w-3.5" /> No
    </span>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        m.cls,
      )}
    >
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}

type SortKey = keyof Pick<
  ReturnEntry,
  | "refType"
  | "refNumber"
  | "jobNumber"
  | "serialNumber"
  | "storeName"
  | "unitLocation"
  | "status"
  | "date"
>;

type AppTab = "active" | "credited";

// ── Read-only view (shareable link with ?view=readonly) ──
function ReadOnlyView({ data }: { data: ReturnEntry[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewEntry, setViewEntry] = useState<ReturnEntry | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((r) => {
      const hay = [r.refNumber, r.jobNumber, r.serialNumber, r.storeName, r.notes]
        .join(" ")
        .toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.refType !== typeFilter) return false;
      return true;
    });
  }, [data, search, statusFilter, typeFilter]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-7 pb-16">
        <header className="flex flex-wrap items-start justify-between gap-4 mb-7">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
              <PackageOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-[18px] font-semibold tracking-tight">Returns Tracker</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                SKC Digital · RFC / GRS / GRN retail credit returns
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
            <Eye className="h-3 w-3" /> Read-only view
          </span>
        </header>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Returns", value: data.length, cls: "text-slate-100" },
            {
              label: "Completed",
              value: data.filter((d) => d.status === "completed" || d.status === "credit_processed")
                .length,
              cls: "text-emerald-700",
            },
            {
              label: "Pending / Active",
              value: data.filter((d) =>
                ["pending", "started", "in_progress", "incomplete"].includes(d.status),
              ).length,
              cls: "text-amber-700",
            },
            {
              label: "Missing",
              value: data.filter((d) => d.status === "missing").length,
              cls: "text-rose-700",
            },
          ].map(({ label, value, cls }) => (
            <div key={label} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                {label}
              </div>
              <div className={cn("text-2xl font-bold tracking-tight", cls)}>{value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] rounded-md border bg-card px-3 py-2 shadow-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ref, job no., serial, store…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="started">Started</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="missing">Missing</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px] bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="RFC">RFC</SelectItem>
              <SelectItem value="GRS">GRS</SelectItem>
              <SelectItem value="GRN">GRN</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-muted/50 border-b">
                <tr className="text-left">
                  {[
                    "Type",
                    "Reference",
                    "Job No.",
                    "Serial No.",
                    "Store",
                    "Product",
                    "Bundle",
                    "Location",
                    "Status",
                    "Credit",
                    "Date",
                    "Notes",
                    "Images",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b last:border-0 bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setViewEntry(r)}
                  >
                    <td className="px-3.5 py-2.5">
                      <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-accent text-accent-foreground border border-blue-100">
                        {r.refType}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="font-mono text-xs px-2 py-0.5 rounded border bg-muted/40 text-muted-foreground">
                        {r.refNumber || "—"}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-xs text-muted-foreground">
                      {r.jobNumber || "—"}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-xs text-muted-foreground">
                      {r.serialNumber || "—"}
                    </td>
                    <td className="px-3.5 py-2.5 font-medium">{r.storeName || "—"}</td>
                    <td className="px-3.5 py-2.5">
                      <ProductTypeCell value={r.productType} />
                    </td>
                    <td className="px-3.5 py-2.5">
                      <BundleCell value={r.bundle} />
                    </td>
                    <td className="px-3.5 py-2.5 text-xs text-muted-foreground">
                      {r.unitLocation || "—"}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3.5 py-2.5 text-xs">
                      {r.creditStatus === "supplier_credit" ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-emerald-700">Supplier credit</span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {r.creditNoteNumber || "— no CN —"}
                          </span>
                        </div>
                      ) : r.creditStatus === "no_physical_unit" ? (
                        <span className="font-semibold text-rose-700">No physical unit</span>
                      ) : (
                        <span className="font-semibold text-slate-200">Unit on hand</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {r.date ? format(new Date(r.date + "T00:00:00"), "dd MMM yyyy") : "—"}
                    </td>
                    <td className="px-3.5 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate" title={r.notes}>
                      {r.notes || "—"}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-14 text-center text-muted-foreground text-sm">
                      No results found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Read-only view · SKC Digital
        </p>
      </div>

      {/* Detail modal for read-only */}
      {viewEntry && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setViewEntry(null)}
        >
          <div
            className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-slate-900 to-slate-800 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-[#20282f]/10 text-white border border-white/20">
                  {viewEntry.refType}
                </span>
                <div>
                  <p className="text-white font-bold text-lg">{viewEntry.refNumber || "—"}</p>
                  <p className="text-white/60 text-xs">
                    {viewEntry.storeName || "No store"} ·{" "}
                    {viewEntry.date
                      ? format(new Date(viewEntry.date + "T00:00:00"), "dd MMM yyyy")
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={viewEntry.status} />
                <button
                  onClick={() => setViewEntry(null)}
                  className="p-1.5 hover:bg-[#20282f]/10 rounded-lg transition-colors text-white/60 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Job Number" value={viewEntry.jobNumber} mono />
              <DetailRow label="Serial Number" value={viewEntry.serialNumber} mono />
              <DetailRow
                label="Product"
                value={<ProductTypeCell value={viewEntry.productType} />}
              />
              <DetailRow label="Bundle" value={<BundleCell value={viewEntry.bundle} />} />
              <DetailRow label="Unit Location" value={viewEntry.unitLocation} />
              <DetailRow
                label="Date"
                value={
                  viewEntry.date
                    ? format(new Date(viewEntry.date + "T00:00:00"), "dd MMMM yyyy")
                    : "—"
                }
              />
              <div className="col-span-2 border-t pt-3 mt-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Credit Information
                </p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <DetailRow
                    label="Credit Status"
                    value={
                      viewEntry.creditStatus === "supplier_credit" ? (
                        <span className="text-emerald-700 font-semibold">Supplier Credit</span>
                      ) : viewEntry.creditStatus === "no_physical_unit" ? (
                        <span className="text-rose-700 font-semibold">No Physical Unit</span>
                      ) : (
                        <span className="text-slate-200 font-semibold">Unit on Hand</span>
                      )
                    }
                  />
                  {viewEntry.creditNoteNumber && (
                    <DetailRow label="Credit Note No." value={viewEntry.creditNoteNumber} mono />
                  )}
                  {viewEntry.requestedCreditAmount && (
                    <DetailRow
                      label="Credit Requested"
                      value={
                        <span className="font-bold text-blue-700">
                          R {viewEntry.requestedCreditAmount}
                        </span>
                      }
                    />
                  )}
                  {viewEntry.supplierCreditAmount && (
                    <DetailRow
                      label="Supplier Credited"
                      value={
                        <span className="font-bold text-emerald-700">
                          R {viewEntry.supplierCreditAmount}
                        </span>
                      }
                    />
                  )}
                </div>
              </div>
              {viewEntry.notes && (
                <div className="col-span-2 border-t pt-3 mt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Notes
                  </p>
                  <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">
                    {viewEntry.notes}
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end px-5 pb-5 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setViewEntry(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function ReturnsTrackerPage() {
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listReturns);
  const fetchCreate = useServerFn(createReturn);
  const fetchUpdate = useServerFn(updateReturn);
  const fetchDelete = useServerFn(deleteReturn);

  // Check for read-only mode via URL param ?view=readonly
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Use effect to check URL params on client-side only (avoids hydration mismatch)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setIsReadOnly(params.get("view") === "readonly");
    }
  }, []);

  const {
    data: listData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["returns"],
    queryFn: () => fetchList(),
  });

  const data = listData?.entries ?? [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [activeTab, setActiveTab] = useState<AppTab>("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyEntry());
  const [copyToast, setCopyToast] = useState(false);
  const [viewEntry, setViewEntry] = useState<ReturnEntry | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const createMutation = useMutation({
    mutationFn: (entry: Omit<ReturnEntry, "id" | "createdAt">) => fetchCreate({ data: entry }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      setModalOpen(false);
      setSaveError(null);
      setSubmitAttempted(false);
      showToast("Return added successfully");
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Failed to save — please try again.";
      setSaveError(msg);
      showToast(msg, "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (entry: ReturnEntry) => fetchUpdate({ data: entry }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      setModalOpen(false);
      setSaveError(null);
      setSubmitAttempted(false);
      showToast("Changes saved successfully");
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Failed to save — please try again.";
      setSaveError(msg);
      showToast(msg, "error");
    },
  });

  const quickStatusMutation = useMutation({
    mutationFn: (entry: ReturnEntry) => fetchUpdate({ data: entry }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      showToast("Status updated");
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : "Failed to update status", "error");
    },
  });

  const markCreditedMutation = useMutation({
    mutationFn: (entry: ReturnEntry) =>
      fetchUpdate({ data: { ...entry, status: "credit_processed" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      showToast("Moved to Credited");
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : "Failed to update", "error");
    },
  });

  const restoreActiveMutation = useMutation({
    mutationFn: (entry: ReturnEntry) => fetchUpdate({ data: { ...entry, status: "completed" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      showToast("Restored to Active");
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : "Failed to restore", "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchDelete({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["returns"] });
      showToast("Entry deleted");
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : "Failed to delete", "error");
    },
  });

  const activeData = useMemo(() => data.filter((r) => r.status !== "credit_processed"), [data]);
  const creditedData = useMemo(() => data.filter((r) => r.status === "credit_processed"), [data]);
  const tableSource = activeTab === "credited" ? creditedData : activeData;

  const stores = useMemo(
    () => [...new Set(data.map((d) => d.storeName).filter(Boolean))].sort(),
    [data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tableSource
      .filter((r) => {
        const hay = [r.refNumber, r.jobNumber, r.serialNumber, r.storeName, r.notes, r.unitLocation]
          .join(" ")
          .toLowerCase();
        if (q && !hay.includes(q)) return false;
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (typeFilter !== "all" && r.refType !== typeFilter) return false;
        if (storeFilter !== "all" && r.storeName !== storeFilter) return false;
        if (dateFrom && r.date && r.date < dateFrom) return false;
        if (dateTo && r.date && r.date > dateTo) return false;
        return true;
      })
      .sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        return av < bv ? sortDir : av > bv ? -sortDir : 0;
      });
  }, [
    tableSource,
    search,
    statusFilter,
    typeFilter,
    storeFilter,
    dateFrom,
    dateTo,
    sortKey,
    sortDir,
  ]);

  const stats = useMemo(() => {
    const parseAmt = (v: string) => {
      const n = parseFloat(v.replace(/[^0-9.]/g, ""));
      return isNaN(n) ? 0 : n;
    };
    return {
      total: data.length,
      completed: data.filter((d) => d.status === "completed").length,
      creditProcessed: data.filter((d) => d.status === "credit_processed").length,
      started: data.filter((d) => d.status === "started").length,
      inProgress: data.filter((d) => d.status === "in_progress").length,
      pending: data.filter((d) => d.status === "pending").length,
      incomplete: data.filter((d) => d.status === "incomplete").length,
      missing: data.filter((d) => d.status === "missing").length,
      supplierCredit: data.filter((d) => d.creditStatus === "supplier_credit").length,
      unitOnHand: data.filter((d) => d.creditStatus === "unit_on_hand").length,
      noPhysicalUnit: data.filter((d) => d.creditStatus === "no_physical_unit").length,
      byType: {
        RFC: data.filter((d) => d.refType === "RFC").length,
        GRS: data.filter((d) => d.refType === "GRS").length,
        GRN: data.filter((d) => d.refType === "GRN").length,
      },
      byProduct: {
        laptop: data.filter((d) => d.productType === "laptop").length,
        printer: data.filter((d) => d.productType === "printer").length,
        rma: data.filter((d) => d.productType === "rma").length,
      },
      bundleIssues: data.filter((d) => d.bundle === "no" || d.bundle === "partial").length,
      totalRequestedCredit: data.reduce((s, d) => s + parseAmt(d.requestedCreditAmount), 0),
      totalSupplierCredit: data.reduce((s, d) => s + parseAmt(d.supplierCreditAmount), 0),
    };
  }, [data]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((s) => (s === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setSortDir(1);
    }
  }

  function openAdd() {
    setEditingId(null);
    setForm(emptyEntry());
    setSaveError(null);
    setSubmitAttempted(false);
    setModalOpen(true);
  }

  function openEdit(r: ReturnEntry) {
    setEditingId(r.id);
    setForm({
      refType: r.refType,
      refNumber: r.refNumber,
      jobNumber: r.jobNumber,
      serialNumber: r.serialNumber,
      storeName: r.storeName,
      productType: r.productType ?? "laptop",
      bundle: r.bundle,
      unitLocation: r.unitLocation,
      date: r.date,
      status: r.status,
      creditStatus: r.creditStatus ?? "unit_on_hand",
      creditNoteNumber: r.creditNoteNumber ?? "",
      notes: r.notes,
      requestedCreditAmount: r.requestedCreditAmount ?? "",
      supplierCreditAmount: r.supplierCreditAmount ?? "",
    });
    setSaveError(null);
    setSubmitAttempted(false);
    setModalOpen(true);
  }

  function save() {
    setSubmitAttempted(true);
    if (!form.refNumber.trim()) return;
    setSaveError(null);
    if (editingId) updateMutation.mutate({ ...form, id: editingId, createdAt: "" });
    else createMutation.mutate(form);
  }

  function remove(id: string) {
    if (confirm("Delete this return entry?")) deleteMutation.mutate(id);
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    // ─── Data sheet ───
    const productLabels: Record<ProductType, string> = {
      laptop: "Laptop",
      printer: "Printer",
      rma: "RMA",
    };
    const rows = filtered.map((r) => ({
      Type: r.refType,
      Reference: r.refNumber,
      "Job Number": r.jobNumber,
      "Serial Number": r.serialNumber,
      Store: r.storeName,
      Product: productLabels[r.productType] || "Unknown",
      Bundle:
        r.bundle === "yes"
          ? "Yes"
          : r.bundle === "partial"
            ? "Partial"
            : r.bundle === "standalone_laptop"
              ? "Standalone Laptop"
              : "None",
      Location: r.unitLocation,
      Date: r.date,
      Status: r.status.charAt(0).toUpperCase() + r.status.slice(1),
      "Credit Status": r.creditStatus === "supplier_credit" ? "Supplier Credit" : "Unit on Hand",
      "Credit Note No.": r.creditNoteNumber,
      Notes: r.notes,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [8, 16, 14, 18, 20, 12, 14, 16, 12, 12, 16, 16, 30].map((w) => ({ wch: w }));
    ws["!freeze"] = { xSplit: 0, ySplit: 1 }; // Freeze header row

    // Define border and center alignment for all cells
    const borderStyle = { style: "thin", color: { rgb: "D1D5DB" } };
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" }, size: 11 },
      fill: { fgColor: { rgb: "1F2937" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle },
    };

    // Status colors for cells
    const statusColors: Record<string, string> = {
      Completed: "C6EFCE",
      Started: "FFEB9C",
      Pending: "FFC7CE",
      Missing: "FF6B6B",
    };

    // Apply formatting to all cells
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + (R + 1);
        if (!ws[address]) continue;

        if (R === 0) {
          // Header row
          ws[address].s = headerStyle;
        } else {
          // Data rows with alternating colors
          const isAlternate = R % 2 === 0;
          const cell = ws[address];

          // Get status value for conditional coloring
          const statusCol = rows[R - 1]?.Status;
          const statusBgColor = statusColors[statusCol];

          cell.s = {
            font: { color: { rgb: "1F2937" }, size: 10 },
            fill: statusBgColor
              ? { fgColor: { rgb: statusBgColor } }
              : isAlternate
                ? { fgColor: { rgb: "F9FAFB" } }
                : { fgColor: { rgb: "FFFFFF" } },
            alignment: { horizontal: "left", vertical: "center", wrapText: true },
            border: {
              top: { style: "thin", color: { rgb: "E5E7EB" } },
              bottom: { style: "thin", color: { rgb: "E5E7EB" } },
              left: { style: "thin", color: { rgb: "E5E7EB" } },
              right: { style: "thin", color: { rgb: "E5E7EB" } },
            },
          };

          // Center align specific columns
          if ([0, 4, 6, 9, 10].includes(C)) {
            cell.s!.alignment = { horizontal: "center", vertical: "center", wrapText: true };
          }
        }
      }
    }

    // ─── Summary sheet with professional formatting ───
    const totalReturns = filtered.length;
    const summaryData = [
      ["", "", ""],
      ["RETURNS TRACKER SUMMARY", "", ""],
      ["", "", ""],
      ["Generated on", format(new Date(), "dd MMM yyyy HH:mm:ss"), ""],
      ["Total Records", totalReturns, ""],
      ["", "", ""],
      ["STATUS BREAKDOWN", "", "Count"],
      ["Completed", "", filtered.filter((d) => d.status === "completed").length],
      ["Started", "", filtered.filter((d) => d.status === "started").length],
      ["Pending", "", filtered.filter((d) => d.status === "pending").length],
      ["Missing", "", filtered.filter((d) => d.status === "missing").length],
      ["", "", ""],
      ["PRODUCT BREAKDOWN", "", "Count"],
      ["Laptops", "", filtered.filter((d) => d.productType === "laptop").length],
      ["Printers", "", filtered.filter((d) => d.productType === "printer").length],
      ["RMA", "", filtered.filter((d) => d.productType === "rma").length],
      ["", "", ""],
      ["BUNDLE STATUS", "", "Count"],
      ["Full Bundle", "", filtered.filter((d) => d.bundle === "yes").length],
      ["Partial", "", filtered.filter((d) => d.bundle === "partial").length],
      ["Standalone Laptop", "", filtered.filter((d) => d.bundle === "standalone_laptop").length],
      [
        "None / No Bundle",
        "",
        filtered.filter((d) => d.bundle === "no" || d.bundle === "none").length,
      ],
      ["", "", ""],
      ["CREDIT STATUS", "", "Count"],
      ["Supplier Credit", "", filtered.filter((d) => d.creditStatus === "supplier_credit").length],
      ["Unit on Hand", "", filtered.filter((d) => d.creditStatus === "unit_on_hand").length],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary["!cols"] = [{ wch: 28 }, { wch: 25 }, { wch: 12 }];

    // Style summary sheet
    const sectionColors: Record<string, string> = {
      "STATUS BREAKDOWN": "3B82F6",
      "PRODUCT BREAKDOWN": "8B5CF6",
      "BUNDLE STATUS": "EC4899",
      "CREDIT STATUS": "06B6D4",
    };

    for (let R = 0; R < summaryData.length; ++R) {
      for (let C = 0; C < 3; ++C) {
        const address = XLSX.utils.encode_col(C) + (R + 1);
        if (!wsSummary[address]) continue;

        const content = summaryData[R]?.[C]?.toString() || "";

        // Main title
        if (R === 1) {
          wsSummary[address].s = {
            font: { bold: true, color: { rgb: "FFFFFF" }, size: 16 },
            fill: { fgColor: { rgb: "1F2937" } },
            alignment: { horizontal: "left", vertical: "center" },
            border: { bottom: { style: "medium", color: { rgb: "1F2937" } } },
          };
        }
        // Section headers
        else if (Object.keys(sectionColors).includes(content)) {
          const color = sectionColors[content];
          wsSummary[address].s = {
            font: { bold: true, color: { rgb: "FFFFFF" }, size: 12 },
            fill: { fgColor: { rgb: color } },
            alignment: { horizontal: "left", vertical: "center" },
          };
        }
        // Data rows under sections
        else if (content && !["Generated on", "Total Records"].includes(content)) {
          const isNumber = !isNaN(Number(content));
          wsSummary[address].s = {
            font: { color: { rgb: "374151" }, size: 11 },
            fill: { fgColor: { rgb: "F3F4F6" } },
            alignment: { horizontal: isNumber ? "right" : "left", vertical: "center" },
            border: { bottom: { style: "thin", color: { rgb: "D1D5DB" } } },
            numFmt: isNumber ? "0" : "@",
          };
        }
        // Header info
        else if (["Generated on", "Total Records"].includes(content)) {
          wsSummary[address].s = {
            font: { bold: true, color: { rgb: "1F2937" }, size: 11 },
            fill: { fgColor: { rgb: "E5E7EB" } },
            alignment: { horizontal: "left", vertical: "center" },
          };
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
    XLSX.utils.book_append_sheet(wb, ws, "Returns");

    XLSX.writeFile(wb, `returns-skc-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  }

  function copyReadOnlyLink() {
    const url = `${window.location.origin}?view=readonly`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    });
  }

  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const formDate = form.date ? new Date(form.date + "T00:00:00") : undefined;

  // Show read-only view
  if (isReadOnly) {
    if (isLoading)
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin opacity-40" />
        </div>
      );
    return <ReadOnlyView data={data} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky white header */}
      <header className="sticky top-0 z-40 bg-[#20282f] border-b border-white/10">
        <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <PackageOpen className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <span className="font-semibold text-sm text-white">Returns Tracker</span>
              <span className="hidden sm:inline text-slate-400 text-sm mx-2">·</span>
              <span className="hidden sm:inline text-xs text-slate-400">
                SKC Digital
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyReadOnlyLink}
              className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white hover:bg-[#232e36] rounded-md px-3 py-1.5 transition-colors"
            >
              {copyToast ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" /> Share
                </>
              )}
            </button>
            <button
              onClick={exportExcel}
              disabled={data.length === 0}
              className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white hover:bg-[#232e36] rounded-md px-3 py-1.5 transition-colors disabled:opacity-40"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Export
            </button>
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-1.5 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Return
            </button>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6 space-y-5 pb-12">
        {/* KPI stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Total Returns"
            value={stats.total}
            color="text-white"
            dot="bg-slate-500"
          />
          <StatCard
            label="Active"
            value={stats.started + stats.inProgress + stats.pending + stats.incomplete}
            color="text-blue-600"
            dot="bg-blue-500"
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            color="text-emerald-600"
            dot="bg-emerald-500"
          />
          <StatCard
            label="Credited"
            value={stats.creditProcessed}
            color="text-violet-600"
            dot="bg-violet-500"
          />
          <StatCard label="Missing" value={stats.missing} color="text-rose-600" dot="bg-rose-500" />
          <StatCard
            label="Incomplete"
            value={stats.incomplete}
            color="text-amber-600"
            dot="bg-amber-500"
          />
        </div>

        {/* Financial banner */}
        {(stats.totalRequestedCredit > 0 || stats.totalSupplierCredit > 0) && (
          <div className="bg-[#20282f] rounded-xl border border-white/10 shadow-sm p-4">
            <div className="flex flex-wrap items-center gap-8">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                  Total Requested
                </p>
                <p className="text-lg font-bold text-white">
                  R{" "}
                  {stats.totalRequestedCredit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                  Supplier Credited
                </p>
                <p className="text-lg font-bold text-emerald-600">
                  R{" "}
                  {stats.totalSupplierCredit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                </p>
              </div>
              {stats.totalRequestedCredit > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                    Outstanding
                  </p>
                  <p
                    className={cn(
                      "text-lg font-bold",
                      stats.totalRequestedCredit - stats.totalSupplierCredit > 0
                        ? "text-rose-600"
                        : "text-emerald-600",
                    )}
                  >
                    R{" "}
                    {Math.abs(
                      stats.totalRequestedCredit - stats.totalSupplierCredit,
                    ).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] text-slate-400 font-medium">Live</span>
              </div>
            </div>
          </div>
        )}

        {/* Analytics overview */}
        <div className="bg-[#20282f] rounded-xl border border-white/10 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-200">Analytics</h2>
            </div>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
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
                          width: activeData.length ? `${(count / activeData.length) * 100}%` : "0%",
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

        {/* ── Tabs + Filters row ── */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-[#232e36] rounded-lg p-1">
            <button
              onClick={() => setActiveTab("active")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                activeTab === "active"
                  ? "bg-[#20282f] text-white shadow-sm"
                  : "text-slate-300 hover:text-white",
              )}
            >
              Active
              <span
                className={cn(
                  "text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                  activeTab === "active"
                    ? "bg-primary/10 text-primary"
                    : "bg-[#2a343c] text-slate-400",
                )}
              >
                {activeData.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("credited")}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                activeTab === "credited"
                  ? "bg-[#20282f] text-white shadow-sm"
                  : "text-slate-300 hover:text-white",
              )}
            >
              Credited
              <span
                className={cn(
                  "text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                  activeTab === "credited"
                    ? "bg-violet-100 text-violet-600"
                    : "bg-[#2a343c] text-slate-400",
                )}
              >
                {creditedData.length}
              </span>
            </button>
          </div>
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-[#20282f] border border-white/10 rounded-lg px-3 py-2 shadow-sm">
            <Search className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ref, job no., serial, store…"
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400 text-slate-200"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-200">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {activeTab === "active" && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 bg-[#20282f] border-white/10 text-slate-200 text-xs rounded-lg shadow-sm">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="started">Started</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="incomplete">Incomplete</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="missing">Missing</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[110px] h-9 bg-[#20282f] border-white/10 text-slate-200 text-xs rounded-lg shadow-sm">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="RFC">RFC</SelectItem>
              <SelectItem value="GRS">GRS</SelectItem>
              <SelectItem value="GRN">GRN</SelectItem>
            </SelectContent>
          </Select>
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-[160px] h-9 bg-[#20282f] border-white/10 text-slate-200 text-xs rounded-lg shadow-sm">
              <SelectValue placeholder="All stores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stores</SelectItem>
              {stores.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 bg-[#20282f] border border-white/10 rounded-lg px-2.5 py-2 shadow-sm">
            <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs bg-transparent outline-none text-slate-300"
            />
            <span className="text-slate-300">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs bg-transparent outline-none text-slate-300"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                <X className="h-3 w-3 text-slate-400 hover:text-slate-200" />
              </button>
            )}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-[#20282f] rounded-xl border border-white/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="border-b border-white/10 bg-[#1c242a]">
                  <Th onClick={() => toggleSort("refType")}>Type</Th>
                  <Th onClick={() => toggleSort("refNumber")}>Reference</Th>
                  <Th onClick={() => toggleSort("jobNumber")}>Job No.</Th>
                  <Th onClick={() => toggleSort("serialNumber")}>Serial No.</Th>
                  <Th onClick={() => toggleSort("storeName")}>Store</Th>
                  <Th>Product</Th>
                  <Th>Bundle</Th>
                  <Th onClick={() => toggleSort("unitLocation")}>Location</Th>
                  <Th onClick={() => toggleSort("status")}>Status</Th>
                  <Th>Credit</Th>
                  <Th onClick={() => toggleSort("date")}>Date</Th>
                  <Th>Notes</Th>
                  <th className="px-3 py-3 w-[130px]" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={13}>
                      <div className="py-16 text-center">
                        <Loader2 className="h-7 w-7 mx-auto mb-3 animate-spin text-slate-300" />
                        <p className="text-sm text-slate-400">Loading returns…</p>
                      </div>
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={13}>
                      <div className="py-14 text-center">
                        <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-amber-400" />
                        <p className="text-sm font-medium text-slate-300">Failed to load</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={13}>
                      <div className="py-16 text-center">
                        <PackageOpen className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                        <p className="text-sm font-semibold text-slate-400 mb-1">
                          {tableSource.length === 0
                            ? activeTab === "credited"
                              ? "No credited returns yet"
                              : "No returns yet"
                            : "No results"}
                        </p>
                        <span className="text-xs text-slate-400">
                          {tableSource.length === 0
                            ? activeTab === "credited"
                              ? "Move returns here once credited."
                              : 'Click "Add Return" to get started.'
                            : "Adjust your filters."}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr
                      key={r.id}
                      className="group border-b border-white/10 last:border-0 hover:bg-[#1c242a]/80 transition-colors cursor-pointer"
                      onClick={() => setViewEntry(r)}
                    >
                      <td className="px-3.5 py-3">
                        <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-md bg-slate-900 text-white">
                          {r.refType}
                        </span>
                      </td>
                      <td className="px-3.5 py-3">
                        <span className="font-mono text-xs font-semibold text-slate-200 bg-[#232e36] px-2 py-0.5 rounded">
                          {r.refNumber || "—"}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 font-mono text-xs text-slate-400">
                        {r.jobNumber || "—"}
                      </td>
                      <td className="px-3.5 py-3 font-mono text-xs text-slate-400">
                        {r.serialNumber || "—"}
                      </td>
                      <td className="px-3.5 py-3 text-xs font-semibold text-slate-100">
                        {r.storeName || "—"}
                      </td>
                      <td className="px-3.5 py-3">
                        <ProductTypeCell value={r.productType} />
                      </td>
                      <td className="px-3.5 py-3">
                        <BundleCell value={r.bundle} />
                      </td>
                      <td className="px-3.5 py-3 text-xs text-slate-400" title={r.unitLocation}>
                        {r.unitLocation || "—"}
                      </td>
                      <td className="px-3.5 py-3" onClick={(e) => e.stopPropagation()}>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              title="Click to change status"
                              className="hover:opacity-75 transition-opacity cursor-pointer"
                            >
                              <StatusBadge status={r.status} />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-1.5" align="start">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 pt-1 pb-2">
                              Change Status
                            </p>
                            {(Object.keys(STATUS_META) as Status[]).map((s) => {
                              const Icon = STATUS_META[s].icon;
                              return (
                                <button
                                  key={s}
                                  onClick={() =>
                                    quickStatusMutation.mutate({ ...r, status: s })
                                  }
                                  disabled={quickStatusMutation.isPending}
                                  className={cn(
                                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md transition-colors hover:bg-[#232e36] disabled:opacity-50",
                                    r.status === s && "font-semibold bg-[#1c242a]",
                                  )}
                                >
                                  <Icon className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                  {STATUS_META[s].label}
                                  {r.status === s && (
                                    <Check className="h-3 w-3 ml-auto text-slate-400" />
                                  )}
                                </button>
                              );
                            })}
                          </PopoverContent>
                        </Popover>
                      </td>
                      <td className="px-3.5 py-3 text-xs">
                        {r.creditStatus === "supplier_credit" ? (
                          <div>
                            <span className="font-semibold text-emerald-700 block text-[11px]">
                              Supplier credit
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              {r.creditNoteNumber || "—"}
                            </span>
                          </div>
                        ) : r.creditStatus === "no_physical_unit" ? (
                          <span className="text-[11px] font-semibold text-rose-600">No unit</span>
                        ) : (
                          <span className="text-[11px] text-slate-400">On hand</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {r.date ? format(new Date(r.date + "T00:00:00"), "dd MMM yyyy") : "—"}
                      </td>
                      <td
                        className="px-3.5 py-3 text-xs text-slate-400 max-w-[180px] truncate"
                        title={r.notes}
                      >
                        {r.notes || "—"}
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          {activeTab === "active" ? (
                            <button
                              title="Mark as Credited"
                              onClick={() => markCreditedMutation.mutate(r)}
                              disabled={markCreditedMutation.isPending}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 transition-colors disabled:opacity-50"
                            >
                              {markCreditedMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CreditCard className="h-3 w-3" />
                              )}{" "}
                              Credit
                            </button>
                          ) : (
                            <button
                              title="Restore to Active"
                              onClick={() => restoreActiveMutation.mutate(r)}
                              disabled={restoreActiveMutation.isPending}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[#232e36] hover:bg-[#2a343c] text-slate-300 transition-colors"
                            >
                              ↩ Restore
                            </button>
                          )}
                          <IconBtn label="Edit" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </IconBtn>
                          <IconBtn label="Delete" danger onClick={() => remove(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/10 bg-[#1c242a]/80 flex items-center justify-between">
              <p className="text-[11px] text-slate-400">
                Showing <strong className="text-slate-300">{filtered.length}</strong> of{" "}
                <strong className="text-slate-300">{tableSource.length}</strong> entries
              </p>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Hover a row to reveal actions
              </p>
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-400 text-center pb-2">
          SKC Digital · Returns Tracker · {new Date().getFullYear()}
        </p>
      </main>
      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { setSaveError(null); setSubmitAttempted(false); } setModalOpen(open); }}>
        <DialogContent className="sm:max-w-[680px] max-h-[92vh] overflow-y-auto">
          <DialogHeader className="pb-1">
            <DialogTitle className="text-lg font-semibold">
              {editingId ? "Edit Return" : "Add Return"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {editingId
                ? "Update the details for this return entry."
                : "Fill in the details to log a new return entry."}
            </DialogDescription>
          </DialogHeader>

          {saveError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="space-y-6 py-1">
            {/* Section: Reference Details */}
            <div>
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-2 border-b border-white/10">
                Reference Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Document Type">
                  <Select
                    value={form.refType}
                    onValueChange={(v) => setForm((f) => ({ ...f, refType: v as RefType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RFC">RFC</SelectItem>
                      <SelectItem value="GRS">GRS</SelectItem>
                      <SelectItem value="GRN">GRN</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Reference Number *">
                  <Input
                    value={form.refNumber}
                    onChange={(e) => setForm((f) => ({ ...f, refNumber: e.target.value }))}
                    placeholder="e.g. RFC-20241"
                    className={cn(
                      submitAttempted &&
                        !form.refNumber.trim() &&
                        "border-rose-400 focus-visible:ring-rose-400",
                    )}
                  />
                  {submitAttempted && !form.refNumber.trim() && (
                    <p className="text-xs text-rose-600 mt-1">Reference number is required.</p>
                  )}
                </Field>
                <Field label="Job Number">
                  <Input
                    value={form.jobNumber}
                    onChange={(e) => setForm((f) => ({ ...f, jobNumber: e.target.value }))}
                    placeholder="e.g. JOB-00312"
                  />
                </Field>
                <Field label="Serial Number">
                  <Input
                    value={form.serialNumber}
                    onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))}
                    placeholder="e.g. SN7812345600"
                  />
                </Field>
                <Field label="Date">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !form.date && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="h-4 w-4" />
                        {formDate ? format(formDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formDate}
                        onSelect={(d) =>
                          setForm((f) => ({ ...f, date: d ? format(d, "yyyy-MM-dd") : "" }))
                        }
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </Field>
              </div>
            </div>

            {/* Section: Return Details */}
            <div>
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-2 border-b border-white/10">
                Return Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Retailer" className="sm:col-span-2">
                  <div className="flex flex-col gap-2">
                    <Select
                      value={
                        RETAILERS.includes(form.storeName.split(" - ")[0])
                          ? form.storeName.split(" - ")[0]
                          : "__custom"
                      }
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, storeName: v === "__custom" ? "" : v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select retailer" />
                      </SelectTrigger>
                      <SelectContent>
                        {RETAILERS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                        <SelectItem value="__custom">Other (type below)</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.storeName && (
                      <Input
                        value={
                          form.storeName.includes(" - ") ? form.storeName.split(" - ")[1] : ""
                        }
                        onChange={(e) => {
                          const retailer =
                            RETAILERS.find((r) => form.storeName.startsWith(r)) ||
                            form.storeName.split(" - ")[0];
                          setForm((f) => ({
                            ...f,
                            storeName: e.target.value
                              ? `${retailer} - ${e.target.value}`
                              : retailer,
                          }));
                        }}
                        placeholder="Branch / Store location (e.g. Sandton, Westgate)"
                      />
                    )}
                    {!RETAILERS.includes(form.storeName.split(" - ")[0]) && form.storeName && (
                      <Input
                        value={form.storeName.split(" - ")[0]}
                        onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))}
                        placeholder="Store name"
                      />
                    )}
                  </div>
                </Field>
                <Field label="Product Type">
                  <Select
                    value={form.productType}
                    onValueChange={(v) => setForm((f) => ({ ...f, productType: v as ProductType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="laptop">Laptop</SelectItem>
                      <SelectItem value="printer">Printer</SelectItem>
                      <SelectItem value="rma">RMA (Flash Driver, SSD, SD Card, etc)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Bundle Received">
                  <Select
                    value={form.bundle}
                    onValueChange={(v) => setForm((f) => ({ ...f, bundle: v as Bundle }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes — full bundle</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="standalone_laptop">Standalone laptop</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Unit Location">
                  <Input
                    value={form.unitLocation}
                    onChange={(e) => setForm((f) => ({ ...f, unitLocation: e.target.value }))}
                    placeholder="e.g. Shelf B3, Warehouse"
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((f) => ({ ...f, status: v as Status }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="started">Started</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="incomplete">Incomplete</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="credit_processed">Credit Processed ✓</SelectItem>
                      <SelectItem value="missing">Missing</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>

            {/* Section: Credit Information */}
            <div>
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-2 border-b border-white/10">
                Credit Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Credit Status" className="sm:col-span-2">
                  <Select
                    value={form.creditStatus}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        creditStatus: v as CreditStatus,
                        creditNoteNumber: v === "unit_on_hand" ? "" : f.creditNoteNumber,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unit_on_hand">
                        Unit on hand (physical unit with us)
                      </SelectItem>
                      <SelectItem value="supplier_credit">Supplier provided credit</SelectItem>
                      <SelectItem value="no_physical_unit">
                        No physical unit (lost / not returned)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {form.creditStatus === "supplier_credit" && (
                  <Field label="Credit Note Number" className="sm:col-span-2">
                    <Input
                      value={form.creditNoteNumber}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, creditNoteNumber: e.target.value }))
                      }
                      placeholder="e.g. CN-2024-00872"
                    />
                  </Field>
                )}
                <Field label="Credit Amount Requested (R)">
                  <Input
                    type="text"
                    value={form.requestedCreditAmount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, requestedCreditAmount: e.target.value }))
                    }
                    placeholder="e.g. 4 999.00"
                  />
                </Field>
                <Field label="Supplier Credit Amount (R)">
                  <Input
                    type="text"
                    value={form.supplierCreditAmount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, supplierCreditAmount: e.target.value }))
                    }
                    placeholder="e.g. 4 500.00"
                  />
                </Field>
              </div>
            </div>

            {/* Section: Documents & Notes */}
            <div>
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-2 border-b border-white/10">
                Notes
              </h3>
              <div className="space-y-4">
                <Field label="Notes">
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Query details, credit status, any relevant info…"
                    rows={3}
                  />
                </Field>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={isMutating}
            >
              Cancel
            </Button>
            <Button onClick={save} disabled={isMutating}>
              {isMutating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> {editingId ? "Save Changes" : "Add Return"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail View Modal (click a row) ── */}
      {viewEntry && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setViewEntry(null)}
        >
          <div
            className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-slate-900 to-slate-800 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-[#20282f]/10 text-white border border-white/20">
                  {viewEntry.refType}
                </span>
                <div>
                  <p className="text-white font-bold text-lg">{viewEntry.refNumber || "—"}</p>
                  <p className="text-white/60 text-xs">
                    {viewEntry.storeName || "No store"} ·{" "}
                    {viewEntry.date
                      ? format(new Date(viewEntry.date + "T00:00:00"), "dd MMM yyyy")
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={viewEntry.status} />
                <button
                  onClick={() => setViewEntry(null)}
                  className="p-1.5 hover:bg-[#20282f]/10 rounded-lg transition-colors text-white/60 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-4">
              {/* Row 1 */}
              <DetailRow label="Job Number" value={viewEntry.jobNumber} mono />
              <DetailRow label="Serial Number" value={viewEntry.serialNumber} mono />
              <DetailRow
                label="Product"
                value={<ProductTypeCell value={viewEntry.productType} />}
              />
              <DetailRow label="Bundle" value={<BundleCell value={viewEntry.bundle} />} />
              <DetailRow label="Unit Location" value={viewEntry.unitLocation} />
              <DetailRow
                label="Date"
                value={
                  viewEntry.date
                    ? format(new Date(viewEntry.date + "T00:00:00"), "dd MMMM yyyy")
                    : "—"
                }
              />

              {/* Credit section */}
              <div className="col-span-2 border-t pt-3 mt-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Credit Information
                </p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <DetailRow
                    label="Credit Status"
                    value={
                      viewEntry.creditStatus === "supplier_credit" ? (
                        <span className="text-emerald-700 font-semibold">Supplier Credit</span>
                      ) : viewEntry.creditStatus === "no_physical_unit" ? (
                        <span className="text-rose-700 font-semibold">No Physical Unit</span>
                      ) : (
                        <span className="text-slate-200 font-semibold">Unit on Hand</span>
                      )
                    }
                  />
                  {viewEntry.creditNoteNumber && (
                    <DetailRow label="Credit Note No." value={viewEntry.creditNoteNumber} mono />
                  )}
                  {viewEntry.requestedCreditAmount && (
                    <DetailRow
                      label="Credit Requested"
                      value={
                        <span className="font-bold text-blue-700">
                          R {viewEntry.requestedCreditAmount}
                        </span>
                      }
                    />
                  )}
                  {viewEntry.supplierCreditAmount && (
                    <DetailRow
                      label="Supplier Credited"
                      value={
                        <span className="font-bold text-emerald-700">
                          R {viewEntry.supplierCreditAmount}
                        </span>
                      }
                    />
                  )}
                </div>
              </div>

              {/* Notes */}
              {viewEntry.notes && (
                <div className="col-span-2 border-t pt-3 mt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Notes
                  </p>
                  <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">
                    {viewEntry.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between px-5 pb-5 pt-2 border-t gap-2 flex-wrap">
              <p className="text-[11px] text-muted-foreground">
                Created{" "}
                {viewEntry.createdAt
                  ? format(new Date(viewEntry.createdAt), "dd MMM yyyy HH:mm")
                  : "—"}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setViewEntry(null);
                    openEdit(viewEntry);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => setViewEntry(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 rounded-xl px-4 py-3 shadow-2xl text-sm font-medium pointer-events-none",
            toast.type === "success" ? "bg-slate-900 text-white" : "bg-rose-600 text-white",
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-white flex-shrink-0" />
          )}
          <span className="max-w-xs">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}

// ── Shared components ──

function AnimatedStatCard({
  label,
  value,
  accent,
  numCls,
}: {
  label: string;
  value: number;
  accent: string;
  numCls: string;
}) {
  const animated = useCountUp(value);
  return (
    <div
      className={cn(
        "bg-[#20282f] rounded-xl border-l-4 border border-white/10 p-4 shadow-sm",
        accent.replace("border-", "border-l-"),
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
        {label}
      </p>
      <p className={cn("text-3xl font-black tabular-nums", numCls)}>{animated}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  dot,
}: {
  label: string;
  value: number;
  color: string;
  dot: string;
}) {
  const animated = useCountUp(value);
  return (
    <div className="bg-[#20282f] rounded-xl border border-white/10 px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-[11px] text-slate-400 font-medium mb-1.5 truncate">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums tracking-tight", color)}>{animated}</p>
      <div className={cn("h-0.5 w-6 rounded-full mt-2 opacity-60", dot)} />
    </div>
  );
}

function Th({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-[#1c242a] whitespace-nowrap text-left",
        onClick &&
          "cursor-pointer hover:text-slate-100 hover:bg-[#232e36] transition-colors select-none",
      )}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {onClick && <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </span>
    </th>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "p-1.5 rounded-md transition-colors",
        danger
          ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
          : "text-slate-400 hover:text-slate-200 hover:bg-[#232e36]",
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-300 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
        {label}
      </p>
      <p className={cn("text-sm text-foreground", mono && "font-mono")}>{value || "—"}</p>
    </div>
  );
}
import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";

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
  AlertTriangle,
  AlertCircle,
  Calendar as CalendarIcon,
  ArrowUpDown,
  Check,
  Loader2,
  Eye,
  EyeOff,
  FileSpreadsheet,
  CreditCard,
  Paperclip,
  History,
  ChevronDown,
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
  listReturnAudit,
  type AuditEntry,
  type ReturnEntry,
  type RefType,
  type Status,
  type Bundle,
  type ProductType,
  type CreditStatus,
} from "@/lib/returns.functions";
import { SignOutButton } from "@/components/auth-gate";
import { supabase } from "@/integrations/supabase/client";
import { NavTabs } from "@/components/nav-tabs";
import {
  AGING_THRESHOLD_DAYS,
  AgingBadge,
  AttachmentThumb,
  BundleCell,
  ProductTypeCell,
  STATUS_META,
  StatusBadge,
  getDaysAging,
  isAging,
  isPdfUrl,
} from "@/lib/returns-shared";

export const Route = createFileRoute("/returns")({
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
  grsRfcGrnImageUrl: "",
  supplierCreditImageUrl: "",
});


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
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-500/30">
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
              cls: "text-emerald-400",
            },
            {
              label: "Pending / Active",
              value: data.filter((d) =>
                ["pending", "started", "in_progress", "incomplete"].includes(d.status),
              ).length,
              cls: "text-amber-400",
            },
            {
              label: "Missing",
              value: data.filter((d) => d.status === "missing").length,
              cls: "text-rose-400",
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
                      <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-accent text-accent-foreground border border-white/10">
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
                          <span className="font-semibold text-emerald-400">Supplier credit</span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {r.creditNoteNumber || "— no CN —"}
                          </span>
                        </div>
                      ) : r.creditStatus === "no_physical_unit" ? (
                        <span className="font-semibold text-rose-400">No physical unit</span>
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
                        <span className="text-emerald-400 font-semibold">Supplier Credit</span>
                      ) : viewEntry.creditStatus === "no_physical_unit" ? (
                        <span className="text-rose-400 font-semibold">No Physical Unit</span>
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
                        <span className="font-bold text-blue-400">
                          R {viewEntry.requestedCreditAmount}
                        </span>
                      }
                    />
                  )}
                  {viewEntry.supplierCreditAmount && (
                    <DetailRow
                      label="Supplier Credited"
                      value={
                        <span className="font-bold text-emerald-400">
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
  const [agingOnly, setAgingOnly] = useState(false);
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
        if (agingOnly && !isAging(r)) return false;
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
    agingOnly,
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
      aging: data.filter((d) => isAging(d)).length,
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
      grsRfcGrnImageUrl: r.grsRfcGrnImageUrl ?? "",
      supplierCreditImageUrl: r.supplierCreditImageUrl ?? "",
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
    const url = `${window.location.origin}/returns?view=readonly`;
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
      <NavTabs
        actions={
          <>
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
          </>
        }
      />

      <main className="mx-auto max-w-[1400px] px-6 py-6 space-y-5 pb-12">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            <span className="font-semibold text-slate-200">{tableSource.length}</span> return
            {tableSource.length === 1 ? "" : "s"} on file
          </p>
          <button
            onClick={() => setAgingOnly((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-semibold rounded-md px-3 py-1.5 border transition-colors",
              agingOnly
                ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
                : "bg-[#20282f] text-slate-300 border-white/10 hover:border-white/20",
            )}
            title={`Returns open more than ${AGING_THRESHOLD_DAYS} days`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Aging (&gt;{AGING_THRESHOLD_DAYS}d): {stats.aging}
          </button>
        </div>

        {agingOnly && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Showing only returns open more than {AGING_THRESHOLD_DAYS} days ({filtered.length} of{" "}
              {tableSource.length})
            </span>
            <button
              onClick={() => setAgingOnly(false)}
              className="ml-auto text-amber-300 hover:text-white underline underline-offset-2"
            >
              Clear
            </button>
          </div>
        )}

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
                    ? "bg-violet-500/15 text-violet-400"
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
                            <span className="font-semibold text-emerald-400 block text-[11px]">
                              Supplier credit
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              {r.creditNoteNumber || "—"}
                            </span>
                          </div>
                        ) : r.creditStatus === "no_physical_unit" ? (
                          <span className="text-[11px] font-semibold text-rose-400">No unit</span>
                        ) : (
                          <span className="text-[11px] text-slate-400">On hand</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3 text-xs text-slate-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>
                            {r.date ? format(new Date(r.date + "T00:00:00"), "dd MMM yyyy") : "—"}
                          </span>
                          {(r.grsRfcGrnImageUrl || r.supplierCreditImageUrl) && (
                            <Paperclip
                              className="h-3 w-3 text-slate-500 flex-shrink-0"
                              aria-label="Has attachment"
                            />
                          )}
                          {(() => {
                            const days = getDaysAging(r);
                            return days !== null && days > AGING_THRESHOLD_DAYS ? (
                              <AgingBadge days={days} />
                            ) : null;
                          })()}
                        </div>
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
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/30 transition-colors disabled:opacity-50"
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
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
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
                    <p className="text-xs text-rose-400 mt-1">Reference number is required.</p>
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
                Documents &amp; Notes
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AttachmentField
                    label="RFC/GRS/GRN Document"
                    value={form.grsRfcGrnImageUrl}
                    onChange={(url) => setForm((f) => ({ ...f, grsRfcGrnImageUrl: url }))}
                  />
                  <AttachmentField
                    label="Supplier Credit Document"
                    value={form.supplierCreditImageUrl}
                    onChange={(url) => setForm((f) => ({ ...f, supplierCreditImageUrl: url }))}
                  />
                </div>
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
                        <span className="text-emerald-400 font-semibold">Supplier Credit</span>
                      ) : viewEntry.creditStatus === "no_physical_unit" ? (
                        <span className="text-rose-400 font-semibold">No Physical Unit</span>
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
                        <span className="font-bold text-blue-400">
                          R {viewEntry.requestedCreditAmount}
                        </span>
                      }
                    />
                  )}
                  {viewEntry.supplierCreditAmount && (
                    <DetailRow
                      label="Supplier Credited"
                      value={
                        <span className="font-bold text-emerald-400">
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

              {/* Attachments */}
              {(viewEntry.grsRfcGrnImageUrl || viewEntry.supplierCreditImageUrl) && (
                <div className="col-span-2 border-t pt-3 mt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Paperclip className="h-3 w-3" /> Attachments
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    {viewEntry.grsRfcGrnImageUrl && (
                      <a
                        href={viewEntry.grsRfcGrnImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group"
                      >
                        <AttachmentThumb
                          url={viewEntry.grsRfcGrnImageUrl}
                          alt="RFC/GRS/GRN document"
                          size="h-20 w-20 group-hover:opacity-80 transition-opacity"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1 text-center">
                          RFC/GRS/GRN
                        </p>
                      </a>
                    )}
                    {viewEntry.supplierCreditImageUrl && (
                      <a
                        href={viewEntry.supplierCreditImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group"
                      >
                        <AttachmentThumb
                          url={viewEntry.supplierCreditImageUrl}
                          alt="Supplier credit document"
                          size="h-20 w-20 group-hover:opacity-80 transition-opacity"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1 text-center">
                          Supplier Credit
                        </p>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* History */}
              <div className="col-span-2 border-t pt-3 mt-1">
                <HistorySection entryId={viewEntry.id} />
              </div>
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
          ? "text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
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

// ── Audit history panel (shown in the detail modal) ──
const HISTORY_FIELD_LABELS: Record<string, string> = {
  status: "Status",
  credit_status: "Credit Status",
  credit_note_number: "Credit Note No.",
  requested_credit_amount: "Credit Requested",
  supplier_credit_amount: "Supplier Credited",
  store_name: "Store",
  unit_location: "Unit Location",
  notes: "Notes",
  bundle: "Bundle",
  grs_rfc_grn_image_url: "RFC/GRS/GRN Attachment",
  supplier_credit_image_url: "Supplier Credit Attachment",
};

function summarizeAuditChange(entry: AuditEntry): string[] {
  if (entry.action === "insert") return ["Return created"];
  if (entry.action === "delete") return ["Return deleted"];
  if (!entry.oldData || !entry.newData) return ["Updated"];
  const changes: string[] = [];
  for (const key of Object.keys(HISTORY_FIELD_LABELS)) {
    const before = entry.oldData[key];
    const after = entry.newData[key];
    if (before !== after) {
      const label = HISTORY_FIELD_LABELS[key];
      if (key.endsWith("image_url")) {
        changes.push(after ? `${label} added` : `${label} removed`);
      } else {
        changes.push(`${label}: ${before || "—"} → ${after || "—"}`);
      }
    }
  }
  return changes.length ? changes : ["Updated"];
}

function HistorySection({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  const fetchAudit = useServerFn(listReturnAudit);
  const { data, isLoading } = useQuery({
    queryKey: ["return-audit", entryId],
    queryFn: () => fetchAudit({ data: { entryId } }),
    enabled: open,
  });

  const entries = data?.entries ?? [];

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <History className="h-3 w-3" />
        History
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-2.5 space-y-2.5 max-h-56 overflow-y-auto pr-1">
          {isLoading && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading history…
            </p>
          )}
          {!isLoading && entries.length === 0 && (
            <p className="text-xs text-muted-foreground">No history recorded yet.</p>
          )}
          {entries.map((e) => (
            <div key={e.id} className="text-xs border-l-2 border-white/10 pl-3 py-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{e.changedByEmail}</span>
                <span className="text-muted-foreground">
                  {format(new Date(e.changedAt), "dd MMM yyyy HH:mm")}
                </span>
              </div>
              <ul className="mt-0.5 text-muted-foreground list-disc list-inside">
                {summarizeAuditChange(e).map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Attachment upload field (used in the Add/Edit modal) ──
function AttachmentField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) {
      setError("Only images or PDF files are allowed.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split(".").pop() || (isPdf ? "pdf" : "jpg");
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("return-attachments")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("return-attachments").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Field label={label}>
      {value ? (
        <div className="flex items-center gap-2">
          <a href={value} target="_blank" rel="noreferrer">
            <AttachmentThumb url={value} alt={label} />
          </a>
          {isPdfUrl(value) && (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-blue-400 hover:text-blue-300 underline underline-offset-2"
            >
              View PDF
            </a>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => onChange("")}>
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </Button>
        </div>
      ) : (
        <label
          className={cn(
            "flex items-center justify-center gap-2 border border-dashed border-white/15 rounded-md h-14 text-xs text-slate-400 transition-colors",
            uploading
              ? "opacity-60 cursor-wait"
              : "cursor-pointer hover:border-white/30 hover:text-slate-300",
          )}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
          {uploading ? "Uploading…" : "Attach image or PDF"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleFile}
            disabled={uploading}
          />
        </label>
      )}
      {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
    </Field>
  );
}
import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
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
  FileText,
  ZoomIn,
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Returns Tracker — Omni Technical Solutions" },
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
  grsRfcGrnImageUrl: "",
  supplierCreditImageUrl: "",
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
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", color)}>
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
      <span className="inline-flex items-center gap-1 text-slate-700 text-xs font-semibold">
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
  "refType" | "refNumber" | "jobNumber" | "serialNumber" | "storeName" | "unitLocation" | "status" | "date"
>;

// ── Read-only view (shareable link with ?view=readonly) ──
function ReadOnlyView({ data }: { data: ReturnEntry[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [imageModal, setImageModal] = useState<{ url: string; label: string } | null>(null);
  const [viewEntry, setViewEntry] = useState<ReturnEntry | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((r) => {
      const hay = [r.refNumber, r.jobNumber, r.serialNumber, r.storeName, r.notes].join(" ").toLowerCase();
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
                Omni Technical Solutions · RFC / GRS / GRN retail credit returns
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
            <Eye className="h-3 w-3" /> Read-only view
          </span>
        </header>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total Returns" value={data.length} />
          <StatCard label="Completed" value={data.filter(d => d.status === "completed").length} tone="success" />
          <StatCard label="Pending" value={data.filter(d => d.status === "pending").length} tone="warn" />
          <StatCard label="Missing" value={data.filter(d => d.status === "missing").length} tone="danger" />
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
            <SelectTrigger className="w-[150px] bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="started">Started</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="missing">Missing</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px] bg-card"><SelectValue /></SelectTrigger>
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
                  {["Type","Reference","Job No.","Serial No.","Store","Product","Bundle","Location","Status","Credit","Date","Notes","Images"].map(h => (
                    <th key={h} className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
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
                      <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-accent text-accent-foreground border border-blue-100">{r.refType}</span>
                    </td>
                    <td className="px-3.5 py-2.5"><span className="font-mono text-xs px-2 py-0.5 rounded border bg-muted/40 text-muted-foreground">{r.refNumber || "—"}</span></td>
                    <td className="px-3.5 py-2.5 font-mono text-xs text-muted-foreground">{r.jobNumber || "—"}</td>
                    <td className="px-3.5 py-2.5 font-mono text-xs text-muted-foreground">{r.serialNumber || "—"}</td>
                    <td className="px-3.5 py-2.5 font-medium">{r.storeName || "—"}</td>
                    <td className="px-3.5 py-2.5"><ProductTypeCell value={r.productType} /></td>
                    <td className="px-3.5 py-2.5"><BundleCell value={r.bundle} /></td>
                    <td className="px-3.5 py-2.5 text-xs text-muted-foreground">{r.unitLocation || "—"}</td>
                    <td className="px-3.5 py-2.5"><StatusBadge status={r.status} /></td>
                    <td className="px-3.5 py-2.5 text-xs">
                      {r.creditStatus === "supplier_credit" ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-emerald-700">Supplier credit</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{r.creditNoteNumber || "— no CN —"}</span>
                        </div>
                      ) : r.creditStatus === "no_physical_unit" ? (
                        <span className="font-semibold text-rose-700">No physical unit</span>
                      ) : (
                        <span className="font-semibold text-slate-700">Unit on hand</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {r.date ? format(new Date(r.date + "T00:00:00"), "dd MMM yyyy") : "—"}
                    </td>
                    <td className="px-3.5 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate" title={r.notes}>{r.notes || "—"}</td>
                    <td className="px-3.5 py-2.5 text-xs" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {r.grsRfcGrnImageUrl && (
                          <button
                            onClick={() => setImageModal({ url: r.grsRfcGrnImageUrl, label: "GRS/RFC/GRN Document" })}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold text-[11px] cursor-pointer transition-colors"
                          >
                            📄 GRS/RFC/GRN
                          </button>
                        )}
                        {r.supplierCreditImageUrl && (
                          <button
                            onClick={() => setImageModal({ url: r.supplierCreditImageUrl, label: "Supplier Credit Note" })}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-semibold text-[11px] cursor-pointer transition-colors"
                          >
                            💳 Credit Note
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={13} className="py-14 text-center text-muted-foreground text-sm">No results found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">Read-only view · Omni Technical Solutions</p>
      </div>

      {/* Detail modal for read-only */}
      {viewEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewEntry(null)}>
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-slate-900 to-slate-800 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-white/10 text-white border border-white/20">{viewEntry.refType}</span>
                <div>
                  <p className="text-white font-bold text-lg">{viewEntry.refNumber || "—"}</p>
                  <p className="text-white/60 text-xs">{viewEntry.storeName || "No store"} · {viewEntry.date ? format(new Date(viewEntry.date + "T00:00:00"), "dd MMM yyyy") : "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={viewEntry.status} />
                <button onClick={() => setViewEntry(null)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Job Number" value={viewEntry.jobNumber} mono />
              <DetailRow label="Serial Number" value={viewEntry.serialNumber} mono />
              <DetailRow label="Product" value={<ProductTypeCell value={viewEntry.productType} />} />
              <DetailRow label="Bundle" value={<BundleCell value={viewEntry.bundle} />} />
              <DetailRow label="Unit Location" value={viewEntry.unitLocation} />
              <DetailRow label="Date" value={viewEntry.date ? format(new Date(viewEntry.date + "T00:00:00"), "dd MMMM yyyy") : "—"} />
              <div className="col-span-2 border-t pt-3 mt-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Credit Information</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <DetailRow label="Credit Status" value={
                    viewEntry.creditStatus === "supplier_credit"
                      ? <span className="text-emerald-700 font-semibold">Supplier Credit</span>
                      : viewEntry.creditStatus === "no_physical_unit"
                      ? <span className="text-rose-700 font-semibold">No Physical Unit</span>
                      : <span className="text-slate-700 font-semibold">Unit on Hand</span>
                  } />
                  {viewEntry.creditNoteNumber && <DetailRow label="Credit Note No." value={viewEntry.creditNoteNumber} mono />}
                  {viewEntry.requestedCreditAmount && <DetailRow label="Credit Requested" value={<span className="font-bold text-blue-700">R {viewEntry.requestedCreditAmount}</span>} />}
                  {viewEntry.supplierCreditAmount && <DetailRow label="Supplier Credited" value={<span className="font-bold text-emerald-700">R {viewEntry.supplierCreditAmount}</span>} />}
                </div>
              </div>
              {viewEntry.notes && (
                <div className="col-span-2 border-t pt-3 mt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Notes</p>
                  <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">{viewEntry.notes}</p>
                </div>
              )}
              {(viewEntry.grsRfcGrnImageUrl || viewEntry.supplierCreditImageUrl) && (
                <div className="col-span-2 border-t pt-3 mt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Attached Documents</p>
                  <div className="flex flex-wrap gap-3">
                    {viewEntry.grsRfcGrnImageUrl && <DocPreview url={viewEntry.grsRfcGrnImageUrl} label="GRS/RFC/GRN Document" color="blue" />}
                    {viewEntry.supplierCreditImageUrl && <DocPreview url={viewEntry.supplierCreditImageUrl} label="Supplier Credit Note" color="emerald" />}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end px-5 pb-5 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setViewEntry(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Image/PDF Modal */}
      {imageModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setImageModal(null)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h3 className="font-semibold text-sm">{imageModal.label}</h3>
              <button
                onClick={() => setImageModal(null)}
                className="p-1 hover:bg-muted rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              {imageModal.url.startsWith("data:application/pdf") ? (
                <object data={imageModal.url} type="application/pdf" className="w-full min-h-[600px]">
                  <p className="text-sm text-muted-foreground">
                    PDF preview is not supported by your browser.
                    <a href={imageModal.url} target="_blank" rel="noreferrer" className="text-blue-600 underline ml-1">Open PDF in a new tab</a>.
                  </p>
                </object>
              ) : (
                <img src={imageModal.url} alt={imageModal.label} className="w-full max-h-[600px] object-contain" />
              )}
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

  const { data: listData, isLoading, isError } = useQuery({
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
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyEntry());
  const [showDashboard, setShowDashboard] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [viewEntry, setViewEntry] = useState<ReturnEntry | null>(null);

  const createMutation = useMutation({
    mutationFn: (entry: Omit<ReturnEntry, "id" | "createdAt">) => fetchCreate({ data: entry }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["returns"] }); setModalOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: (entry: ReturnEntry) => fetchUpdate({ data: entry }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["returns"] }); setModalOpen(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetchDelete({ data: { id } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["returns"] }); },
  });

  const stores = useMemo(
    () => [...new Set(data.map((d) => d.storeName).filter(Boolean))].sort(),
    [data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data
      .filter((r) => {
        const hay = [r.refNumber, r.jobNumber, r.serialNumber, r.storeName, r.notes, r.unitLocation].join(" ").toLowerCase();
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
  }, [data, search, statusFilter, typeFilter, storeFilter, dateFrom, dateTo, sortKey, sortDir]);

  const stats = useMemo(() => {
    const parseAmt = (v: string) => { const n = parseFloat(v.replace(/[^0-9.]/g, "")); return isNaN(n) ? 0 : n; };
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
    else { setSortKey(k); setSortDir(1); }
  }

  function openAdd() { setEditingId(null); setForm(emptyEntry()); setModalOpen(true); }

  function openEdit(r: ReturnEntry) {
    setEditingId(r.id);
    setForm({
      refType: r.refType, refNumber: r.refNumber, jobNumber: r.jobNumber,
      serialNumber: r.serialNumber, storeName: r.storeName,
      productType: r.productType ?? "laptop", bundle: r.bundle,
      unitLocation: r.unitLocation, date: r.date, status: r.status,
      creditStatus: r.creditStatus ?? "unit_on_hand",
      creditNoteNumber: r.creditNoteNumber ?? "", notes: r.notes,
      grsRfcGrnImageUrl: r.grsRfcGrnImageUrl ?? "",
      supplierCreditImageUrl: r.supplierCreditImageUrl ?? "",
      requestedCreditAmount: r.requestedCreditAmount ?? "",
      supplierCreditAmount: r.supplierCreditAmount ?? "",
    });
    setModalOpen(true);
  }

  function save() {
    if (!form.refNumber.trim()) return;
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
      Bundle: r.bundle === "yes" ? "Yes" : r.bundle === "partial" ? "Partial" : r.bundle === "standalone_laptop" ? "Standalone Laptop" : "None",
      Location: r.unitLocation,
      Date: r.date,
      Status: r.status.charAt(0).toUpperCase() + r.status.slice(1),
      "Credit Status": r.creditStatus === "supplier_credit" ? "Supplier Credit" : "Unit on Hand",
      "Credit Note No.": r.creditNoteNumber,
      Notes: r.notes,
    }));
    
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [8,16,14,18,20,12,14,16,12,12,16,16,30].map(w => ({ wch: w }));
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
      "Completed": "C6EFCE",
      "Started": "FFEB9C",
      "Pending": "FFC7CE",
      "Missing": "FF6B6B",
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
      ["Completed", "", filtered.filter(d => d.status === "completed").length],
      ["Started", "", filtered.filter(d => d.status === "started").length],
      ["Pending", "", filtered.filter(d => d.status === "pending").length],
      ["Missing", "", filtered.filter(d => d.status === "missing").length],
      ["", "", ""],
      ["PRODUCT BREAKDOWN", "", "Count"],
      ["Laptops", "", filtered.filter(d => d.productType === "laptop").length],
      ["Printers", "", filtered.filter(d => d.productType === "printer").length],
      ["RMA", "", filtered.filter(d => d.productType === "rma").length],
      ["", "", ""],
      ["BUNDLE STATUS", "", "Count"],
      ["Full Bundle", "", filtered.filter(d => d.bundle === "yes").length],
      ["Partial", "", filtered.filter(d => d.bundle === "partial").length],
      ["Standalone Laptop", "", filtered.filter(d => d.bundle === "standalone_laptop").length],
      ["None / No Bundle", "", filtered.filter(d => d.bundle === "no" || d.bundle === "none").length],
      ["", "", ""],
      ["CREDIT STATUS", "", "Count"],
      ["Supplier Credit", "", filtered.filter(d => d.creditStatus === "supplier_credit").length],
      ["Unit on Hand", "", filtered.filter(d => d.creditStatus === "unit_on_hand").length],
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
    
    XLSX.writeFile(wb, `returns-omni-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  }

  function copyReadOnlyLink() {
    const url = `${window.location.origin}?view=readonly`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    });
  }

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const formDate = form.date ? new Date(form.date + "T00:00:00") : undefined;

  // Show read-only view
  if (isReadOnly) {
    if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin opacity-40" /></div>;
    return <ReadOnlyView data={data} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 py-7 pb-16">

        {/* Top bar */}
        <header className="flex flex-wrap items-start justify-between gap-4 mb-7">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
              <PackageOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-[18px] font-semibold tracking-tight">Returns Tracker</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Omni Technical Solutions · RFC / GRS / GRN retail credit returns
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowDashboard(v => !v)}>
              <BarChart3 className="h-4 w-4" /> {showDashboard ? "Hide" : "Dashboard"}
            </Button>
            <Button variant="outline" size="sm" onClick={copyReadOnlyLink}>
              {copyToast ? <><Check className="h-4 w-4" /> Copied!</> : <><Eye className="h-4 w-4" /> Share view</>}
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={data.length === 0}>
              <FileSpreadsheet className="h-4 w-4" /> Export Excel
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add Return
            </Button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <StatCard label="Total Returns" value={stats.total} />
          <StatCard label="Completed" value={stats.completed + stats.creditProcessed} tone="success" />
          <StatCard label="Active" value={stats.started + stats.inProgress} tone="info" />
          <StatCard label="Pending" value={stats.pending + stats.incomplete} tone="warn" />
          <StatCard label="Missing" value={stats.missing} tone="danger" />
        </div>

        {/* Credit Financial Banner */}
        {(stats.totalRequestedCredit > 0 || stats.totalSupplierCredit > 0) && (
          <div className="rounded-xl border bg-gradient-to-r from-purple-50 via-blue-50 to-emerald-50 shadow-sm p-4 mb-4 flex flex-wrap gap-6 items-center">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center shadow">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Total Credit Requested</p>
                <p className="text-xl font-bold text-blue-800">R {stats.totalRequestedCredit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-600 flex items-center justify-center shadow">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Supplier Credit Received</p>
                <p className="text-xl font-bold text-emerald-800">R {stats.totalSupplierCredit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            {stats.totalRequestedCredit > 0 && (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-600 flex items-center justify-center shadow">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-600">Outstanding Balance</p>
                  <p className={cn("text-xl font-bold", stats.totalRequestedCredit - stats.totalSupplierCredit > 0 ? "text-rose-700" : "text-emerald-700")}>
                    R {Math.abs(stats.totalRequestedCredit - stats.totalSupplierCredit).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                    <span className="text-xs font-normal ml-1">{stats.totalRequestedCredit - stats.totalSupplierCredit > 0 ? "still owed" : "over-credited"}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dashboard panel */}
        {showDashboard && (
          <div className="rounded-xl border bg-card shadow-sm p-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Live Dashboard</h2>
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Live
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">By Type</p>
                {(["RFC","GRS","GRN"] as const).map(t => (
                  <div key={t} className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-accent text-accent-foreground border border-blue-100">{t}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full bg-blue-200 w-[60px] overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: stats.total ? `${(stats.byType[t] / stats.total) * 100}%` : "0%" }} />
                      </div>
                      <span className="text-sm font-semibold w-5 text-right">{stats.byType[t]}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Status</p>
                {([
                  { k: "credit_processed", label: "Credit Processed", color: "bg-purple-500" },
                  { k: "completed", label: "Completed", color: "bg-emerald-500" },
                  { k: "in_progress", label: "In Progress", color: "bg-cyan-500" },
                  { k: "started", label: "Started", color: "bg-blue-500" },
                  { k: "pending", label: "Pending", color: "bg-amber-500" },
                  { k: "incomplete", label: "Incomplete", color: "bg-orange-500" },
                  { k: "missing", label: "Missing", color: "bg-rose-500" },
                ] as const).map(({ k, label, color }) => {
                  const count = data.filter(d => d.status === k).length;
                  if (count === 0) return null;
                  return (
                    <div key={k} className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full bg-muted w-[60px] overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: stats.total ? `${(count / stats.total) * 100}%` : "0%" }} />
                        </div>
                        <span className="text-sm font-semibold w-5 text-right">{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Product</p>
                {[
                  { label: "Laptop", val: stats.byProduct.laptop, color: "bg-sky-500" },
                  { label: "Printer", val: stats.byProduct.printer, color: "bg-violet-500" },
                  { label: "RMA", val: stats.byProduct.rma, color: "bg-amber-500" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full bg-muted w-[60px] overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: stats.total ? `${(val / stats.total) * 100}%` : "0%" }} />
                      </div>
                      <span className="text-sm font-semibold w-5 text-right">{val}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Credit</p>
                {[
                  { label: "Supplier Credit", val: stats.supplierCredit, color: "bg-emerald-500" },
                  { label: "Unit on Hand", val: stats.unitOnHand, color: "bg-slate-400" },
                  { label: "No Physical Unit", val: stats.noPhysicalUnit, color: "bg-rose-400" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 rounded-full bg-muted w-[60px] overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: stats.total ? `${(val / stats.total) * 100}%` : "0%" }} />
                      </div>
                      <span className="text-sm font-semibold w-5 text-right">{val}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] rounded-md border bg-card px-3 py-2 shadow-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ref, job no., serial, store, notes…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] bg-card"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="started">Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="incomplete">Incomplete</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="credit_processed">Credit Processed</SelectItem>
              <SelectItem value="missing">Missing</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px] bg-card"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="RFC">RFC</SelectItem>
              <SelectItem value="GRS">GRS</SelectItem>
              <SelectItem value="GRN">GRN</SelectItem>
            </SelectContent>
          </Select>
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-[170px] bg-card"><SelectValue placeholder="Store" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stores</SelectItem>
              {stores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="text-sm border rounded-md px-2 py-1.5 bg-card outline-none focus:ring-2 focus:ring-primary/20"
              title="From date"
            />
            <span className="text-muted-foreground text-xs">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="text-sm border rounded-md px-2 py-1.5 bg-card outline-none focus:ring-2 focus:ring-primary/20"
              title="To date"
            />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-muted-foreground hover:text-foreground" title="Clear dates">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="bg-muted/50 border-b">
                <tr className="text-left">
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
                  <th className="px-3 py-2.5 w-[110px]" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={13}><div className="py-14 text-center text-muted-foreground"><Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin opacity-40" /><p className="text-foreground font-medium">Loading returns…</p></div></td></tr>
                ) : isError ? (
                  <tr><td colSpan={13}><div className="py-14 text-center"><AlertTriangle className="h-10 w-10 mx-auto mb-3 text-amber-500 opacity-60" /><p className="font-medium mb-1">Failed to load data</p><span className="text-sm text-muted-foreground">Please refresh the page.</span></div></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={13}><div className="py-14 text-center text-muted-foreground"><PackageOpen className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-foreground font-medium mb-1">{data.length === 0 ? "No returns yet" : "No results found"}</p><span className="text-sm">{data.length === 0 ? 'Click "Add Return" to log your first entry.' : "Try adjusting your search or filters."}</span></div></td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setViewEntry(r)}
                    >
                      <td className="px-3.5 py-2.5">
                        <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-accent text-accent-foreground border border-blue-100">{r.refType}</span>
                      </td>
                      <td className="px-3.5 py-2.5"><span className="font-mono text-xs px-2 py-0.5 rounded border bg-muted/40 text-muted-foreground">{r.refNumber || "—"}</span></td>
                      <td className="px-3.5 py-2.5 font-mono text-xs text-muted-foreground">{r.jobNumber || "—"}</td>
                      <td className="px-3.5 py-2.5 font-mono text-xs text-muted-foreground">{r.serialNumber || "—"}</td>
                      <td className="px-3.5 py-2.5 font-medium">{r.storeName || "—"}</td>
                      <td className="px-3.5 py-2.5"><ProductTypeCell value={r.productType} /></td>
                      <td className="px-3.5 py-2.5"><BundleCell value={r.bundle} /></td>
                      <td className="px-3.5 py-2.5 text-xs text-muted-foreground" title={r.unitLocation}>{r.unitLocation || "—"}</td>
                      <td className="px-3.5 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-3.5 py-2.5 text-xs">
                        {r.creditStatus === "supplier_credit" ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-emerald-700">Supplier credit</span>
                            <span className="font-mono text-[11px] text-muted-foreground">{r.creditNoteNumber || "— no CN —"}</span>
                          </div>
                        ) : r.creditStatus === "no_physical_unit" ? (
                          <span className="font-semibold text-rose-700">No physical unit</span>
                        ) : (
                          <span className="font-semibold text-slate-700">Unit on hand</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {r.date ? format(new Date(r.date + "T00:00:00"), "dd MMM yyyy") : "—"}
                      </td>
                      <td className="px-3.5 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate" title={r.notes}>{r.notes || "—"}</td>
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5 justify-end">
                          <IconBtn label="Edit" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                          <IconBtn label="Delete" danger onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          Your data is saved to the cloud and will persist across sessions.
        </p>
      </div>

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Return" : "Add Return"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <Field label="Reference Type">
              <Select value={form.refType} onValueChange={(v) => setForm((f) => ({ ...f, refType: v as RefType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RFC">RFC</SelectItem>
                  <SelectItem value="GRS">GRS</SelectItem>
                  <SelectItem value="GRN">GRN</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reference Number *">
              <Input value={form.refNumber} onChange={(e) => setForm((f) => ({ ...f, refNumber: e.target.value }))} placeholder="e.g. RFC-20241" />
            </Field>
            <Field label="Job Number">
              <Input value={form.jobNumber} onChange={(e) => setForm((f) => ({ ...f, jobNumber: e.target.value }))} placeholder="e.g. JOB-00312" />
            </Field>
            <Field label="Serial Number">
              <Input value={form.serialNumber} onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))} placeholder="e.g. SN7812345600" />
            </Field>
            <Field label="Retailer" className="sm:col-span-2">
              <div className="flex flex-col gap-2">
                <Select value={RETAILERS.includes(form.storeName.split(" - ")[0]) ? form.storeName.split(" - ")[0] : "__custom"} onValueChange={(v) => setForm((f) => ({ ...f, storeName: v === "__custom" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select retailer" /></SelectTrigger>
                  <SelectContent>
                    {RETAILERS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    <SelectItem value="__custom">Other (type below)</SelectItem>
                  </SelectContent>
                </Select>
                {form.storeName && (
                  <Input
                    value={form.storeName.includes(" - ") ? form.storeName.split(" - ")[1] : ""}
                    onChange={(e) => {
                      const retailer = RETAILERS.find(r => form.storeName.startsWith(r)) || form.storeName.split(" - ")[0];
                      setForm((f) => ({ ...f, storeName: e.target.value ? `${retailer} - ${e.target.value}` : retailer }));
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
              <Select value={form.productType} onValueChange={(v) => setForm((f) => ({ ...f, productType: v as ProductType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="laptop">Laptop</SelectItem>
                  <SelectItem value="printer">Printer</SelectItem>
                  <SelectItem value="rma">RMA (Flash Driver, SSD, SD Card, etc)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Bundle Received?">
              <Select value={form.bundle} onValueChange={(v) => setForm((f) => ({ ...f, bundle: v as Bundle }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Input value={form.unitLocation} onChange={(e) => setForm((f) => ({ ...f, unitLocation: e.target.value }))} placeholder="e.g. Shelf B3, Warehouse" />
            </Field>
            <Field label="Date">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.date && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4" />
                    {formDate ? format(formDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={formDate} onSelect={(d) => setForm((f) => ({ ...f, date: d ? format(d, "yyyy-MM-dd") : "" }))} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as Status }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Field label="Credit Status" className="sm:col-span-2">
              <Select value={form.creditStatus} onValueChange={(v) => setForm((f) => ({ ...f, creditStatus: v as CreditStatus, creditNoteNumber: v === "unit_on_hand" ? "" : f.creditNoteNumber }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unit_on_hand">Unit on hand (physical unit with us)</SelectItem>
                  <SelectItem value="supplier_credit">Supplier provided credit</SelectItem>
                  <SelectItem value="no_physical_unit">No physical unit (lost / not returned)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {form.creditStatus === "supplier_credit" && (
              <Field label="Credit Note Number *" className="sm:col-span-2">
                <Input value={form.creditNoteNumber} onChange={(e) => setForm((f) => ({ ...f, creditNoteNumber: e.target.value }))} placeholder="e.g. CN-2024-00872" />
              </Field>
            )}
            <Field label="Credit Amount Requested (R)" className="sm:col-span-1">
              <Input
                type="text"
                value={form.requestedCreditAmount}
                onChange={(e) => setForm((f) => ({ ...f, requestedCreditAmount: e.target.value }))}
                placeholder="e.g. 4 999.00"
              />
            </Field>
            <Field label="Supplier Credit Amount (R)" className="sm:col-span-1">
              <Input
                type="text"
                value={form.supplierCreditAmount}
                onChange={(e) => setForm((f) => ({ ...f, supplierCreditAmount: e.target.value }))}
                placeholder="e.g. 4 500.00"
              />
            </Field>
            <Field label="GRS/RFC/GRN Document" className="sm:col-span-2">
              <div className="flex flex-col gap-2">
                <input type="file" accept="image/*,.pdf" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      setForm((f) => ({ ...f, grsRfcGrnImageUrl: evt.target?.result as string }));
                    };
                    reader.readAsDataURL(file);
                  }
                }} className="block text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border file:border-gray-300 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100" />
                {form.grsRfcGrnImageUrl && (
                  form.grsRfcGrnImageUrl.startsWith("data:application/pdf") ? (
                    <a href={form.grsRfcGrnImageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                      <FileSpreadsheet className="h-4 w-4" /> View PDF document
                    </a>
                  ) : (
                    <img src={form.grsRfcGrnImageUrl} alt="GRS/RFC/GRN" className="h-24 w-auto rounded border" />
                  )
                )}
              </div>
            </Field>
            {form.creditStatus === "supplier_credit" && (
              <Field label="Supplier Credit Note Image" className="sm:col-span-2">
                <div className="flex flex-col gap-2">
                  <input type="file" accept="image/*,.pdf" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        setForm((f) => ({ ...f, supplierCreditImageUrl: evt.target?.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }} className="block text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border file:border-gray-300 file:text-sm file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100" />
                  {form.supplierCreditImageUrl && (
                    form.supplierCreditImageUrl.startsWith("data:application/pdf") ? (
                      <a href={form.supplierCreditImageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                        <FileSpreadsheet className="h-4 w-4" /> View PDF document
                      </a>
                    ) : (
                      <img src={form.supplierCreditImageUrl} alt="Credit Note" className="h-24 w-auto rounded border" />
                    )
                  )}
                </div>
              </Field>
            )}
            <Field label="Notes" className="sm:col-span-2">
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Query details, credit status, any relevant info…" rows={3} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={isMutating}>Cancel</Button>
            <Button onClick={save} disabled={!form.refNumber.trim() || isMutating}>
              {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {isMutating ? "Saving…" : "Save Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail View Modal (click a row) ── */}
      {viewEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewEntry(null)}>
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-slate-900 to-slate-800 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-white/10 text-white border border-white/20">{viewEntry.refType}</span>
                <div>
                  <p className="text-white font-bold text-lg">{viewEntry.refNumber || "—"}</p>
                  <p className="text-white/60 text-xs">{viewEntry.storeName || "No store"} · {viewEntry.date ? format(new Date(viewEntry.date + "T00:00:00"), "dd MMM yyyy") : "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={viewEntry.status} />
                <button onClick={() => setViewEntry(null)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-4">
              {/* Row 1 */}
              <DetailRow label="Job Number" value={viewEntry.jobNumber} mono />
              <DetailRow label="Serial Number" value={viewEntry.serialNumber} mono />
              <DetailRow label="Product" value={<ProductTypeCell value={viewEntry.productType} />} />
              <DetailRow label="Bundle" value={<BundleCell value={viewEntry.bundle} />} />
              <DetailRow label="Unit Location" value={viewEntry.unitLocation} />
              <DetailRow label="Date" value={viewEntry.date ? format(new Date(viewEntry.date + "T00:00:00"), "dd MMMM yyyy") : "—"} />

              {/* Credit section */}
              <div className="col-span-2 border-t pt-3 mt-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Credit Information</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <DetailRow label="Credit Status" value={
                    viewEntry.creditStatus === "supplier_credit"
                      ? <span className="text-emerald-700 font-semibold">Supplier Credit</span>
                      : viewEntry.creditStatus === "no_physical_unit"
                      ? <span className="text-rose-700 font-semibold">No Physical Unit</span>
                      : <span className="text-slate-700 font-semibold">Unit on Hand</span>
                  } />
                  {viewEntry.creditNoteNumber && <DetailRow label="Credit Note No." value={viewEntry.creditNoteNumber} mono />}
                  {viewEntry.requestedCreditAmount && (
                    <DetailRow label="Credit Requested" value={<span className="font-bold text-blue-700">R {viewEntry.requestedCreditAmount}</span>} />
                  )}
                  {viewEntry.supplierCreditAmount && (
                    <DetailRow label="Supplier Credited" value={<span className="font-bold text-emerald-700">R {viewEntry.supplierCreditAmount}</span>} />
                  )}
                </div>
              </div>

              {/* Notes */}
              {viewEntry.notes && (
                <div className="col-span-2 border-t pt-3 mt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Notes</p>
                  <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">{viewEntry.notes}</p>
                </div>
              )}

              {/* Documents */}
              {(viewEntry.grsRfcGrnImageUrl || viewEntry.supplierCreditImageUrl) && (
                <div className="col-span-2 border-t pt-3 mt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Attached Documents</p>
                  <div className="flex flex-wrap gap-3">
                    {viewEntry.grsRfcGrnImageUrl && (
                      <DocPreview url={viewEntry.grsRfcGrnImageUrl} label="GRS/RFC/GRN Document" color="blue" />
                    )}
                    {viewEntry.supplierCreditImageUrl && (
                      <DocPreview url={viewEntry.supplierCreditImageUrl} label="Supplier Credit Note" color="emerald" />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between px-5 pb-5 pt-2 border-t gap-2 flex-wrap">
              <p className="text-[11px] text-muted-foreground">Created {viewEntry.createdAt ? format(new Date(viewEntry.createdAt), "dd MMM yyyy HH:mm") : "—"}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setViewEntry(null); openEdit(viewEntry); }}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => setViewEntry(null)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared components ──

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "warn" | "info" | "danger" }) {
  const toneCls = tone === "success" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : tone === "info" ? "text-blue-700" : tone === "danger" ? "text-rose-700" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      <div className={cn("text-2xl font-semibold tracking-tight", toneCls)}>{value}</div>
    </div>
  );
}

function Th({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <th onClick={onClick} className={cn("px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap select-none", onClick && "cursor-pointer hover:text-foreground")}>
      <span className="inline-flex items-center gap-1">{children}{onClick && <ArrowUpDown className="h-3 w-3 opacity-40" />}</span>
    </th>
  );
}

function IconBtn({ children, onClick, label, danger }: { children: React.ReactNode; onClick: () => void; label: string; danger?: boolean }) {
  return (
    <button title={label} aria-label={label} onClick={onClick} className={cn("h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors", danger && "text-rose-600 hover:bg-rose-50")}>
      {children}
    </button>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <p className={cn("text-sm text-foreground", mono && "font-mono")}>{value || "—"}</p>
    </div>
  );
}

function DocPreview({ url, label, color }: { url: string; label: string; color: "blue" | "emerald" }) {
  const isPdf = url.startsWith("data:application/pdf");
  const cls = color === "blue"
    ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
    : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100";

  if (isPdf) {
    return (
      <a href={url} target="_blank" rel="noreferrer" download={`${label}.pdf`}
        className={cn("flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors", cls)}>
        <FileText className="h-5 w-5" /> {label}
        <span className="text-[11px] font-normal opacity-70 ml-1">PDF · click to view / download</span>
      </a>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <a href={url} target="_blank" rel="noreferrer" download={`${label}.jpg`}>
        <img src={url} alt={label} className="h-36 w-auto rounded-lg border shadow-sm hover:shadow-md transition-shadow object-cover" />
      </a>
      <a href={url} download={`${label}.jpg`}
        className={cn("inline-flex items-center gap-1.5 text-xs font-semibold rounded-md px-2 py-1 border transition-colors self-start", cls)}>
        <Download className="h-3.5 w-3.5" /> Download
      </a>
    </div>
  );
}

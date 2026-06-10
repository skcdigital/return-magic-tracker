import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  PackageOpen,
  Plus,
  Download,
  Search,
  Pencil,
  Trash2,
  Eye,
  X,
  CheckCircle2,
  PlayCircle,
  Clock,
  AlertCircle,
  Calendar as CalendarIcon,
  ArrowUpDown,
  Check,
  AlertTriangle,
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Returns Tracker — Suzan Kwinika" },
      {
        name: "description",
        content:
          "Professional tracker for RFC, GRS and GRN retail credit returns — log references, job numbers, serials, stores, locations and statuses.",
      },
    ],
  }),
  component: ReturnsTrackerPage,
});

type RefType = "RFC" | "GRS" | "GRN";
type Status = "completed" | "started" | "pending";
type Bundle = "yes" | "partial" | "no";
type ProductType = "laptop" | "printer";
type CreditStatus = "supplier_credit" | "unit_on_hand";

interface ReturnEntry {
  id: string;
  refType: RefType;
  refNumber: string;
  jobNumber: string;
  serialNumber: string;
  storeName: string;
  productType: ProductType;
  bundle: Bundle;
  unitLocation: string;
  date: string; // yyyy-MM-dd
  status: Status;
  creditStatus: CreditStatus;
  creditNoteNumber: string;
  notes: string;
  createdAt: number;
}

const STORAGE_KEY = "suzan.returns.tracker.v1";

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
};

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

function ReturnsTrackerPage() {
  const [data, setData] = useState<ReturnEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyEntry());

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setData(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  const stores = useMemo(
    () => [...new Set(data.map((d) => d.storeName).filter(Boolean))].sort(),
    [data],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data
      .filter((r) => {
        const hay = [
          r.refNumber,
          r.jobNumber,
          r.serialNumber,
          r.storeName,
          r.notes,
          r.unitLocation,
        ]
          .join(" ")
          .toLowerCase();
        if (q && !hay.includes(q)) return false;
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (typeFilter !== "all" && r.refType !== typeFilter) return false;
        if (storeFilter !== "all" && r.storeName !== storeFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        return av < bv ? sortDir : av > bv ? -sortDir : 0;
      });
  }, [data, search, statusFilter, typeFilter, storeFilter, sortKey, sortDir]);

  const stats = useMemo(() => {
    return {
      total: data.length,
      completed: data.filter((d) => d.status === "completed").length,
      started: data.filter((d) => d.status === "started").length,
      pending: data.filter((d) => d.status === "pending").length,
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
    });
    setModalOpen(true);
  }

  function save() {
    if (!form.refNumber.trim()) return;
    if (editingId) {
      setData((d) => d.map((x) => (x.id === editingId ? { ...x, ...form } : x)));
    } else {
      setData((d) => [
        {
          ...form,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
        },
        ...d,
      ]);
    }
    setModalOpen(false);
  }

  function remove(id: string) {
    if (confirm("Delete this return entry?")) {
      setData((d) => d.filter((x) => x.id !== id));
    }
  }

  function exportCSV() {
    const headers = [
      "Type",
      "Reference",
      "Job Number",
      "Serial Number",
      "Store",
      "Product",
      "Bundle",
      "Location",
      "Date",
      "Status",
      "Credit Status",
      "Credit Note No.",
      "Notes",
    ];
    const rows = data.map((r) =>
      [
        r.refType,
        r.refNumber,
        r.jobNumber,
        r.serialNumber,
        r.storeName,
        r.productType,
        r.bundle,
        r.unitLocation,
        r.date,
        r.status,
        r.creditStatus === "supplier_credit" ? "Supplier credit" : "Unit on hand",
        r.creditNoteNumber,
        r.notes,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `returns-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const formDate = form.date ? new Date(form.date + "T00:00:00") : undefined;

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
                Suzan Kwinika · RFC / GRS / GRN retail credit returns
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={data.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add Return
            </Button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total Returns" value={stats.total} />
          <StatCard label="Completed" value={stats.completed} tone="success" />
          <StatCard label="Started" value={stats.started} tone="info" />
          <StatCard label="Pending" value={stats.pending} tone="warn" />
        </div>

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
            <SelectTrigger className="w-[150px] bg-card">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="started">Started</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px] bg-card">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="RFC">RFC</SelectItem>
              <SelectItem value="GRS">GRS</SelectItem>
              <SelectItem value="GRN">GRN</SelectItem>
            </SelectContent>
          </Select>
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-[170px] bg-card">
              <SelectValue placeholder="Store" />
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
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={13}>
                      <div className="py-14 text-center text-muted-foreground">
                        <PackageOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-foreground font-medium mb-1">
                          {data.length === 0 ? "No returns yet" : "No results found"}
                        </p>
                        <span className="text-sm">
                          {data.length === 0
                            ? 'Click "Add Return" to log your first entry.'
                            : "Try adjusting your search or filters."}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
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
                        <BundleCell value={r.bundle} />
                      </td>
                      <td className="px-3.5 py-2.5 text-xs text-muted-foreground" title={r.unitLocation}>
                        {r.unitLocation || "—"}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-3.5 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {r.date ? format(new Date(r.date + "T00:00:00"), "dd MMM yyyy") : "—"}
                      </td>
                      <td
                        className="px-3.5 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate"
                        title={r.notes}
                      >
                        {r.notes || "—"}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-0.5 justify-end">
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
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          Your data is saved locally in this browser.
        </p>
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Return" : "Add Return"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <Field label="Reference Type">
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
              />
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
            <Field label="Store Name" className="sm:col-span-2">
              <Input
                value={form.storeName}
                onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))}
                placeholder="e.g. Makro Silverton"
              />
            </Field>
            <Field label="Bundle Received?">
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
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Unit Location">
              <Input
                value={form.unitLocation}
                onChange={(e) => setForm((f) => ({ ...f, unitLocation: e.target.value }))}
                placeholder="e.g. Shelf B3, DSD Warehouse"
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
                      setForm((f) => ({
                        ...f,
                        date: d ? format(d, "yyyy-MM-dd") : "",
                      }))
                    }
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
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
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Query details, credit status, any relevant info…"
                rows={3}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!form.refNumber.trim()}>
              <Check className="h-4 w-4" /> Save Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warn" | "info";
}) {
  const toneCls =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "info"
          ? "text-blue-700"
          : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </div>
      <div className={cn("text-2xl font-semibold tracking-tight", toneCls)}>{value}</div>
    </div>
  );
}

function Th({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        "px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap select-none",
        onClick && "cursor-pointer hover:text-foreground",
      )}
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
        "h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors",
        danger && "text-rose-600 hover:bg-rose-50",
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
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

// silence unused import warning
void Eye;

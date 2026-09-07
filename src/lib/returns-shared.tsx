import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import {
  Clock,
  CheckCircle2,
  PlayCircle,
  AlertTriangle,
  Activity,
  CreditCard,
  Check,
  X,
  FileText,
  ScanLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { ReturnEntry, Status, ProductType, Bundle } from "@/lib/returns.functions";

// Not yet in TS's DOM lib — declare the shape we use.
interface BarcodeDetectorResult {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

// ── Camera barcode scanner: fills a field from a device camera scan.
// Silently unavailable (renders nothing) on browsers without BarcodeDetector
// support (e.g. Safari) — manual entry always remains the fallback. ──
export function BarcodeScanButton({ onDetect }: { onDetect: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const supported = typeof window !== "undefined" && !!window.BarcodeDetector;

  useEffect(() => {
    if (!open || !window.BarcodeDetector) return;
    let cancelled = false;
    const detector = new window.BarcodeDetector();

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              onDetect(codes[0].rawValue);
              setOpen(false);
              return;
            }
          } catch {
            // Ignore per-frame detection errors (e.g. video not ready yet).
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) setError("Camera access denied or unavailable.");
      }
    }
    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, onDetect]);

  if (!supported) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        title="Scan barcode"
        className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-white/10 bg-[#20282f] text-slate-300 hover:text-primary hover:border-primary/40 transition-colors flex-shrink-0"
      >
        <ScanLine className="h-4 w-4" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[#161d22] rounded-xl border border-white/10 overflow-hidden max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <p className="text-sm font-semibold text-white">Scan barcode</p>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative aspect-video bg-black">
              <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-6 border-2 border-primary/70 rounded-lg pointer-events-none" />
            </div>
            <p className={cn("px-4 py-3 text-xs", error ? "text-rose-400" : "text-slate-400")}>
              {error ?? "Point the camera at the barcode."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ── Attachment helpers: uploads can be images or PDFs, stored in a
// private bucket. Stored values are historical public URLs or plain
// storage paths; we resolve them to a short-lived signed URL to display. ──
const ATTACHMENTS_BUCKET = "return-attachments";
const SIGNED_URL_TTL_SECONDS = 3600;

export function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

function extractAttachmentPath(url: string): string {
  const marker = `/${ATTACHMENTS_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
}

export function useSignedAttachmentUrl(url: string): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    setSignedUrl(null);
    if (!url) return;
    let cancelled = false;
    const path = extractAttachmentPath(url);
    supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setSignedUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return signedUrl;
}

export function AttachmentPreview({
  url,
  alt,
  size = "h-14 w-14",
  caption,
}: {
  url: string;
  alt: string;
  size?: string;
  caption?: string;
}) {
  const signedUrl = useSignedAttachmentUrl(url);
  const pdf = isPdfUrl(url);
  const ready = Boolean(signedUrl);

  return (
    <div className="flex flex-col items-center gap-1">
      <a
        href={signedUrl ?? undefined}
        target="_blank"
        rel="noreferrer"
        className={cn("group", !ready && "pointer-events-none")}
      >
        {pdf ? (
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 rounded-md border border-white/10 bg-[#232e36] text-rose-400 group-hover:opacity-80 transition-opacity",
              size,
            )}
            title={alt}
          >
            <FileText className="h-5 w-5" />
            <span className="text-[9px] font-semibold uppercase tracking-wide">PDF</span>
          </div>
        ) : ready ? (
          <img
            src={signedUrl!}
            alt={alt}
            className={cn(
              "object-cover rounded-md border border-white/10 group-hover:opacity-80 transition-opacity",
              size,
            )}
          />
        ) : (
          <div className={cn("rounded-md border border-white/10 bg-[#232e36] animate-pulse", size)} />
        )}
      </a>
      {pdf && (
        <a
          href={signedUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "text-xs font-medium text-blue-400 hover:text-blue-300 underline underline-offset-2",
            !ready && "pointer-events-none opacity-60",
          )}
        >
          View PDF
        </a>
      )}
      {caption && <p className="text-[10px] text-muted-foreground text-center">{caption}</p>}
    </div>
  );
}

// ── Animated counter hook ──
export function useCountUp(target: number, duration = 900) {
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

export const STATUS_META: Record<Status, { label: string; icon: typeof Clock; cls: string }> = {
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    cls: "bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30",
  },
  started: {
    label: "Started",
    icon: PlayCircle,
    cls: "bg-blue-500/15 text-blue-400 ring-1 ring-inset ring-blue-500/30",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    cls: "bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-500/30",
  },
  missing: {
    label: "Missing",
    icon: AlertTriangle,
    cls: "bg-rose-500/15 text-rose-400 ring-1 ring-inset ring-rose-500/30",
  },
  incomplete: {
    label: "Incomplete",
    icon: AlertTriangle,
    cls: "bg-orange-500/15 text-orange-400 ring-1 ring-inset ring-orange-500/30",
  },
  in_progress: {
    label: "In Progress",
    icon: Activity,
    cls: "bg-cyan-500/15 text-cyan-400 ring-1 ring-inset ring-cyan-500/30",
  },
  credit_processed: {
    label: "Credit Processed",
    icon: CreditCard,
    cls: "bg-purple-500/15 text-purple-400 ring-1 ring-inset ring-purple-500/30",
  },
};

// ── Aging: returns still open past this many days flag as "aging" ──
export const AGING_THRESHOLD_DAYS = 7;
const AGING_TERMINAL_STATUSES: Status[] = ["completed", "credit_processed"];

export function getDaysAging(entry: { date: string; status: Status }): number | null {
  if (!entry.date || AGING_TERMINAL_STATUSES.includes(entry.status)) return null;
  const opened = new Date(entry.date + "T00:00:00");
  if (isNaN(opened.getTime())) return null;
  const diffMs = Date.now() - opened.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function isAging(entry: { date: string; status: Status }): boolean {
  const days = getDaysAging(entry);
  return days !== null && days > AGING_THRESHOLD_DAYS;
}

export function AgingBadge({ days }: { days: number }) {
  return (
    <span
      title={`Open for ${days} day${days === 1 ? "" : "s"} — past the ${AGING_THRESHOLD_DAYS}-day threshold`}
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-500/30"
    >
      <AlertTriangle className="h-2.5 w-2.5" />
      {days}d
    </span>
  );
}

export function ProductTypeCell({ value }: { value: ProductType }) {
  const config: Record<ProductType, { label: string; color: string }> = {
    laptop: { label: "Laptop", color: "bg-sky-500/15 text-sky-400 ring-sky-500/30" },
    printer: { label: "Printer", color: "bg-violet-500/15 text-violet-400 ring-violet-500/30" },
    rma: { label: "RMA", color: "bg-amber-500/15 text-amber-400 ring-amber-500/30" },
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

export function BundleCell({ value }: { value: Bundle }) {
  if (value === "yes")
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
        <Check className="h-3.5 w-3.5" /> Yes
      </span>
    );
  if (value === "partial")
    return (
      <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-semibold">
        <AlertTriangle className="h-3.5 w-3.5" /> Partial
      </span>
    );
  if (value === "standalone_laptop")
    return (
      <span className="inline-flex items-center gap-1 text-blue-400 text-xs font-semibold">
        <Check className="h-3.5 w-3.5" /> Standalone
      </span>
    );
  if (value === "none")
    return (
      <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-semibold">
        <X className="h-3.5 w-3.5" /> None
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-semibold">
      <X className="h-3.5 w-3.5" /> No
    </span>
  );
}

export function StatusBadge({ status }: { status: Status }) {
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

export function StatCard({
  label,
  value,
  color,
  dot,
  highlighted,
  pulse,
}: {
  label: string;
  value: number;
  color: string;
  dot: string;
  highlighted?: boolean;
  pulse?: boolean;
}) {
  const animated = useCountUp(value);
  return (
    <div
      className={cn(
        "bg-[#20282f] rounded-xl border px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow",
        highlighted ? "border-amber-500/50 ring-1 ring-amber-500/30" : "border-white/10",
      )}
    >
      <p className="text-[11px] text-slate-400 font-medium mb-1.5 truncate flex items-center gap-1.5">
        {label}
        {pulse && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
      </p>
      <p className={cn("text-2xl font-bold tabular-nums tracking-tight", color)}>{animated}</p>
      <div className={cn("h-0.5 w-6 rounded-full mt-2 opacity-60", dot)} />
    </div>
  );
}

// ── Pure stat computation, shared by Returns / Dashboard / Analytics pages ──
export interface ReturnsStats {
  total: number;
  completed: number;
  creditProcessed: number;
  started: number;
  inProgress: number;
  pending: number;
  incomplete: number;
  missing: number;
  aging: number;
  supplierCredit: number;
  unitOnHand: number;
  noPhysicalUnit: number;
  byType: { RFC: number; GRS: number; GRN: number };
  byProduct: { laptop: number; printer: number; rma: number };
  bundleIssues: number;
  totalRequestedCredit: number;
  totalSupplierCredit: number;
}

function parseAmt(v: string) {
  const n = parseFloat((v || "").replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

export function computeStats(data: ReturnEntry[]): ReturnsStats {
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
}

export interface WeeklyTrendPoint {
  label: string;
  count: number;
  credit: number;
}

export function computeWeeklyTrend(data: ReturnEntry[], weeks = 8): WeeklyTrendPoint[] {
  const startOfWeek = (d: Date) => {
    const copy = new Date(d);
    const day = copy.getDay();
    const diff = copy.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
    copy.setDate(diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };
  const now = new Date();
  const buckets: { weekStart: Date; label: string; count: number; credit: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = startOfWeek(new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000));
    buckets.push({ weekStart: ws, label: format(ws, "dd MMM"), count: 0, credit: 0 });
  }
  for (const entry of data) {
    if (!entry.date) continue;
    const entryDate = new Date(entry.date + "T00:00:00");
    const ws = startOfWeek(entryDate).getTime();
    const bucket = buckets.find((b) => b.weekStart.getTime() === ws);
    if (bucket) {
      bucket.count += 1;
      bucket.credit += parseAmt(entry.supplierCreditAmount);
    }
  }
  return buckets.map(({ label, count, credit }) => ({ label, count, credit }));
}
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RefTypeSchema = z.enum(["RFC", "GRS", "GRN"]);
const StatusSchema = z.enum(["completed", "started", "pending", "missing", "incomplete", "in_progress", "credit_processed"]);
const BundleSchema = z.enum(["yes", "partial", "no", "standalone_laptop", "none"]);
const ProductTypeSchema = z.enum(["laptop", "printer", "rma"]);
const CreditStatusSchema = z.enum(["supplier_credit", "unit_on_hand", "no_physical_unit"]);

export type RefType = z.infer<typeof RefTypeSchema>;
export type Status = z.infer<typeof StatusSchema>;
export type Bundle = z.infer<typeof BundleSchema>;
export type ProductType = z.infer<typeof ProductTypeSchema>;
export type CreditStatus = z.infer<typeof CreditStatusSchema>;

export interface ReturnEntry {
  id: string;
  refType: RefType;
  refNumber: string;
  jobNumber: string;
  serialNumber: string;
  storeName: string;
  productType: ProductType;
  bundle: Bundle;
  unitLocation: string;
  date: string;
  status: Status;
  creditStatus: CreditStatus;
  creditNoteNumber: string;
  notes: string;
  requestedCreditAmount: string;
  supplierCreditAmount: string;
  grsRfcGrnImageUrl: string;
  supplierCreditImageUrl: string;
  createdAt: string;
}

function dbToEntry(row: Record<string, unknown>): ReturnEntry {
  return {
    id: String(row.id),
    refType: String(row.ref_type) as RefType,
    refNumber: String(row.ref_number ?? ""),
    jobNumber: String(row.job_number ?? ""),
    serialNumber: String(row.serial_number ?? ""),
    storeName: String(row.store_name ?? ""),
    productType: String(row.product_type ?? "laptop") as ProductType,
    bundle: String(row.bundle ?? "no") as Bundle,
    unitLocation: String(row.unit_location ?? ""),
    date: String(row.date ?? ""),
    status: String(row.status ?? "pending") as Status,
    creditStatus: String(row.credit_status ?? "unit_on_hand") as CreditStatus,
    creditNoteNumber: String(row.credit_note_number ?? ""),
    notes: String(row.notes ?? ""),
    requestedCreditAmount: String(row.requested_credit_amount ?? ""),
    supplierCreditAmount: String(row.supplier_credit_amount ?? ""),
    grsRfcGrnImageUrl: String(row.grs_rfc_grn_image_url ?? ""),
    supplierCreditImageUrl: String(row.supplier_credit_image_url ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

function entryToDb(entry: Partial<ReturnEntry>) {
  return {
    ref_type: entry.refType,
    ref_number: entry.refNumber,
    job_number: entry.jobNumber,
    serial_number: entry.serialNumber,
    store_name: entry.storeName,
    product_type: entry.productType,
    bundle: entry.bundle,
    unit_location: entry.unitLocation,
    date: entry.date,
    status: entry.status,
    credit_status: entry.creditStatus,
    credit_note_number: entry.creditNoteNumber,
    notes: entry.notes,
    requested_credit_amount: entry.requestedCreditAmount,
    supplier_credit_amount: entry.supplierCreditAmount,
    grs_rfc_grn_image_url: entry.grsRfcGrnImageUrl || null,
    supplier_credit_image_url: entry.supplierCreditImageUrl || null,
  } as any;
}

export const listReturns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("return_entries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { entries: (data ?? []).map(dbToEntry) };
  });

const createSchema = z.object({
  refType: RefTypeSchema,
  refNumber: z.string().min(1),
  jobNumber: z.string(),
  serialNumber: z.string(),
  storeName: z.string(),
  productType: ProductTypeSchema,
  bundle: BundleSchema,
  unitLocation: z.string(),
  date: z.string(),
  status: StatusSchema,
  creditStatus: CreditStatusSchema,
  creditNoteNumber: z.string(),
  notes: z.string(),
  requestedCreditAmount: z.string().optional().default(""),
  supplierCreditAmount: z.string().optional().default(""),
  grsRfcGrnImageUrl: z.string().optional().default(""),
  supplierCreditImageUrl: z.string().optional().default(""),
});

export const createReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await context.supabase
      .from("return_entries")
      .insert(entryToDb(data))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { entry: dbToEntry(inserted!) };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  refType: RefTypeSchema,
  refNumber: z.string().min(1),
  jobNumber: z.string(),
  serialNumber: z.string(),
  storeName: z.string(),
  productType: ProductTypeSchema,
  bundle: BundleSchema,
  unitLocation: z.string(),
  date: z.string(),
  status: StatusSchema,
  creditStatus: CreditStatusSchema,
  creditNoteNumber: z.string(),
  notes: z.string(),
  requestedCreditAmount: z.string().optional().default(""),
  supplierCreditAmount: z.string().optional().default(""),
  grsRfcGrnImageUrl: z.string().optional().default(""),
  supplierCreditImageUrl: z.string().optional().default(""),
});

export const updateReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase
      .from("return_entries")
      .update(entryToDb(rest))
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true as const };
  });

const deleteSchema = z.object({ id: z.string().uuid() });

export const deleteReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("return_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// Reference numbers like "-" or "?" are used as placeholders when no real
// reference is available yet, and legitimately repeat across entries — only
// warn on duplicates of an actual-looking reference number.
const PLACEHOLDER_REF_NUMBERS = new Set(["-", "?", "n/a", "na", "unknown", "none", "tbc", "pending"]);

export interface DuplicateRefMatch {
  id: string;
  refType: RefType;
  storeName: string;
  date: string;
  status: Status;
}

const checkDuplicateRefSchema = z.object({
  refNumber: z.string(),
  excludeId: z.string().uuid().optional(),
});

export const checkDuplicateRefNumber = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => checkDuplicateRefSchema.parse(input))
  .handler(async ({ data, context }) => {
    const normalized = data.refNumber.trim();
    if (!normalized || PLACEHOLDER_REF_NUMBERS.has(normalized.toLowerCase())) {
      return { matches: [] as DuplicateRefMatch[] };
    }
    let query = context.supabase
      .from("return_entries")
      .select("id, ref_type, store_name, date, status")
      .ilike("ref_number", normalized)
      .limit(5);
    if (data.excludeId) query = query.neq("id", data.excludeId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const matches: DuplicateRefMatch[] = (rows ?? []).map((r: any) => ({
      id: String(r.id),
      refType: String(r.ref_type) as RefType,
      storeName: String(r.store_name ?? ""),
      date: String(r.date ?? ""),
      status: String(r.status ?? "pending") as Status,
    }));
    return { matches };
  });

export interface AuditEntry {
  id: string;
  action: "insert" | "update" | "delete";
  changedByEmail: string;
  changedAt: string;
  oldData: Record<string, any> | null;
  newData: Record<string, any> | null;
}

const auditSchema = z.object({ entryId: z.string().uuid() });

export const listReturnAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => auditSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("return_entries_audit")
      .select("*")
      .eq("entry_id", data.entryId)
      .order("changed_at", { ascending: false });
    if (error) throw new Error(error.message);
    const entries: AuditEntry[] = (rows ?? []).map((r: any) => ({
      id: String(r.id),
      action: r.action,
      changedByEmail: r.changed_by_email ?? "Unknown",
      changedAt: String(r.changed_at),
      oldData: r.old_data,
      newData: r.new_data,
    }));
    return { entries };
  });
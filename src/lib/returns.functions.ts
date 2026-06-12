import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const RefTypeSchema = z.enum(["RFC", "GRS", "GRN"]);
const StatusSchema = z.enum(["completed", "started", "pending", "missing"]);
const BundleSchema = z.enum(["yes", "partial", "no", "standalone_laptop", "none"]);
const ProductTypeSchema = z.enum(["laptop", "printer", "rma"]);
const CreditStatusSchema = z.enum(["supplier_credit", "unit_on_hand"]);

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
  createdAt: string;
}

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
  } as any;
}

export const listReturns = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getClient();
  const { data, error } = await supabase
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
});

export const createReturn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = getClient();
    const { data: inserted, error } = await supabase
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
});

export const updateReturn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = getClient();
    const { id, ...rest } = data;
    const { data: updated, error } = await supabase
      .from("return_entries")
      .update(entryToDb(rest))
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { entry: dbToEntry(updated!) };
  });

const deleteSchema = z.object({ id: z.string().uuid() });

export const deleteReturn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => deleteSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = getClient();
    const { error } = await supabase.from("return_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

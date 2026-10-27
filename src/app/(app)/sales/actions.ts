"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { machineMatchKeys } from "@/lib/sales";
import {
  MAX_SALES_ROWS,
  isSalesSource,
  matchKey,
  sourceLabel,
  type DailyTotal,
  type SaleRow,
  type SalesSource,
} from "@/lib/sales-import";

export type SalesImportResult = {
  error?: string;
  saved?: number;
  matched?: number;
  total?: number;
};

const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);

// Saves one system's report for one month (replacing that month), then
// matches any new IDs it can to machines automatically.
export async function importSales(source: SalesSource, month: string, rows: SaleRow[]): Promise<SalesImportResult> {
  await requireRole(OFFICE_ROLES);
  if (!isSalesSource(source)) return { error: "Unknown sales report." };
  if (!/^\d{4}-\d{2}-01$/.test(month)) return { error: "Please choose the month these sales are for." };
  if (!Array.isArray(rows) || rows.length === 0) return { error: "The file has no sales in it." };
  if (rows.length > MAX_SALES_ROWS) return { error: `Please import at most ${MAX_SALES_ROWS} machines at a time.` };

  // Never trust the browser: check every row again.
  const clean: SaleRow[] = [];
  for (const r of rows) {
    const id = typeof r?.external_id === "string" ? r.external_id.trim() : "";
    if (!id || id.length > 200) return { error: "A row has a missing or very long machine ID." };
    if (!finite(r.amount) || !finite(r.units)) return { error: `The sales for ${id} aren't numbers.` };
    if ((r.card_amount !== null && !finite(r.card_amount)) || (r.cash_amount !== null && !finite(r.cash_amount))) {
      return { error: `The card or cash sales for ${id} aren't numbers.` };
    }
    clean.push({
      external_id: id,
      external_name: typeof r.external_name === "string" ? r.external_name.slice(0, 300) : null,
      units: Math.round(r.units),
      amount: Math.round(r.amount * 100) / 100,
      card_amount: r.card_amount,
      cash_amount: r.cash_amount,
    });
  }

  const supabase = await createClient();
  const { data: saved, error } = await supabase.rpc("import_sales", { p_source: source, p_month: month, p_rows: clean });
  if (error) {
    if (error.code === "PGRST202") return { error: "The database needs updating (run 18_sales.sql in Supabase)." };
    return { error: `Could not save the ${sourceLabel(source)} sales: ${error.message}` };
  }

  // Link IDs seen for the first time to the one machine they name, if any.
  const [{ data: links }, keys] = await Promise.all([
    supabase.from("sales_links").select("external_id").eq("source", source),
    machineMatchKeys(),
  ]);
  const known = new Set((links ?? []).map((l) => l.external_id as string));
  const newLinks = clean
    .filter((r) => !known.has(r.external_id))
    .map((r) => ({ source, external_id: r.external_id, machine_id: keys.get(matchKey(r.external_id)) ?? null }))
    .filter((l): l is { source: SalesSource; external_id: string; machine_id: string } => Boolean(l.machine_id));
  if (newLinks.length) await supabase.from("sales_links").insert(newLinks);

  revalidatePath("/sales");
  return {
    saved: saved as number,
    matched: newLinks.length,
    total: Math.round(clean.reduce((t, r) => t + r.amount, 0) * 100) / 100,
  };
}

// Matches a sales ID to a machine, or (machineId "none") stops asking about it.
export async function linkSale(source: SalesSource, externalId: string, formData: FormData) {
  await requireRole(OFFICE_ROLES);
  const machineId = String(formData.get("machine_id") ?? "");
  if (!isSalesSource(source) || !externalId) return;
  if (machineId !== "none" && !isUuid(machineId)) return;
  const supabase = await createClient();
  await supabase
    .from("sales_links")
    .upsert(
      { source, external_id: externalId, machine_id: machineId === "none" ? null : machineId },
      { onConflict: "organization_id,source,external_id" },
    );
  revalidatePath("/sales");
}

// Takes back a "don't track", so the ID shows up for matching again.
export async function unignoreSale(source: SalesSource, externalId: string) {
  await requireRole(OFFICE_ROLES);
  if (!isSalesSource(source) || !externalId) return;
  const supabase = await createClient();
  await supabase.from("sales_links").delete().eq("source", source).eq("external_id", externalId).is("machine_id", null);
  revalidatePath("/sales");
}

// Saves daily totals (one per system per day); a day imported again is replaced.
export async function importDailySales(rows: DailyTotal[]): Promise<SalesImportResult> {
  await requireRole(OFFICE_ROLES);
  if (!Array.isArray(rows) || rows.length === 0) return { error: "There are no daily totals to save." };
  if (rows.length > 5000) return { error: "Please import at most 5,000 days at a time." };
  const seen = new Set<string>();
  for (const r of rows) {
    if (!isSalesSource(r?.source) || !/^\d{4}-\d{2}-\d{2}$/.test(r.day ?? "")) return { error: "A row has a missing system or date." };
    if (!finite(r.amount) || !finite(r.units)) return { error: `The sales for ${r.day} aren't numbers.` };
    const key = `${r.source}|${r.day}`;
    if (seen.has(key)) return { error: `${sourceLabel(r.source)} has ${r.day} twice. Choose one file per system per day.` };
    seen.add(key);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("daily_sales").upsert(
    rows.map((r) => ({
      source: r.source,
      day: r.day,
      units: Math.round(r.units),
      amount: Math.round(r.amount * 100) / 100,
      imported_at: new Date().toISOString(),
    })),
    { onConflict: "organization_id,source,day" },
  );
  if (error) {
    if (/daily_sales/.test(error.message) && /exist|schema cache/.test(error.message)) {
      return { error: "The database needs updating (run 19_daily_sales.sql in Supabase)." };
    }
    return { error: `Could not save the daily sales: ${error.message}` };
  }
  revalidatePath("/sales");
  revalidatePath("/");
  return { saved: rows.length, total: Math.round(rows.reduce((t, r) => t + r.amount, 0) * 100) / 100 };
}

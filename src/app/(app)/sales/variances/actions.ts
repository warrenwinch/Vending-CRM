"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole, OFFICE_ROLES } from "@/lib/auth";
import { todayInSydney } from "@/lib/au";
import { MAX_VARIANCE_ROWS, type ParsedVariances } from "@/lib/variance-import";

const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

// Saves one driver's report for one date. Importing it again replaces that run.
export async function importVariances(date: string, driver: string, { rows, machines }: ParsedVariances): Promise<{ saved?: number; error?: string }> {
  await requireRole(OFFICE_ROLES);
  const name = driver.trim();
  if (!validDate(date)) return { error: "Please choose the date of the run." };
  if (date > todayInSydney()) return { error: "The date of the run can't be in the future." };
  if (name.length < 2 || name.length > 100) return { error: "Please choose the driver." };
  if ((rows.length === 0 && machines.length === 0) || rows.length > MAX_VARIANCE_ROWS || machines.length > MAX_VARIANCE_ROWS) {
    return { error: "This report has too many rows, or none. Please check the file." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_stock_variances", { p_date: date, p_driver: name, p_rows: rows, p_machines: machines });
  if (error) return { error: `Could not save: ${error.message}` };
  revalidatePath("/sales/variances");
  return { saved: data as number };
}

// Removes one run, for a report imported under the wrong driver or date.
export async function deleteVarianceRun(date: string, driver: string) {
  await requireRole(OFFICE_ROLES);
  if (!validDate(date)) return;
  const supabase = await createClient();
  await supabase.rpc("import_stock_variances", { p_date: date, p_driver: driver, p_rows: [], p_machines: [] });
  revalidatePath("/sales/variances");
}

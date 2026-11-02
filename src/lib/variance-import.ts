// Reading the Coils tab of Seed's Cash Ticket Details export: which machines
// the driver filled, and each coil they counted. Works on the rows readXlsx gives back.

export type VarianceRow = {
  external_id: string;
  coil: string | null;
  item_code: string | null;
  item_name: string | null;
  observed: number;
  variance: number;
};

export type FilledMachine = { external_id: string; units_filled: number };

export type ParsedVariances = { rows: VarianceRow[]; machines: FilledMachine[] };

export type VarianceTotals = { short: number; over: number; net: number };

export const MAX_VARIANCE_ROWS = 5000;

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
const REQUIRED = ["assetid", "coil", "fill", "observed", "variance"];

// Short and over are kept apart, so an extra can on one coil can't hide a missing one on another.
export function varianceTotals(rows: { variance: number }[]): VarianceTotals {
  const short = rows.reduce((t, r) => t + Math.max(-r.variance, 0), 0);
  const over = rows.reduce((t, r) => t + Math.max(r.variance, 0), 0);
  return { short, over, net: over - short };
}

// A machine counts as filled if any coil had stock added. Coils nobody counted
// have no Observed figure, so they have no variance to report.
export function parseVarianceFile(table: string[][]): ParsedVariances {
  const headerAt = table.slice(0, 10).findIndex((row) => {
    const heads = row.map(norm);
    return REQUIRED.every((h) => heads.includes(h));
  });
  if (headerAt < 0) {
    throw new Error("This isn't Seed's Cash Ticket Details report. It needs a Coils tab with Asset ID, Coil, Fill, Observed and Variance.");
  }
  const heads = table[headerAt].map(norm);
  const cell = (row: string[], h: string) => {
    const at = heads.indexOf(h);
    return at >= 0 ? (row[at] ?? "").trim() : "";
  };

  const rows: VarianceRow[] = [];
  const filled = new Map<string, number>();
  for (const [i, row] of table.slice(headerAt + 1).entries()) {
    const id = cell(row, "assetid").slice(0, 200);
    if (!id) continue;
    const fill = Number(cell(row, "fill") || 0);
    if (!Number.isInteger(fill)) throw new Error(`Row ${headerAt + i + 2} (${id}) has a Fill figure the CRM can't read.`);
    if (fill > 0) filled.set(id, (filled.get(id) ?? 0) + fill);

    const observedText = cell(row, "observed");
    const varianceText = cell(row, "variance");
    if (observedText === "" || varianceText === "") continue;
    const observed = Number(observedText);
    const variance = Number(varianceText);
    if (!Number.isInteger(observed) || !Number.isInteger(variance)) {
      throw new Error(`Row ${headerAt + i + 2} (${id}) has a count the CRM can't read.`);
    }
    rows.push({
      external_id: id,
      coil: cell(row, "coil").slice(0, 50) || null,
      item_code: cell(row, "itemcode").slice(0, 100) || null,
      item_name: cell(row, "itemname").slice(0, 300) || null,
      observed,
      variance,
    });
  }
  const machines = [...filled].map(([external_id, units_filled]) => ({ external_id, units_filled }));
  if (rows.length === 0 && machines.length === 0) throw new Error("This report has no machines filled and no coils counted.");
  return { rows, machines };
}

// The Monday fault summary: what broke last week, what got fixed, how long
// fixes took, and which machines keep breaking. It reads only through the
// normal security rules, with whoever's login it is given.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, type EmailResult } from "@/lib/alerts";
import { categoryLabel, formatDuration, type FaultCategory } from "@/lib/fault-types";
import { formatDate } from "@/lib/au";
import { SITE_URL } from "@/lib/qr";

const DAY = 24 * 60 * 60 * 1000;

type Row = {
  machine_id: string;
  category: FaultCategory;
  severity: "not_working" | "partly_working";
  reported_at: string;
  fixed_at: string | null;
  reported_by_public: boolean;
  machines: { machine_number: string } | null;
  locations: { site_name: string } | null;
};

const sydneyDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(d);

export async function buildWeeklySummary(supabase: SupabaseClient, now = new Date()) {
  const since = new Date(now.getTime() - 7 * DAY);
  const sinceIso = since.toISOString();

  // Everything still open, plus anything reported or fixed in the last 7 days.
  const { data, error } = await supabase
    .from("machine_faults")
    .select(
      "machine_id, category, severity, reported_at, fixed_at, reported_by_public, machines(machine_number), locations(site_name)",
    )
    .or(`fixed_at.is.null,reported_at.gte.${sinceIso},fixed_at.gte.${sinceIso}`)
    .limit(2000);
  if (error) throw new Error(`Could not read faults: ${error.message}`);
  const faults = (data ?? []) as unknown as Row[];

  const opened = faults.filter((f) => f.reported_at >= sinceIso);
  const fixed = faults.filter((f) => f.fixed_at && f.fixed_at >= sinceIso);
  const open = faults.filter((f) => !f.fixed_at);
  const durations = fixed.map((f) => new Date(f.fixed_at!).getTime() - new Date(f.reported_at).getTime());
  const average = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const longest = durations.length ? Math.max(...durations) : null;
  const oldestOpen = open.reduce<Row | null>((o, f) => (!o || f.reported_at < o.reported_at ? f : o), null);

  const label = (f: Row) => [f.machines?.machine_number, f.locations?.site_name].filter(Boolean).join(" at ");

  // Machines with the most faults reported this week.
  const perMachine = new Map<string, { row: Row; n: number }>();
  for (const f of opened) {
    const e = perMachine.get(f.machine_id);
    perMachine.set(f.machine_id, { row: f, n: (e?.n ?? 0) + 1 });
  }
  const worst = [...perMachine.values()].filter((m) => m.n > 1).sort((a, b) => b.n - a.n).slice(0, 5);

  const perCategory = new Map<FaultCategory, number>();
  for (const f of opened) perCategory.set(f.category, (perCategory.get(f.category) ?? 0) + 1);
  const topCategories = [...perCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  const period = `${formatDate(sydneyDay(since))} – ${formatDate(sydneyDay(now))}`;
  const lines: [string, string][] = [
    ["Week", period],
    [
      "Reported",
      `${opened.length} fault${opened.length === 1 ? "" : "s"}` +
        (opened.some((f) => f.reported_by_public)
          ? ` (${opened.filter((f) => f.reported_by_public).length} by customers)`
          : ""),
    ],
    ["Fixed", `${fixed.length}`],
    ["Average time to fix", average === null ? "No fixes this week" : formatDuration(average)],
    ["Longest fix", longest === null ? "–" : formatDuration(longest)],
    [
      "Still open",
      open.length
        ? `${open.length}, ${open.filter((f) => f.severity === "not_working").length} not working at all`
        : "None",
    ],
  ];
  if (oldestOpen) {
    lines.push([
      "Waiting longest",
      `${label(oldestOpen)}: ${categoryLabel(oldestOpen.category)}, open ${formatDuration(now.getTime() - new Date(oldestOpen.reported_at).getTime())}`,
    ]);
  }
  if (topCategories.length) {
    lines.push(["Most common", topCategories.map(([c, n]) => `${categoryLabel(c)} (${n})`).join("\n")]);
  }
  if (worst.length) {
    lines.push(["Repeat problems", worst.map((m) => `${label(m.row)}: ${m.n} faults`).join("\n")]);
  }

  return {
    subject: `Weekly faults: ${opened.length} reported, ${fixed.length} fixed, ${open.length} still open`,
    lines,
  };
}

export async function sendWeeklySummary(supabase: SupabaseClient): Promise<EmailResult> {
  const { subject, lines } = await buildWeeklySummary(supabase);
  // A blank SUMMARY_EMAIL counts as not set: use the alert addresses instead.
  const to = (process.env.SUMMARY_EMAIL?.trim() || process.env.ALERT_EMAIL || "").split(",");
  return sendEmail({ to, subject, lines, button: { label: "Open Faults", href: `${SITE_URL}/faults` } });
}

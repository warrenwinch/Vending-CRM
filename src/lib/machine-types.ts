// Machine shapes and labels, safe to use in browser code and on the server.
import type { Role } from "@/lib/auth-types";

export type MachineType = "snack" | "drink" | "combo" | "coffee" | "micro_market" | "other";
export type MachineStatus = "in_storage" | "installed" | "needs_repair" | "retired";

export type Machine = {
  id: string;
  machine_number: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  type: MachineType;
  payment_hardware: string | null;
  status: MachineStatus;
  purchase_date: string | null; // YYYY-MM-DD
  purchase_cost: number | null;
  public_token: string; // the secret in its QR sticker's link
};

export const MACHINE_TYPES: { value: MachineType; label: string }[] = [
  { value: "snack", label: "Snack" },
  { value: "drink", label: "Drink" },
  { value: "combo", label: "Combo" },
  { value: "coffee", label: "Coffee" },
  { value: "micro_market", label: "Micro market" },
  { value: "other", label: "Other" },
];

export const MACHINE_STATUSES: { value: MachineStatus; label: string }[] = [
  { value: "in_storage", label: "In storage" },
  { value: "installed", label: "Installed" },
  { value: "needs_repair", label: "Needs repair" },
  { value: "retired", label: "Retired" },
];

export const isMachineType = (v: unknown): v is MachineType => MACHINE_TYPES.some((t) => t.value === v);
export const isMachineStatus = (v: unknown): v is MachineStatus => MACHINE_STATUSES.some((s) => s.value === v);

// Who may add and change machines (the database enforces the same list).
export const MACHINE_EDIT_ROLES: Role[] = ["administrator", "manager", "warehouse"];

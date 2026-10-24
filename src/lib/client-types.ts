// Client shapes and labels, safe to use in browser code and on the server.
import type { CommissionType } from "@/lib/location-types";

export type ClientStatus = "prospect" | "active" | "lost";

export type Client = {
  id: string;
  company_name: string;
  abn: string | null;
  billing_contact: string | null;
  billing_email: string | null;
  billing_phone: string | null;
  gst_registered: boolean;
  status: ClientStatus;
  // Default commission for the client's sites (Administrators and Managers only).
  commission_type: CommissionType;
  commission_rate: number | null;
  archived_at: string | null; // set when archived: hidden from lists, nothing deleted
};

export const CLIENT_STATUSES: { value: ClientStatus; label: string }[] = [
  { value: "prospect", label: "Prospect" },
  { value: "active", label: "Active" },
  { value: "lost", label: "Lost" },
];

export function isClientStatus(value: unknown): value is ClientStatus {
  return CLIENT_STATUSES.some((s) => s.value === value);
}

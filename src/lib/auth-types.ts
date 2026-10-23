// Roles, safe to use in browser code and on the server.
export type Role = "administrator" | "manager" | "warehouse" | "filler";

export const ROLES: { value: Role; label: string; description: string }[] = [
  { value: "administrator", label: "Administrator", description: "Everything, including the team and business settings" },
  { value: "manager", label: "Manager", description: "Clients, locations, machines and commission" },
  { value: "warehouse", label: "Warehouse", description: "Machines and where they are; sees sites but not clients" },
  { value: "filler", label: "Filler", description: "Sees sites and machines to restock; can't change them" },
];

export const isRole = (v: unknown): v is Role => ROLES.some((r) => r.value === v);

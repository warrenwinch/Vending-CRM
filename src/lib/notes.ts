// Reading notes. Security rules: Administrators and Managers see every
// note; Warehouse and Filler see notes on locations and machines only.
import "server-only";
import { createClient } from "@/lib/supabase/server";

// What a note is attached to: exactly one client, location or machine.
export type NoteTarget = { kind: "client" | "location" | "machine"; id: string };

export type Note = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author_name: string;
};

export const targetColumn = (kind: NoteTarget["kind"]) => `${kind}_id` as const;

export const targetPath = ({ kind, id }: NoteTarget) =>
  kind === "client" ? `/clients/${id}` : kind === "location" ? `/locations/${id}` : `/machines/${id}`;

// Newest first.
export async function listNotes(target: NoteTarget) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select("id, body, created_at, author_id, profiles(full_name)")
    .eq(targetColumn(target.kind), target.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load notes: ${error.message}`);
  return (data as unknown as (Omit<Note, "author_name"> & { profiles: { full_name: string } | null })[]).map(
    ({ profiles, ...n }) => ({ ...n, author_name: profiles?.full_name ?? "Former team member" }),
  );
}

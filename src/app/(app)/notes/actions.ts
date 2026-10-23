"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireRole, OFFICE_ROLES } from "@/lib/auth";
import { targetColumn, targetPath, type NoteTarget } from "@/lib/notes";
import { isUuid } from "@/lib/ids";
import type { FormState } from "@/components/form-ui";

const KINDS = ["client", "location", "machine"];
const MAX_LENGTH = 2000;

export async function addNote(target: NoteTarget, _prev: FormState, formData: FormData): Promise<FormState> {
  const { profile } = await requireProfile();

  const body = String(formData.get("body") ?? "").trim();
  if (!KINDS.includes(target.kind) || !isUuid(target.id)) return { error: "Couldn't tell what this note is for." };
  if (!body) return { error: "Please type a note first." };
  if (body.length > MAX_LENGTH) return { error: `Please keep notes under ${MAX_LENGTH} characters.`, values: { body } };
  // Client notes are for the office (the database enforces this too).
  if (target.kind === "client" && !OFFICE_ROLES.includes(profile.role)) return { error: "You can't add notes to clients." };

  const supabase = await createClient();
  const { error } = await supabase.from("notes").insert({ [targetColumn(target.kind)]: target.id, body });
  if (error) return { error: `Could not save the note: ${error.message}`, values: { body } };

  revalidatePath(targetPath(target));
  return { message: "Note added." };
}

// Administrators and Managers can remove notes (for example, ones added by mistake).
export async function deleteNote(noteId: string, target: NoteTarget) {
  await requireRole(OFFICE_ROLES);
  if (!isUuid(noteId)) return;
  const supabase = await createClient();
  await supabase.from("notes").delete().eq("id", noteId);
  revalidatePath(targetPath(target));
}

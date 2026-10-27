"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile, requireRole, OFFICE_ROLES } from "@/lib/auth";
import { isUuid } from "@/lib/ids";
import { isTagColour, tidyTagName } from "@/lib/tag-types";
import type { FormState } from "@/components/form-ui";

// Puts a tag on a machine, creating the tag first if it's new. Anyone can.
export async function addTag(machineId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireProfile();
  const name = tidyTagName(String(formData.get("name") ?? ""));
  const values = { name };
  if (!isUuid(machineId)) return { error: "This machine wasn't found.", values };
  if (!name) return { error: "Type a tag, or pick one from the list.", values };
  if (name.length > 40) return { error: "Please keep tags under 40 characters.", values };

  const supabase = await createClient();
  // An existing tag with the same name (any capitals) is reused.
  const { data: existing, error: findError } = await supabase
    .from("tags")
    .select("id")
    .ilike("name", name.replace(/[%_\\]/g, (c) => `\\${c}`))
    .maybeSingle();
  if (findError) return { error: `Could not add the tag: ${findError.message}`, values };
  let tagId = existing?.id as string | undefined;
  if (!tagId) {
    const { data: created, error } = await supabase.from("tags").insert({ name }).select("id").single();
    if (error) return { error: `Could not create the tag: ${error.message}`, values };
    tagId = created.id as string;
  }

  const { error } = await supabase.from("machine_tags").insert({ machine_id: machineId, tag_id: tagId });
  // Already on this machine: nothing to do.
  if (error && error.code !== "23505") return { error: `Could not add the tag: ${error.message}`, values };

  revalidatePath(`/machines/${machineId}`);
  return { message: "", values: { name: "" } };
}

export async function removeTag(machineId: string, tagId: string) {
  await requireProfile();
  if (!isUuid(machineId) || !isUuid(tagId)) return;
  const supabase = await createClient();
  await supabase.from("machine_tags").delete().eq("machine_id", machineId).eq("tag_id", tagId);
  revalidatePath(`/machines/${machineId}`);
}

// Creates a tag without putting it on a machine yet. Anyone can.
export async function createTag(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireProfile();
  const values = { name: tidyTagName(String(formData.get("name") ?? "")), colour: String(formData.get("colour") ?? "grey") };
  if (!values.name) return { error: "Please enter a name.", values };
  if (values.name.length > 40) return { error: "Please keep tags under 40 characters.", values };
  if (!isTagColour(values.colour)) return { error: "Please choose a colour.", values };

  const supabase = await createClient();
  const { error } = await supabase.from("tags").insert(values);
  if (error) {
    if (error.code === "23505") return { error: `There's already a tag called “${values.name}”.`, values };
    return { error: `Could not create the tag: ${error.message}`, values };
  }
  revalidatePath("/machines/tags");
  return { message: `Added “${values.name}”.`, values: { name: "", colour: values.colour } };
}

// Renaming and recolouring (office only).
export async function updateTag(tagId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(OFFICE_ROLES);
  const values = { name: tidyTagName(String(formData.get("name") ?? "")), colour: String(formData.get("colour") ?? "") };
  if (!isUuid(tagId)) return { error: "This tag wasn't found.", values };
  if (!values.name) return { error: "Please enter a name.", values };
  if (values.name.length > 40) return { error: "Please keep tags under 40 characters.", values };
  if (!isTagColour(values.colour)) return { error: "Please choose a colour.", values };

  const supabase = await createClient();
  const { error } = await supabase.from("tags").update(values).eq("id", tagId);
  if (error) {
    if (error.code === "23505") return { error: `There's already a tag called “${values.name}”.`, values };
    return { error: `Could not save: ${error.message}`, values };
  }
  revalidatePath("/machines/tags");
  return { message: "Saved.", values };
}

// Deletes a tag and takes it off every machine (office only).
export async function deleteTag(tagId: string) {
  await requireRole(OFFICE_ROLES);
  if (!isUuid(tagId)) return;
  const supabase = await createClient();
  await supabase.from("tags").delete().eq("id", tagId);
  redirect("/machines/tags");
}

// Reading tags. Everyone in the business can see them.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tag } from "@/lib/tag-types";

// Every tag, A to Z, with how many machines have it.
export async function listTags(): Promise<(Tag & { machines: number })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tags").select("id, name, colour, machine_tags(count)").order("name");
  if (error) throw new Error(`Could not load tags: ${error.message}`);
  type Row = Tag & { machine_tags: { count: number }[] };
  return (data as unknown as Row[]).map(({ machine_tags, ...t }) => ({ ...t, machines: machine_tags[0]?.count ?? 0 }));
}

export async function listMachineTags(machineId: string): Promise<Tag[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("machine_tags").select("tags(id, name, colour)").eq("machine_id", machineId);
  if (error) throw new Error(`Could not load this machine's tags: ${error.message}`);
  return (data as unknown as { tags: Tag | null }[])
    .map((r) => r.tags)
    .filter((t): t is Tag => Boolean(t))
    .sort((a, b) => a.name.localeCompare(b.name));
}

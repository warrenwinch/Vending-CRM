// The "Notes" log shown on client, location and machine pages.
import { listNotes, type NoteTarget } from "@/lib/notes";
import { formatDate } from "@/lib/au";
import { DeleteNoteButton, NoteForm } from "./note-form";

// "23/10/2026 2:15 pm" in Sydney time.
function when(timestamp: string) {
  const d = new Date(timestamp);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(d);
  const time = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  return `${formatDate(date)} ${time}`;
}

export async function NotesSection({ target, canDelete }: { target: NoteTarget; canDelete: boolean }) {
  const notes = await listNotes(target);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="section-title">Notes</h2>
      <NoteForm target={target} />
      {notes.length > 0 && (
        <ol className="divide-y divide-zinc-200 rounded-2xl border-2 border-zinc-200 bg-white">
          {notes.map((n) => (
            <li key={n.id} className="flex flex-col gap-1 p-4">
              <div className="flex items-center justify-between gap-4 text-xs text-zinc-500">
                <span>
                  <span className="font-medium text-zinc-700">{n.author_name}</span> · {when(n.created_at)}
                </span>
                {canDelete && <DeleteNoteButton noteId={n.id} target={target} />}
              </div>
              <p className="whitespace-pre-line break-words text-sm">{n.body}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

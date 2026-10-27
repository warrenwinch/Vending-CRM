// Tags: short labels the business makes up for its machines, e.g. "Cashless".
export type TagColour = "grey" | "orange" | "green" | "blue" | "red" | "purple" | "yellow";

export type Tag = { id: string; name: string; colour: TagColour };

export const TAG_COLOURS: { value: TagColour; label: string; chip: string }[] = [
  { value: "grey", label: "Grey", chip: "bg-zinc-200 text-zinc-800" },
  { value: "orange", label: "Orange", chip: "bg-brand-soft text-brand-deep" },
  { value: "green", label: "Green", chip: "bg-leaf-soft text-leaf-deep" },
  { value: "blue", label: "Blue", chip: "bg-sky-100 text-sky-900" },
  { value: "red", label: "Red", chip: "bg-red-100 text-red-900" },
  { value: "purple", label: "Purple", chip: "bg-violet-100 text-violet-900" },
  { value: "yellow", label: "Yellow", chip: "bg-amber-100 text-amber-900" },
];

export const isTagColour = (v: unknown): v is TagColour => TAG_COLOURS.some((c) => c.value === v);

export const tagChipClass = (colour: TagColour) =>
  TAG_COLOURS.find((c) => c.value === colour)?.chip ?? TAG_COLOURS[0].chip;

// Tags are kept tidy: single spaces, at most 40 characters.
export const tidyTagName = (name: string) => name.trim().replace(/\s+/g, " ");

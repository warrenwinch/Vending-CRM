// Small helpers shared by the CSV imports.

// "Purchase Date" -> "purchase_date"
export function normaliseHeader(header: string) {
  return header.replace(/^﻿/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const squash = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "");

// Accepts the stored value or the label people see: "micro_market", "Micro market".
export function matchOption<T extends string>(list: { value: T; label: string }[], text: string) {
  const key = squash(text);
  return list.find((o) => squash(o.value) === key || squash(o.label) === key)?.value;
}

// Reads the first sheet of an Excel (.xlsx) file into rows of text.
// Small on purpose: the Seed and Nayax exports are plain tables, so this
// only needs cell text and numbers (no formulas, dates or formatting).
import { strFromU8, unzipSync } from "fflate";

const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

// All the <t> text inside a piece of XML (tags may carry a prefix, e.g. <x:t>).
const texts = (xml: string) =>
  [...xml.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((m) => decode(m[1])).join("");

// "C12" -> 2 (columns counted from 0).
function columnIndex(ref: string) {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "";
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

export function readXlsx(data: Uint8Array): string[][] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    throw new Error("This doesn't look like an Excel file. Please choose the .xlsx file you exported.");
  }
  const sheetName = Object.keys(files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]))[0];
  if (!sheetName) throw new Error("This Excel file has no sheet in it.");

  const shared = files["xl/sharedStrings.xml"]
    ? [...strFromU8(files["xl/sharedStrings.xml"]).matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)].map((m) => texts(m[1]))
    : [];

  const sheet = strFromU8(files[sheetName]);
  const rows: string[][] = [];
  for (const rowMatch of sheet.matchAll(/<(?:\w+:)?row\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g)) {
    const row: string[] = [];
    let next = 0;
    for (const cell of (rowMatch[1] ?? "").matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const attrs = cell[1];
      const inner = cell[2] ?? "";
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /\bt="(\w+)"/.exec(attrs)?.[1];
      const col = ref ? columnIndex(ref) : next;
      const raw = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner)?.[1];
      let value = "";
      if (type === "inlineStr") value = texts(inner);
      else if (type === "s") value = shared[Number(raw)] ?? "";
      else if (raw !== undefined) value = decode(raw);
      row[col] = value.trim();
      next = col + 1;
    }
    rows.push(Array.from(row, (v) => v ?? ""));
  }
  return rows;
}

import {
  Archive,
  Book,
  BookOpen,
  Check,
  Circle,
  CircleCheck,
  Headphones,
  Heart,
  Layers,
  MapPin,
  Redo2,
  Repeat,
  Tablet,
  Tag,
} from "lucide-react";

export const STATUSES = [
  { value: "wishlist", label: "Wunschliste", icon: Heart },
  { value: "to_read", label: "Zu Lesen", icon: Redo2 },
  { value: "reading", label: "Lesen", icon: BookOpen },
  { value: "finished", label: "Fertiggestellt", icon: Check },
  { value: "abandoned", label: "Abgebrochen", icon: Archive },
];
// Status, die zur Bibliothek gehören (Wunschliste ist getrennt)
export const LIBRARY_STATUSES = STATUSES.filter((s) => s.value !== "wishlist");

// Reihenfolge überall: Buch, eBook, Hörbuch
export const FORMATS = [
  { value: "book", label: "Buch", icon: Book },
  { value: "ebook", label: "eBook", icon: Tablet },
  { value: "audiobook", label: "Hörbuch", icon: Headphones },
];

export const OWNERSHIP = [
  { value: "owned", label: "Im Besitz", icon: CircleCheck },
  { value: "borrowed", label: "Ausgeliehen", icon: Repeat },
  { value: "not_owned", label: "Nicht im Besitz", icon: Circle },
];

export const READ_FILTERS = [
  { value: "read", label: "Gelesen", icon: Check },
  { value: "unread", label: "Noch nicht gelesen", icon: Redo2 },
];

export const digits = (v) => String(v ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
export const decimal = (v) => String(v ?? "").replace(",", ".").replace(/[^\d.]/g, "").replace(/^0+(?=\d)/, "");

export const deriveSeries = (title = "") => {
  const dash = title.match(/^(.+?)\s[-–:]\s(.+)$/);
  if (dash) return dash[1].trim();
  const paren = title.match(/\(([^)]+)\)/);
  if (paren) return paren[1].replace(/\b(Band|Teil|Bd\.|Vol\.?)\s*\d+/i, "").trim();
  return null;
};

export const TAXONOMY = {
  collections: { label: "Sammlungen", singular: "Sammlung", icon: Tag, param: "collection" },
  categories: { label: "Genres", singular: "Genre", icon: Layers, param: "category" },
  series: { label: "Reihen", singular: "Reihe", icon: BookOpen, param: "series" },
  places: { label: "Orte", singular: "Ort", icon: MapPin, param: "place" },
};

export const SORT_OPTIONS = [
  { value: "added", label: "Zuletzt hinzugefügt" },
  { value: "title", label: "Titel" },
  { value: "author", label: "Autor" },
  { value: "rating", label: "Bewertung" },
  { value: "finished", label: "Zuletzt beendet" },
  { value: "series", label: "Reihe & Teil" },
];

export const byValue = (list, value) => list.find((x) => x.value === value);

export const formatPart = (part) => {
  if (part === null || part === undefined || part === "") return null;
  const n = Number(part);
  return `Teil ${Number.isInteger(n) ? n : part}`;
};

export const formatDate = (iso) => {
  if (!iso) return "–";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

export const formatDateShort = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${Number(d)}. ${MONTHS_SHORT[Number(m) - 1]}. ${y.slice(2)}`;
};

// 5025 → "1h 23m", 125 → "2m", 3600*10 → "10h"
export const formatDuration = (seconds = 0) => {
  const s = Math.max(0, Math.round(seconds));
  const totalMin = Math.round(s / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

export const formatClock = (seconds = 0) => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};

// Geschätzte Restzeit eines Buches
export const remainingSeconds = (book) => {
  if (!book) return 0;
  const total = book.estimated_seconds || 0;
  const pct = book.progress_percent || 0;
  return Math.max(0, Math.round(total * (1 - pct / 100)));
};

export const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const MONTHS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

// Statistik-Zeiträume
export const PERIODS = [
  { value: "month", label: "Letzter Monat", sub: "letzte 30 Tage" },
  { value: "quarter", label: "3 Monate", sub: "letzte 3 Monate" },
  { value: "year", label: "Letztes Jahr", sub: "letzte 12 Monate" },
  { value: "all", label: "Gesamt", sub: "insgesamt" },
];

// Filter-Chips in Listen: ein „Alle" + Gelesen/Ungelesen + Besitz
export const LIST_CHIPS = [
  { key: null, value: "", label: "Alle" },
  { key: "read", value: "read", label: "Gelesen" },
  { key: "read", value: "unread", label: "Ungelesen" },
  ...OWNERSHIP.map((o) => ({ key: "ownership", value: o.value, label: o.label })),
];

export const NO_SERIES = "__none__";

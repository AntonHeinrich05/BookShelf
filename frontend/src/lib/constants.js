import {
  Archive,
  Book,
  BookOpen,
  BookText,
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

export const FORMATS = [
  { value: "audiobook", label: "Hörbuch", icon: Headphones },
  { value: "ebook", label: "eBook", icon: Tablet },
  { value: "hardcover", label: "Hardcover", icon: Book },
  { value: "paperback", label: "Taschenbuch", icon: BookText },
];

export const OWNERSHIP = [
  { value: "borrowed", label: "Ausgeliehen", icon: Repeat },
  { value: "not_owned", label: "Nicht im Besitz", icon: Circle },
  { value: "owned", label: "Im Besitz", icon: CircleCheck },
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
  categories: { label: "Kategorien", singular: "Kategorie", icon: Layers, param: "category" },
  series: { label: "Serien", singular: "Serie", icon: BookOpen, param: "series" },
  places: { label: "Orte", singular: "Ort", icon: MapPin, param: "place" },
};

export const SORT_OPTIONS = [
  { value: "added", label: "Zuletzt hinzugefügt" },
  { value: "title", label: "Titel" },
  { value: "author", label: "Autor" },
  { value: "rating", label: "Bewertung" },
  { value: "finished", label: "Zuletzt beendet" },
  { value: "series", label: "Serie & Teil" },
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

export const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const MONTHS_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

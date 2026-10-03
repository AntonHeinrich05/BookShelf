import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { PillButton } from "@/components/ios/Form";
import { useOverview, useSaveBook } from "@/hooks/useBooks";
import { errorMessage } from "@/lib/api";
import { deriveSeries } from "@/lib/constants";
import { DetailsSection, FormatSection, NotesSection, OwnershipSection, RatingDatesSection, SeriesSection, StatusSection, TagsSection } from "./BookFormSections";

const DEFAULTS = {
  title: "", authors_text: "", cover_url: "", isbn: "", publisher: "", published_year: "", description: "", google_id: null, page_count: "", audio_minutes: "",
  status: "to_read", marked: false, format: "book", ownership: "owned", progress_type: "pages", current_page: 0, progress_percent: 0,
  rating: 0, start_date: "", end_date: "", series_name: "", series_part: "", places: [], categories: [], collections: [], notes: "", auto_genre_hint: null,
};

const clean = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== null && v !== undefined));
const numOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
const strOrNull = (v) => (v ? v : null);

const toPayload = (f) => ({
  title: f.title.trim(),
  authors: f.authors_text.split(",").map((a) => a.trim()).filter(Boolean),
  cover_url: strOrNull(f.cover_url), isbn: strOrNull(f.isbn), publisher: strOrNull(f.publisher), description: strOrNull(f.description),
  google_id: f.google_id || null, published_year: numOrNull(f.published_year), page_count: numOrNull(f.page_count), audio_minutes: numOrNull(f.audio_minutes),
  status: f.status, marked: f.marked, format: f.format || "book", ownership: f.ownership, progress_type: f.progress_type,
  current_page: Number(f.current_page) || 0, progress_percent: Number(f.progress_percent) || 0, rating: f.rating,
  start_date: strOrNull(f.start_date), end_date: strOrNull(f.end_date), series_name: strOrNull(f.series_name?.trim()),
  series_part: numOrNull(f.series_part), places: f.places, categories: f.categories, collections: f.collections, notes: strOrNull(f.notes),
  auto_genre_hint: f.auto_genre_hint || null,
});

export function BookForm({ open, onOpenChange, initial, bookId, onSaved }) {
  const [form, setForm] = useState(DEFAULTS);
  const { data: overview } = useOverview();
  const save = useSaveBook();

  useEffect(() => {
    if (!open) return;
    const init = clean(initial);
    setForm({ ...DEFAULTS, ...init, authors_text: (init.authors || []).join(", "), series_part: init.series_part ?? "", audio_minutes: init.audio_minutes ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key, value) =>
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Daten steuern den Status: Enddatum → fertig, Startdatum → lesen
      if (key === "end_date" && value) next.status = "finished";
      if (key === "start_date" && value && !next.end_date && ["wishlist", "to_read"].includes(next.status)) next.status = "reading";
      if (key === "ownership" && ["owned", "borrowed"].includes(value) && next.status === "wishlist") next.status = "to_read";
      if (key === "status" && value === "wishlist") next.ownership = "not_owned";
      return next;
    });
  const names = (kind) => overview?.[kind]?.map((x) => x.name) || [];

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Bitte einen Titel eingeben");
    try {
      const payload = toPayload(form);
      // Reihe automatisch übernehmen, wenn nichts gewählt wurde (aus dem Titel abgeleitet)
      if (!payload.series_name) {
        const derived = deriveSeries(payload.title);
        const known = derived && names("series").find((s) => s.toLowerCase() === derived.toLowerCase());
        if (known || (derived && payload.series_part != null)) payload.series_name = known || derived;
      }
      const book = await save.mutateAsync({ id: bookId, data: payload });
      toast.success(bookId ? "Buch aktualisiert" : book.status === "wishlist" ? "Zur Wunschliste hinzugefügt" : "Zur Bibliothek hinzugefügt");
      onOpenChange(false);
      onSaved?.(book);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="h-sheet border-line bg-canvas text-fg outline-none" data-testid="book-form">
        <DrawerTitle className="sr-only">Buch</DrawerTitle>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="relative flex items-center justify-center px-4 pb-2 pt-1">
            <button type="button" onClick={() => onOpenChange(false)} className="absolute left-4 grid h-10 w-10 place-items-center rounded-full bg-surface" aria-label="Schließen" data-testid="form-close">
              <X size={20} />
            </button>
            <h2 className="font-display text-lg font-semibold">{bookId ? "Buch bearbeiten" : "Buch hinzufügen"}</h2>
          </div>
          <div className="mx-auto w-full min-h-0 max-w-lg flex-1 overflow-y-auto overscroll-contain px-4 pb-6 md:max-w-2xl">
            <DetailsSection form={form} set={set} />
            <StatusSection form={form} set={set} />
            <FormatSection form={form} set={set} />
            <RatingDatesSection form={form} set={set} />
            <OwnershipSection form={form} set={set} />
            <SeriesSection form={form} set={set} suggestions={names("series")} />
            <TagsSection kind="categories" form={form} set={set} suggestions={names("categories")} hint={!bookId && form.categories.length === 0 ? "Leer lassen → Genre wird automatisch erkannt" : null} />
            <TagsSection kind="collections" form={form} set={set} suggestions={names("collections")} />
            <TagsSection kind="places" form={form} set={set} suggestions={names("places")} />
            <NotesSection form={form} set={set} />
          </div>
          <div className="mx-auto w-full max-w-lg border-t border-line bg-canvas px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:max-w-2xl">
            <PillButton type="submit" disabled={save.isPending} data-testid="form-submit">
              {save.isPending ? "Speichern…" : bookId ? "Speichern" : form.status === "wishlist" ? "Zur Wunschliste hinzufügen" : "Zur Bibliothek hinzufügen"}
            </PillButton>
          </div>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useSaveBook } from "@/hooks/useBooks";
import { errorMessage } from "@/lib/api";
import { formatDateShort } from "@/lib/constants";
import { ProgressRing } from "./ProgressRing";
import { Stars } from "./Bits";

const today = () => new Date().toISOString().slice(0, 10);

function DateField({ label, value, onChange, testId }) {
  const ref = useRef(null);
  return (
    <button type="button" onClick={() => (ref.current?.showPicker ? ref.current.showPicker() : ref.current?.click())} className="relative flex flex-1 flex-col items-center gap-1 py-2 text-center" data-testid={testId}>
      <span className="text-sm text-fg2">{label}</span>
      <span className="font-display text-lg font-bold leading-tight">{formatDateShort(value) || "Datum hinzufügen"}</span>
      <input ref={ref} type="date" value={value || ""} onChange={(e) => onChange(e.target.value || null)} className="pointer-events-none absolute inset-0 opacity-0" tabIndex={-1} />
    </button>
  );
}

/**
 * Sheet „Lesen #n" – erscheint beim Fertigstellen: Seiten per Kreis einstellen,
 * Start-/Enddatum anpassen, bewerten. Speichert Status = fertig.
 */
export function FinishSheet({ book, open, onOpenChange, onDeleteLog }) {
  const save = useSaveBook();
  const max = book?.page_count || 100;
  const [pages, setPages] = useState(0);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [rating, setRating] = useState(0);

  useEffect(() => {
    if (!open || !book) return;
    setPages(book.page_count ? book.page_count : 100);
    setStart(book.start_date || null);
    setEnd(book.end_date || today());
    setRating(book.rating || 0);
  }, [open, book]);

  const submit = async () => {
    const done = pages >= max;
    try {
      await save.mutateAsync({
        id: book.id,
        data: {
          status: done ? "finished" : "reading",
          rating,
          start_date: start,
          end_date: done ? end || today() : null,
          ...(book.page_count ? { current_page: pages, progress_type: "pages" } : { progress_percent: pages, progress_type: "percent" }),
        },
      });
      toast.success(done ? "Fertig gelesen – stark!" : "Fortschritt gespeichert");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (!book) return null;
  const unit = book.page_count ? "Seiten" : "%";
  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="h-sheet border-line bg-canvas text-fg outline-none" data-testid="finish-sheet">
        <DrawerTitle className="sr-only">Lesen</DrawerTitle>
        <div className="relative flex items-center justify-center px-4 pb-2 pt-1">
          <button type="button" onClick={() => onOpenChange(false)} className="absolute left-4 grid h-11 w-11 place-items-center rounded-full bg-surface" aria-label="Schließen" data-testid="finish-close"><X size={22} /></button>
          <h2 className="font-display text-lg font-semibold">Lesen #{book.status === "finished" ? Math.max(1, book.read_count || 1) : (book.read_count || 0) + 1}</h2>
          <button type="button" onClick={submit} disabled={save.isPending} className="absolute right-4 grid h-11 w-11 place-items-center rounded-full bg-fg text-canvas disabled:opacity-50" aria-label="Speichern" data-testid="finish-save"><Check size={22} strokeWidth={2.5} /></button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="my-6">
            <ProgressRing value={pages} max={max} size={Math.min(300, window.innerWidth - 80)} onChange={setPages} testId="finish-ring">
              <span className="font-display text-7xl font-extrabold tabular-nums leading-none" data-testid="finish-pages">{pages}</span>
              <span className="mt-2 text-base text-fg2">von {max} {unit} gelesen</span>
            </ProgressRing>
          </div>
          <div className="w-full max-w-md rounded-2xl bg-surface">
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <DateField label="Gestartet" value={start} onChange={setStart} testId="finish-start" />
              <ArrowRight size={20} className="shrink-0 text-fg2" />
              <DateField label="Beendet" value={end} onChange={setEnd} testId="finish-end" />
            </div>
            <div className="flex justify-center py-4">
              <Stars value={rating} onChange={setRating} size={38} className="gap-2" testId="finish-rating" />
            </div>
          </div>
          {onDeleteLog && book.status === "finished" && (
            <button type="button" onClick={onDeleteLog} className="mt-8 flex w-full max-w-md items-center justify-center gap-2 rounded-full bg-surface py-3.5 font-semibold text-red-400" data-testid="finish-delete-log">
              <Trash2 size={18} /> Leseprotokoll löschen
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Pencil, Play, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useBook, useDeleteBook, useDeleteSession, useSaveBook, useSessions } from "@/hooks/useBooks";
import { useReadingTimer } from "@/context/ReadingTimerContext";
import { errorMessage } from "@/lib/api";
import { IconButton, PageHeader } from "@/components/layout/PageHeader";
import { Splash } from "@/components/layout/Splash";
import { EmptyState } from "@/components/books/BookCard";
import { BookForm } from "@/components/books/BookForm";
import { FinishSheet } from "@/components/books/FinishSheet";
import { FormGroup, SectionLabel } from "@/components/ios/Form";
import { BookHero, DatesGroup, DetailsGroup, ReadingCard, StatusPicker, TagGroups } from "@/components/books/BookDetailSections";
import { cn } from "@/lib/utils";

export default function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: book, isLoading } = useBook(id);
  const { data: sessions = [] } = useSessions(id);
  const save = useSaveBook();
  const remove = useDeleteBook();
  const deleteSession = useDeleteSession();
  const { start } = useReadingTimer();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [finish, setFinish] = useState(false);
  const [showDesc, setShowDesc] = useState(false);

  // Nach „fertig gelesen" im Timer: Leseprotokoll (Bewertung, Daten) automatisch öffnen
  useEffect(() => {
    if (book && location.state?.openFinish) {
      setFinish(true);
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id, location.state?.openFinish]);

  const patch = (data) => save.mutateAsync({ id, data }).then(updated => {
    if (book.status === "wishlist" && data.ownership && updated.status === "to_read") toast.success("Zu Lesen verschoben");
    return updated;
  }).catch((err) => toast.error(errorMessage(err)));

  const onDelete = async () => {
    try {
      await remove.mutateAsync(id);
      toast.success("Buch gelöscht");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const startReading = () => {
    start(book);
    navigate(`/books/${id}/read`);
  };

  // Status „Fertiggestellt" → Lese-Sheet (Seiten, Datum, Bewertung) statt stumm speichern
  const changeStatus = (status) => (status === "finished" ? setFinish(true) : patch({ status }));

  if (isLoading) return <Splash />;
  if (!book) return <EmptyState text="Buch nicht gefunden." />;
  const showProgress = book.status !== "wishlist";

  return (
    <div data-testid="book-detail-page">
      <PageHeader
        back
        title=""
        large={false}
        right={
          <>
            <IconButton onClick={() => patch({ marked: !book.marked })} aria-label="Markieren" data-testid="toggle-marked">
              <Star size={18} className={cn(book.marked && "fill-amber-400 text-amber-400")} />
            </IconButton>
            <IconButton onClick={() => setEdit(true)} aria-label="Bearbeiten" data-testid="edit-book-button"><Pencil size={17} /></IconButton>
            <IconButton onClick={() => setConfirm(true)} aria-label="Löschen" className="text-red-400" data-testid="delete-book-button"><Trash2 size={17} /></IconButton>
          </>
        }
      />

      <BookHero book={book} onPatch={patch} />
      <StatusPicker value={book.status} onChange={changeStatus} />
      {showProgress && (book.page_count > 0 || book.status !== "to_read" || sessions.length > 0) ? (
        <ReadingCard
          key={book.updated_at}
          book={book}
          sessions={sessions}
          onPatch={patch}
          onFinish={() => setFinish(true)}
          onStartReading={startReading}
          onDeleteSession={(sessionId) => deleteSession.mutateAsync({ bookId: id, sessionId }).catch((err) => toast.error(errorMessage(err)))}
        />
      ) : (
        showProgress && (
          <button type="button" onClick={startReading} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-fg py-3.5 font-semibold text-canvas" data-testid="start-reading">
            <Play size={18} className="fill-current" /> Lesen starten
          </button>
        )
      )}

      <div className="md:grid md:grid-cols-2 md:gap-x-6">
        <div>
          <DatesGroup book={book} onPatch={patch} />
          <DetailsGroup book={book} onPatch={patch} />
        </div>
        <div>
          <TagGroups book={book} />
          {book.notes && (
            <>
              <SectionLabel>Notizen</SectionLabel>
              <FormGroup><p className="whitespace-pre-wrap px-4 py-3 text-[15px] leading-relaxed">{book.notes}</p></FormGroup>
            </>
          )}
          {book.description && (
            <>
              <SectionLabel>Beschreibung</SectionLabel>
              <FormGroup>
                <div className="px-4 py-3">
                  <p className={cn("whitespace-pre-line text-[15px] leading-relaxed text-fg2", !showDesc && "line-clamp-5")} data-testid="book-description">{new DOMParser().parseFromString(book.description, "text/html").body.textContent}</p>
                  <button type="button" onClick={() => setShowDesc((s) => !s)} className="mt-2 text-sm font-medium text-tint" data-testid="toggle-description">{showDesc ? "Weniger" : "Mehr lesen"}</button>
                </div>
              </FormGroup>
            </>
          )}
        </div>
      </div>

      <BookForm open={edit} onOpenChange={setEdit} initial={book} bookId={id} />
      <FinishSheet
        book={book}
        open={finish}
        onOpenChange={setFinish}
        onDeleteLog={() => { setFinish(false); patch({ status: "to_read", start_date: null, end_date: null, current_page: 0, progress_percent: 0, rating: 0, read_count: 0 }); }}
      />

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="rounded-3xl border-line bg-surface text-fg" data-testid="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Buch löschen?</AlertDialogTitle>
            <AlertDialogDescription className="text-fg2">„{book.title}" wird dauerhaft aus deiner Bibliothek entfernt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full border-line bg-surface2" data-testid="delete-cancel">Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="rounded-full bg-red-500 text-white hover:bg-red-600" data-testid="delete-confirm">Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

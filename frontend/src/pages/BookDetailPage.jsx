import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useBook, useDeleteBook, useSaveBook } from "@/hooks/useBooks";
import { errorMessage } from "@/lib/api";
import { IconButton, PageHeader } from "@/components/layout/PageHeader";
import { Splash } from "@/components/layout/Splash";
import { EmptyState } from "@/components/books/BookCard";
import { BookForm } from "@/components/books/BookForm";
import { FormGroup, SectionLabel } from "@/components/ios/Form";
import { BookHero, DatesGroup, DetailsGroup, ProgressCard, StatusPicker, TagGroups } from "@/components/books/BookDetailSections";
import { cn } from "@/lib/utils";

export default function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: book, isLoading } = useBook(id);
  const save = useSaveBook();
  const remove = useDeleteBook();
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [showDesc, setShowDesc] = useState(false);

  const patch = (data) => save.mutateAsync({ id, data }).catch((err) => toast.error(errorMessage(err)));

  const onDelete = async () => {
    try {
      await remove.mutateAsync(id);
      toast.success("Buch gelöscht");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (isLoading) return <Splash />;
  if (!book) return <EmptyState text="Buch nicht gefunden." />;

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
      <StatusPicker value={book.status} onChange={(status) => patch({ status })} />
      {book.page_count > 0 && book.status !== "wishlist" && book.status !== "to_read" && <ProgressCard key={book.updated_at} book={book} onPatch={patch} />}

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
                  <p className={cn("text-[15px] leading-relaxed text-fg2", !showDesc && "line-clamp-5")} dangerouslySetInnerHTML={{ __html: book.description }} />
                  <button type="button" onClick={() => setShowDesc((s) => !s)} className="mt-2 text-sm font-medium text-tint" data-testid="toggle-description">{showDesc ? "Weniger" : "Mehr lesen"}</button>
                </div>
              </FormGroup>
            </>
          )}
        </div>
      </div>

      <BookForm open={edit} onOpenChange={setEdit} initial={book} bookId={id} />

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

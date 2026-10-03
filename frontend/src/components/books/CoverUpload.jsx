import { useRef } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUploadCover } from "@/hooks/useBooks";
import { errorMessage } from "@/lib/api";

export function CoverUpload({ book }) {
  const input = useRef(null);
  const upload = useUploadCover();
  const change = async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return toast.error("Bild ist zu groß (maximal 8 MB)");
    try {
      await upload.mutateAsync({ bookId: book.id, file });
      toast.success("Dein Cover wurde gespeichert");
    } catch (err) { toast.error(errorMessage(err, "Cover konnte nicht gespeichert werden")); }
  };
  return <>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={change} className="sr-only" aria-label="Eigenes Cover auswählen" data-testid="cover-upload-input" />
    <button type="button" onClick={() => input.current.click()} disabled={upload.isPending} className="mt-2 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full bg-surface px-2 text-xs font-medium transition-opacity disabled:opacity-50 active:opacity-70" data-testid="cover-upload-button">
      {upload.isPending ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}{upload.isPending ? "Speichert…" : "Cover ersetzen"}
    </button>
  </>;
}
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmptyRow, Group, Row } from "@/components/ios/Group";
import { SwipeRow } from "@/components/ios/SwipeRow";
import { PillButton } from "@/components/ios/Form";
import { Cover } from "@/components/books/Cover";
import { SeriesBadge } from "@/components/books/Bits";
import { formatDuration, remainingSeconds, TAXONOMY } from "@/lib/constants";
import { useAddTaxonomy, useDeleteTaxonomy, useRenameTaxonomy } from "@/hooks/useBooks";
import { useReadingTimer } from "@/context/ReadingTimerContext";
import { errorMessage } from "@/lib/api";

export function ReadingNow({ books }) {
  const navigate = useNavigate();
  const { start } = useReadingTimer();
  return (
    <section className="anim-in mb-8" data-testid="reading-now">
      <h2 className="mb-3 px-1 font-display text-xl font-bold tracking-tight md:text-2xl">Jetzt lesen</h2>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {books.map((b) => (
          <div key={b.id} className="relative flex w-[300px] shrink-0 items-center gap-3 rounded-2xl bg-surface p-3" data-testid={`reading-now-${b.id}`}>
            <Link to={`/books/${b.id}`} className="flex min-w-0 flex-1 items-center gap-3 transition-transform active:scale-[0.98]">
              <Cover src={b.cover_url} title={b.title} author={b.authors?.[0]} className="w-14" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{b.title}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="truncate text-xs text-fg2">{b.authors?.join(", ")}</p>
                  <SeriesBadge part={b.series_part} />
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface2">
                    <div className="h-full rounded-full bg-fg transition-[width] duration-500" style={{ width: `${b.progress_percent || 0}%` }} />
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-fg2">{b.estimated_seconds ? `${formatDuration(remainingSeconds(b))} übrig` : `${b.progress_percent || 0}%`}</span>
                </div>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => { start(b); navigate(`/books/${b.id}/read`); }}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-fg text-canvas transition-transform active:scale-90"
              aria-label="Lesen starten"
              data-testid={`reading-now-play-${b.id}`}
            >
              <Play size={18} className="ml-0.5 fill-current" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TaxonomyGroup({ kind, items = [], onAdd, onRename, onDelete, leading }) {
  const meta = TAXONOMY[kind];
  return (
    <Group
      title={meta.label}
      testId={`group-${kind}`}
      action={onAdd && (
        <button type="button" onClick={onAdd} className="grid h-9 w-9 place-items-center rounded-full text-fg transition-colors hover:bg-surface" aria-label={`${meta.singular} hinzufügen`} data-testid={`add-${kind}`}>
          <Plus size={20} />
        </button>
      )}
    >
      {leading}
      {items.length === 0 && !leading && <EmptyRow text={`Noch keine ${meta.label.toLowerCase()}`} />}
      {items.map((item) => (
        <SwipeRow
          key={item.name}
          testId={`swipe-${kind}-${item.name}`}
          actions={[
            { label: "Umbenennen", icon: Pencil, onClick: () => onRename(kind, item.name), className: "bg-surface3", testId: `rename-${kind}-${item.name}` },
            { label: "Löschen", icon: Trash2, onClick: () => onDelete(kind, item.name), className: "bg-red-500", testId: `delete-${kind}-${item.name}` },
          ]}
        >
          <Row icon={meta.icon} label={item.name} value={item.count} to={`/books?${meta.param}=${encodeURIComponent(item.name)}`} testId={`row-${kind}-${item.name}`} className="border-b-0" />
        </SwipeRow>
      ))}
    </Group>
  );
}

/** Anlegen oder Umbenennen (edit = { kind, name }) */
export function NameDialog({ kind, edit, onClose }) {
  const [name, setName] = useState("");
  const add = useAddTaxonomy();
  const rename = useRenameTaxonomy();
  const activeKind = edit?.kind || kind;
  const meta = activeKind ? TAXONOMY[activeKind] : null;
  useEffect(() => { setName(edit?.name || ""); }, [edit, kind]);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      if (edit) {
        await rename.mutateAsync({ kind: edit.kind, name: edit.name, newName: name.trim() });
        toast.success(`${meta.singular} umbenannt`);
      } else {
        await add.mutateAsync({ kind, name: name.trim() });
        toast.success(`${meta.singular} angelegt`);
      }
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Dialog open={!!activeKind} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl border-line bg-surface text-fg" data-testid="add-name-dialog">
        <DialogTitle className="font-display text-lg">{meta ? (edit ? `${meta.singular} umbenennen` : `Neue ${meta.singular}`) : ""}</DialogTitle>
        <form onSubmit={submit} className="space-y-4">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full rounded-xl bg-surface2 px-4 py-3 text-[16px] outline-none placeholder:text-fg3" data-testid="add-name-input" />
          <PillButton type="submit" disabled={add.isPending || rename.isPending} data-testid="add-name-submit">{edit ? "Speichern" : "Anlegen"}</PillButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function useDeleteTaxonomyWithToast() {
  const del = useDeleteTaxonomy();
  return async (kind, name) => {
    try {
      await del.mutateAsync({ kind, name });
      toast.success(`„${name}" gelöscht`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
}

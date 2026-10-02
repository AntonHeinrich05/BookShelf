import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmptyRow, Group, Row } from "@/components/ios/Group";
import { PillButton } from "@/components/ios/Form";
import { Cover } from "@/components/books/Cover";
import { SeriesBadge } from "@/components/books/Bits";
import { TAXONOMY } from "@/lib/constants";
import { useAddTaxonomy } from "@/hooks/useBooks";
import { errorMessage } from "@/lib/api";

export function ReadingNow({ books }) {
  return (
    <section className="anim-in mb-8" data-testid="reading-now">
      <h2 className="mb-3 px-1 font-display text-xl font-bold tracking-tight md:text-2xl">Aktuell am Lesen</h2>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {books.map((b) => (
          <Link key={b.id} to={`/books/${b.id}`} className="flex w-[260px] shrink-0 items-center gap-3 rounded-2xl bg-surface p-3 transition-transform active:scale-[0.98]" data-testid={`reading-now-${b.id}`}>
            <Cover src={b.cover_url} title={b.title} className="w-14" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{b.title}</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <p className="truncate text-xs text-fg2">{b.authors?.join(", ")}</p>
                <SeriesBadge part={b.series_part} />
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface2">
                <div className="h-full rounded-full bg-fg transition-[width] duration-500" style={{ width: `${b.progress_percent || 0}%` }} />
              </div>
              <p className="mt-1 text-[11px] tabular-nums text-fg2">
                {b.page_count ? `${b.current_page} / ${b.page_count} Seiten · ` : ""}{b.progress_percent || 0}%
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function TaxonomyGroup({ kind, items = [], onAdd }) {
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
      {items.length === 0 && <EmptyRow text={`Noch keine ${meta.label.toLowerCase()}`} />}
      {items.map((item) => (
        <Row key={item.name} icon={meta.icon} label={item.name} value={item.count} to={`/books?${meta.param}=${encodeURIComponent(item.name)}`} testId={`row-${kind}-${item.name}`} />
      ))}
    </Group>
  );
}

export function AddNameDialog({ kind, onClose }) {
  const [name, setName] = useState("");
  const add = useAddTaxonomy();
  const meta = kind ? TAXONOMY[kind] : null;
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await add.mutateAsync({ kind, name: name.trim() });
      toast.success(`${meta.singular} angelegt`);
      setName("");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <Dialog open={!!kind} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm rounded-3xl border-line bg-surface text-fg" data-testid="add-name-dialog">
        <DialogTitle className="font-display text-lg">{meta ? `Neue ${meta.singular}` : ""}</DialogTitle>
        <form onSubmit={submit} className="space-y-4">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full rounded-xl bg-surface2 px-4 py-3 text-[16px] outline-none placeholder:text-fg3" data-testid="add-name-input" />
          <PillButton type="submit" disabled={add.isPending} data-testid="add-name-submit">Anlegen</PillButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

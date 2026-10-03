import { useState } from "react";
import { Link } from "react-router-dom";
import { BookMarked, Heart, Library, Plus, Sparkles, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useOverview, useStartEnrich } from "@/hooks/useBooks";
import { errorMessage } from "@/lib/api";
import { FORMATS, LIBRARY_STATUSES, NO_SERIES, OWNERSHIP, READ_FILTERS } from "@/lib/constants";
import { IconButton, PageHeader } from "@/components/layout/PageHeader";
import { JobProgress } from "@/components/layout/JobProgress";
import { Group, Row } from "@/components/ios/Group";
import { Splash } from "@/components/layout/Splash";
import { BookForm } from "@/components/books/BookForm";
import { NameDialog, ReadingNow, TaxonomyGroup, useDeleteTaxonomyWithToast } from "@/components/library/LibrarySections";

const MANUAL_BOOK = {};

export default function LibraryPage() {
  const { user } = useAuth();
  const { data: o, isLoading } = useOverview();
  const [formOpen, setFormOpen] = useState(false);
  const [addKind, setAddKind] = useState(null);
  const [edit, setEdit] = useState(null);
  const [jobId, setJobId] = useState(() => sessionStorage.getItem("bs_lib_job") || null);
  const deleteTaxonomy = useDeleteTaxonomyWithToast();
  const enrich = useStartEnrich();

  const initials = user?.name?.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const taxonomyProps = { onRename: (kind, name) => setEdit({ kind, name }), onDelete: deleteTaxonomy };

  const startEnrich = async (kind) => {
    try {
      const { job_id } = await enrich.mutateAsync(kind);
      sessionStorage.setItem("bs_lib_job", job_id);
      setJobId(job_id);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Bibliothek"
        subtitle={`Hallo ${user?.name?.split(" ")[0] || ""}`}
        right={
          <>
            <IconButton onClick={() => setFormOpen(true)} aria-label="Buch hinzufügen" data-testid="add-book-button"><Plus size={20} /></IconButton>
            <Link to="/settings" className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-surface text-sm font-semibold transition-transform active:scale-90" data-testid="settings-link">
              {user?.picture ? <img src={user.picture} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : initials}
            </Link>
          </>
        }
      />

      {isLoading || !o ? (
        <Splash />
      ) : (
        <>
          {o.reading.length > 0 && <ReadingNow books={o.reading} />}
          {jobId && <JobProgress jobId={jobId} compact className="mb-6" onDone={(job) => { sessionStorage.removeItem("bs_lib_job"); if (job.status === "error") toast.error(job.message || "Vorgang fehlgeschlagen"); else toast.success(job.kind === "series" ? `${job.series_found} Reihen erkannt` : "Bibliothek aktualisiert"); }} />}

          <Group title="Bibliothek" testId="group-library">
            <Row icon={Library} label="Alle Bücher" value={o.total} to="/books" testId="row-all-books" />
            {LIBRARY_STATUSES.map((s) => (
              <Row key={s.value} icon={s.icon} label={s.label} value={o.status[s.value] || 0} to={`/books?status=${s.value}`} testId={`row-status-${s.value}`} />
            ))}
            <Row icon={Star} label="Markiert" value={o.marked} to="/books?marked=1" testId="row-marked" />
          </Group>

          <Group title="Wunschliste" testId="group-wishlist">
            <Row icon={Heart} label="Wunschliste" value={o.wishlist} to="/books?status=wishlist" testId="row-status-wishlist" />
          </Group>

          <Group title="Gelesen" testId="group-read">
            {READ_FILTERS.map((r) => (
              <Row key={r.value} icon={r.icon} label={r.label} value={o.read?.[r.value] || 0} to={`/books?read=${r.value}`} testId={`row-read-${r.value}`} />
            ))}
          </Group>

          <Group title="Autoren" testId="group-authors">
            <Row icon={Users} label="Alle Autoren" value={o.authors_count} to="/authors" testId="row-authors" />
          </Group>

          <TaxonomyGroup
            kind="series"
            items={o.series}
            leading={<Row icon={BookMarked} label="Einzelne Bücher" value={o.series_none ?? 0} to={`/books?series=${NO_SERIES}`} testId="row-series-none" iconClass="bg-fg text-canvas" />}
            {...taxonomyProps}
          />
          <TaxonomyGroup kind="categories" items={o.categories} onAdd={() => setAddKind("categories")} {...taxonomyProps} />
          <TaxonomyGroup kind="collections" items={o.collections} onAdd={() => setAddKind("collections")} {...taxonomyProps} />
          <TaxonomyGroup kind="places" items={o.places} onAdd={() => setAddKind("places")} {...taxonomyProps} />

          <Group title="Formate" testId="group-formats">
            {FORMATS.map((f) => (
              <Row key={f.value} icon={f.icon} label={f.label} value={o.formats[f.value] || 0} to={`/books?format=${f.value}`} testId={`row-format-${f.value}`} />
            ))}
          </Group>

          <Group title="Besitz" testId="group-ownership">
            {OWNERSHIP.map((w) => (
              <Row key={w.value} icon={w.icon} label={w.label} value={o.ownership[w.value] || 0} to={`/books?ownership=${w.value}`} testId={`row-ownership-${w.value}`} />
            ))}
          </Group>

          <Group title="Reihen" testId="group-maintenance">
            <Row icon={Sparkles} label="Reihen automatisch erkennen" value={enrich.isPending ? "Startet…" : o.series_none ? `${o.series_none} prüfen` : undefined} onClick={() => !enrich.isPending && startEnrich("series")} testId="row-detect-series" />
          </Group>
          <p className="px-1 text-center text-xs text-fg3">Tipp: Reihen, Genres, Sammlungen und Orte nach links wischen zum Umbenennen oder Löschen.</p>
        </>
      )}

      <BookForm open={formOpen} onOpenChange={setFormOpen} initial={MANUAL_BOOK} />
      <NameDialog kind={addKind} edit={edit} onClose={() => { setAddKind(null); setEdit(null); }} />
    </>
  );
}

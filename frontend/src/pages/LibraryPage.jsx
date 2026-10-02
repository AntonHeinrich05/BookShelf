import { useState } from "react";
import { Link } from "react-router-dom";
import { Library, Plus, Star, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useOverview } from "@/hooks/useBooks";
import { FORMATS, OWNERSHIP, STATUSES } from "@/lib/constants";
import { IconButton, PageHeader } from "@/components/layout/PageHeader";
import { Group, Row } from "@/components/ios/Group";
import { Splash } from "@/components/layout/Splash";
import { BookForm } from "@/components/books/BookForm";
import { AddNameDialog, ReadingNow, TaxonomyGroup } from "@/components/library/LibrarySections";

const MANUAL_BOOK = {};

export default function LibraryPage() {
  const { user } = useAuth();
  const { data: o, isLoading } = useOverview();
  const [formOpen, setFormOpen] = useState(false);
  const [addKind, setAddKind] = useState(null);

  const initials = user?.name?.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <>
      <PageHeader
        title="Bibliothek"
        subtitle={`Hallo ${user?.name?.split(" ")[0] || ""}`}
        right={
          <>
            <IconButton onClick={() => setFormOpen(true)} aria-label="Buch hinzufügen" data-testid="add-book-button"><Plus size={20} /></IconButton>
            <Link to="/settings" className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-surface text-sm font-semibold transition-transform active:scale-90" data-testid="settings-link">
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

          <Group title="Bibliothek" testId="group-library">
            <Row icon={Library} label="Bibliothek" value={o.total} to="/books" testId="row-all-books" />
            {STATUSES.map((s) => (
              <Row key={s.value} icon={s.icon} label={s.label} value={o.status[s.value] || 0} to={`/books?status=${s.value}`} testId={`row-status-${s.value}`} />
            ))}
            <Row icon={Star} label="Markiert" value={o.marked} to="/books?marked=1" testId="row-marked" />
          </Group>

          <Group title="Autoren" testId="group-authors">
            <Row icon={Users} label="Alle Autoren" value={o.authors_count} to="/authors" testId="row-authors" />
          </Group>

          <TaxonomyGroup kind="series" items={o.series} />
          <TaxonomyGroup kind="collections" items={o.collections} onAdd={() => setAddKind("collections")} />
          <TaxonomyGroup kind="categories" items={o.categories} onAdd={() => setAddKind("categories")} />
          <TaxonomyGroup kind="places" items={o.places} onAdd={() => setAddKind("places")} />

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
        </>
      )}

      <BookForm open={formOpen} onOpenChange={setFormOpen} initial={MANUAL_BOOK} />
      <AddNameDialog kind={addKind} onClose={() => setAddKind(null)} />
    </>
  );
}

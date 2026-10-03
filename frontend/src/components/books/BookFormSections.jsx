import { Switch } from "@/components/ui/switch";
import { decimal, digits, FORMATS, OWNERSHIP, STATUSES, TAXONOMY } from "@/lib/constants";
import { Cover } from "./Cover";
import { Stars } from "./Bits";
import { TagPicker } from "./TagPicker";
import { SeriesPicker } from "./SeriesPicker";
import { FormGroup, FormRow, NativeSelect, SectionLabel, Segmented, TextInput } from "@/components/ios/Form";

export function DetailsSection({ form, set }) {
  const author = form.authors_text.split(",")[0]?.trim();
  return (
    <>
      <SectionLabel>Buchdetails</SectionLabel>
      <div className="mb-3 flex items-center gap-4 rounded-2xl bg-surface p-4">
        <Cover src={form.cover_url} title={form.title || "Neues Buch"} author={author} className="w-16" />
        <div className="min-w-0 flex-1">
          <input autoFocus={!form.title} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Titel" className="w-full bg-transparent font-display text-lg font-semibold outline-none placeholder:text-fg3" data-testid="form-title" />
          <input value={form.authors_text} onChange={(e) => set("authors_text", e.target.value)} placeholder="Autor:in (mehrere mit Komma)" className="mt-1 w-full bg-transparent text-sm text-fg2 outline-none placeholder:text-fg3" data-testid="form-authors" />
        </div>
      </div>
      <FormGroup>
        <FormRow label="Jahr"><TextInput inputMode="numeric" value={form.published_year} onChange={(e) => set("published_year", digits(e.target.value))} placeholder="–" data-testid="form-year" /></FormRow>
        <FormRow label="Verlag"><TextInput value={form.publisher} onChange={(e) => set("publisher", e.target.value)} placeholder="–" data-testid="form-publisher" /></FormRow>
        <FormRow label="ISBN"><TextInput value={form.isbn} onChange={(e) => set("isbn", e.target.value)} placeholder="–" data-testid="form-isbn" /></FormRow>
        {!form.cover_custom && !form.cover_url?.startsWith("/api/covers/") && <FormRow label="Cover-URL"><TextInput value={form.cover_url} onChange={(e) => set("cover_url", e.target.value)} placeholder="https://…" data-testid="form-cover" /></FormRow>}
      </FormGroup>
    </>
  );
}

export function StatusSection({ form, set }) {
  return (
    <>
      <SectionLabel>Lesestatus</SectionLabel>
      <FormGroup>
        <FormRow label="Status"><NativeSelect value={form.status} onChange={(v) => set("status", v)} options={STATUSES} testId="form-status" /></FormRow>
        <FormRow label="Markiert"><Switch checked={form.marked} onCheckedChange={(v) => set("marked", v)} data-testid="form-marked" /></FormRow>
      </FormGroup>
    </>
  );
}

export function FormatSection({ form, set }) {
  return (
    <>
      <SectionLabel>Buchformat</SectionLabel>
      <FormGroup>
        <FormRow label="Format"><Segmented value={form.format || "book"} onChange={(v) => set("format", v)} options={FORMATS} testId="form-format" /></FormRow>
        {form.format === "audiobook" && (
          <FormRow label="Länge (Minuten)"><TextInput inputMode="numeric" value={form.audio_minutes} onChange={(e) => set("audio_minutes", digits(e.target.value))} placeholder="z. B. 540" data-testid="form-audio-minutes" /></FormRow>
        )}
        <FormRow label="Fortschrittstyp"><Segmented value={form.progress_type} onChange={(v) => set("progress_type", v)} options={[{ value: "pages", label: "Seiten" }, { value: "percent", label: "%" }]} testId="form-progress-type" /></FormRow>
        <FormRow label="Seitenanzahl"><TextInput inputMode="numeric" value={form.page_count} onChange={(e) => set("page_count", digits(e.target.value))} placeholder="–" data-testid="form-pages" /></FormRow>
        {form.progress_type === "pages" ? (
          <FormRow label="Gelesene Seiten"><TextInput inputMode="numeric" value={form.current_page} onChange={(e) => set("current_page", digits(e.target.value))} placeholder="0" data-testid="form-current-page" /></FormRow>
        ) : (
          <FormRow label="Fortschritt %"><TextInput inputMode="numeric" value={form.progress_percent} onChange={(e) => set("progress_percent", digits(e.target.value))} placeholder="0" data-testid="form-progress-percent" /></FormRow>
        )}
      </FormGroup>
    </>
  );
}

export function RatingDatesSection({ form, set }) {
  return (
    <>
      <SectionLabel>Bewertung & Lesedaten</SectionLabel>
      <FormGroup>
        <FormRow label="Bewertung"><Stars value={form.rating} onChange={(v) => set("rating", v)} size={22} testId="form-rating" /></FormRow>
        <FormRow label="Start"><input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} className="bg-transparent text-right text-[16px] outline-none" data-testid="form-start-date" /></FormRow>
        <FormRow label="Ende"><input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} className="bg-transparent text-right text-[16px] outline-none" data-testid="form-end-date" /></FormRow>
      </FormGroup>
    </>
  );
}

export function OwnershipSection({ form, set }) {
  return (
    <>
      <SectionLabel>Eigentumsstatus</SectionLabel>
      <FormGroup>
        <FormRow label="Status"><NativeSelect value={form.ownership} onChange={(v) => set("ownership", v)} options={OWNERSHIP} testId="form-ownership" /></FormRow>
      </FormGroup>
    </>
  );
}

export function SeriesSection({ form, set, suggestions }) {
  return (
    <>
      <SectionLabel>Reihe</SectionLabel>
      <FormGroup>
        <SeriesPicker value={form.series_name} onChange={(v) => set("series_name", v)} suggestions={suggestions} title={form.title} />
        <FormRow label="Teil"><TextInput inputMode="decimal" value={form.series_part} onChange={(e) => set("series_part", decimal(e.target.value))} placeholder="z. B. 1" data-testid="form-series-part" /></FormRow>
      </FormGroup>
    </>
  );
}

export function TagsSection({ kind, form, set, suggestions, hint }) {
  const meta = TAXONOMY[kind];
  return (
    <>
      <SectionLabel>{meta.label}</SectionLabel>
      <FormGroup>
        <TagPicker values={form[kind]} onChange={(v) => set(kind, v)} suggestions={suggestions} placeholder={`${meta.singular} hinzufügen`} testId={`form-${kind}`} />
        {hint && <p className="px-4 pb-3 text-xs text-fg3" data-testid={`form-${kind}-hint`}>{hint}</p>}
      </FormGroup>
    </>
  );
}

export function NotesSection({ form, set }) {
  return (
    <>
      <SectionLabel>Notizen</SectionLabel>
      <FormGroup>
        <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Gedanken, Zitate, Lieblingsstellen…" className="w-full resize-none bg-transparent px-4 py-3 text-[16px] outline-none placeholder:text-fg3" data-testid="form-notes" />
      </FormGroup>
    </>
  );
}

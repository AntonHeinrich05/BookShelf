import { useRef, useState } from "react";
import { Copy, ExternalLink, FileArchive, FileSpreadsheet, Tablet, Upload } from "lucide-react";
import { toast } from "sonner";
import { useImport } from "@/hooks/useBooks";
import { errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { JobProgress } from "@/components/layout/JobProgress";
import { PillButton } from "@/components/ios/Form";

// Läuft im Browser auf read.amazon.com / lesen.amazon.de (eigene Sitzung) und lädt die Bibliothek als JSON herunter
const KINDLE_BOOKMARKLET = `javascript:(async()=>{let t=null,all=[];try{do{const u=location.origin+"/kindle-library/search?query=&libraryType=BOOKS"+(t?"&paginationToken="+t:"")+"&sortType=acquisition_desc&querySize=50";const r=await fetch(u,{credentials:"include"});if(!r.ok)throw new Error("Nicht angemeldet");const j=await r.json();all=all.concat(j.itemsList||[]);t=j.paginationToken}while(t)}catch(e){alert("Bitte zuerst bei read.amazon.com (oder lesen.amazon.de) anmelden und die Seite neu laden.");return}const b=new Blob([JSON.stringify({itemsList:all})],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="kindle-bibliothek.json";document.body.appendChild(a);a.click();alert(all.length+" Kindle-Bücher exportiert – Datei jetzt in BookShelf importieren.")})();`;

const LINKS = {
  kindle: [
    { label: "Kindle-Bibliothek öffnen (lesen.amazon.de)", href: "https://lesen.amazon.de/kindle-library" },
    { label: "Amazon: Inhalte & Geräte (alle Bücher)", href: "https://www.amazon.de/hz/mycd/digital-console/contentlist/booksAll/dateDsc/" },
  ],
  tolino: [
    { label: "tolino Webreader – Meine Bücher", href: "https://webreader.mytolino.com/library/" },
    { label: "Thalia: Meine eBooks", href: "https://www.thalia.de/shop/home/mein-konto/ebooks/" },
  ],
};

function ExternalLinks({ links, testId }) {
  return (
    <div className="mt-3 grid gap-2" data-testid={testId}>
      {links.map((l) => (
        <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl bg-surface2 px-3.5 py-2.5 text-sm font-medium transition-colors active:bg-surface3" data-testid={`${testId}-link`}>
          <span className="truncate">{l.label}</span>
          <ExternalLink size={15} className="shrink-0 text-fg2" />
        </a>
      ))}
    </div>
  );
}

function ImportCard({ icon: Icon, title, description, accept, kind, steps, extra, testId }) {
  const input = useRef(null);
  const imp = useImport();
  const [jobId, setJobId] = useState(null);
  const [running, setRunning] = useState(false);

  const onFile = async (file) => {
    if (!file) return;
    try {
      const { job_id } = await imp.mutateAsync({ kind, file });
      setJobId(job_id);
      setRunning(true);
    } catch (err) {
      toast.error(errorMessage(err, "Import fehlgeschlagen"));
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  return (
    <section className="anim-in mb-5 rounded-2xl bg-surface p-4" data-testid={testId}>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface2"><Icon size={20} /></span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <p className="text-sm text-fg2">{description}</p>
        </div>
      </div>
      {steps && (
        <ol className="mt-4 space-y-1.5 text-sm text-fg2">
          {steps.map((s, i) => <li key={i} className="flex gap-2"><span className="w-4 shrink-0 font-semibold text-fg">{i + 1}.</span><span>{s}</span></li>)}
        </ol>
      )}
      {extra}
      <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} data-testid={`${testId}-file`} />
      <PillButton onClick={() => input.current?.click()} disabled={imp.isPending || running} className="mt-4" data-testid={`${testId}-button`}>
        <Upload size={18} className="mr-2" /> {imp.isPending ? "Wird hochgeladen…" : running ? "Import läuft…" : "Datei auswählen & importieren"}
      </PillButton>
      {jobId && (
        <JobProgress
          jobId={jobId}
          className="mt-4 bg-surface2/60"
          onDone={(job) => {
            setRunning(false);
            if (job.status === "error") toast.error(job.message || "Import fehlgeschlagen");
            else toast.success(`${job.added} Bücher importiert${job.covers_fixed ? ` · ${job.covers_fixed} Cover` : ""}${job.series_found ? ` · ${job.series_found} Reihen` : ""}`);
          }}
        />
      )}
    </section>
  );
}

export default function ImportPage() {
  const copyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(KINDLE_BOOKMARKLET);
      toast.success("Kindle-Export-Skript kopiert");
    } catch {
      toast.error("Kopieren nicht möglich – Text manuell markieren");
    }
  };

  return (
    <div data-testid="import-page">
      <PageHeader back title="Importieren" subtitle="Duplikate werden erkannt · Cover & Reihen werden danach automatisch ergänzt" />

      <ImportCard
        icon={FileArchive}
        title="Bookshelf-App (ZIP)"
        description="Export aus der iOS-App „Bookshelf“ – Bücher, Lesestatus, Daten, Bewertungen, Sammlungen."
        accept=".zip,application/zip"
        kind="bookshelf"
        steps={["In Bookshelf: Einstellungen → Exportieren → ZIP speichern", "Hier die ZIP-Datei auswählen"]}
        testId="import-bookshelf"
      />

      <ImportCard
        icon={Tablet}
        title="Kindle"
        description="Alle Kindle-Bücher inkl. Lesefortschritt – landen automatisch als eBook."
        accept=".json,application/json,.csv,text/csv"
        kind="kindle"
        steps={[
          "Kindle-Bibliothek über den Link unten öffnen und anmelden (am besten am PC/Mac).",
          "Export-Skript kopieren und dort in die Adresszeile bzw. Browser-Konsole einfügen – es lädt „kindle-bibliothek.json“ herunter.",
          "Diese Datei hier importieren. Zum Aktualisieren einfach wiederholen – nur neue Bücher kommen dazu.",
        ]}
        extra={
          <>
            <ExternalLinks links={LINKS.kindle} testId="kindle-links" />
            <button type="button" onClick={copyBookmarklet} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-line py-2.5 text-sm font-medium" data-testid="copy-kindle-script">
              <Copy size={15} /> Kindle-Export-Skript kopieren
            </button>
          </>
        }
        testId="import-kindle"
      />

      <ImportCard
        icon={FileSpreadsheet}
        title="Tolino, Goodreads & CSV"
        description="Jede CSV mit Spalten wie Titel, Autor, ISBN, Status, Bewertung, Gelesen am. Goodreads-Export funktioniert direkt."
        accept=".csv,text/csv"
        kind="csv"
        steps={[
          "Tolino: Bibliothek über den Link öffnen – Titel & Autor in eine Tabelle (Excel/Numbers) übernehmen und als CSV speichern.",
          "Goodreads: My Books → Import/Export → Export Library.",
        ]}
        extra={<ExternalLinks links={LINKS.tolino} testId="tolino-links" />}
        testId="import-csv"
      />
      <p className="px-1 text-center text-xs text-fg3">Amazon und Tolino bieten keine offizielle Schnittstelle. Der Kindle-Export läuft komplett in deinem Browser mit deiner eigenen Anmeldung – Zugangsdaten werden nie an BookShelf übertragen.</p>
    </div>
  );
}

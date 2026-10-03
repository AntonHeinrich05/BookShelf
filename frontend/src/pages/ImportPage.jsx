import { useRef, useState } from "react";
import { Copy, FileArchive, FileSpreadsheet, Tablet, Upload } from "lucide-react";
import { toast } from "sonner";
import { useImport } from "@/hooks/useBooks";
import { errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { PillButton } from "@/components/ios/Form";

// Läuft im Browser auf read.amazon.com / lesen.amazon.de (eigene Sitzung) und lädt die Bibliothek als JSON herunter
const KINDLE_BOOKMARKLET = `javascript:(async()=>{let t=null,all=[];try{do{const u=location.origin+"/kindle-library/search?query=&libraryType=BOOKS"+(t?"&paginationToken="+t:"")+"&sortType=acquisition_desc&querySize=50";const r=await fetch(u,{credentials:"include"});if(!r.ok)throw new Error("Nicht angemeldet");const j=await r.json();all=all.concat(j.itemsList||[]);t=j.paginationToken}while(t)}catch(e){alert("Bitte zuerst bei read.amazon.com (oder lesen.amazon.de) anmelden und die Seite neu laden.");return}const b=new Blob([JSON.stringify({itemsList:all})],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="kindle-bibliothek.json";document.body.appendChild(a);a.click();alert(all.length+" Kindle-Bücher exportiert – Datei jetzt in BookShelf importieren.")})();`;

function ImportCard({ icon: Icon, title, description, accept, kind, steps, extra, testId }) {
  const input = useRef(null);
  const imp = useImport();
  const [result, setResult] = useState(null);

  const onFile = async (file) => {
    if (!file) return;
    try {
      const res = await imp.mutateAsync({ kind, file });
      setResult(res);
      toast.success(`${res.added} Bücher importiert`);
    } catch (err) {
      toast.error(errorMessage(err, "Import fehlgeschlagen"));
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  return (
    <section className="anim-in mb-6 rounded-2xl bg-surface p-4" data-testid={testId}>
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
      <PillButton onClick={() => input.current?.click()} disabled={imp.isPending} className="mt-4" data-testid={`${testId}-button`}>
        <Upload size={18} className="mr-2" /> {imp.isPending ? "Importiere…" : "Datei auswählen & importieren"}
      </PillButton>
      {result && (
        <div className="mt-4 rounded-xl bg-surface2 p-3 text-sm" data-testid={`${testId}-result`}>
          <p><span className="font-semibold">{result.added}</span> neu importiert · <span className="font-semibold">{result.skipped}</span> bereits vorhanden (übersprungen)</p>
          {result.failed_count > 0 && (
            <details className="mt-2 text-fg2">
              <summary className="cursor-pointer">{result.failed_count} Einträge konnten nicht übernommen werden</summary>
              <ul className="mt-1 list-disc pl-5">{result.failed.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </details>
          )}
        </div>
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
      <PageHeader back title="Importieren" subtitle="Duplikate werden automatisch erkannt – du kannst jederzeit erneut importieren" />

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
        title="Kindle-Bibliothek"
        description="Alle Kindle-Bücher inkl. Lesefortschritt (gelesen / angefangen / ungelesen) – landen automatisch als eBook."
        accept=".json,application/json"
        kind="kindle"
        steps={[
          "Am PC/Mac: read.amazon.com (bzw. lesen.amazon.de) öffnen und mit deinem Amazon-Konto anmelden.",
          "Skript unten kopieren, als Lesezeichen speichern (Adresse = Skript) und auf der Kindle-Seite antippen – oder in der Browser-Konsole einfügen (F12 → Konsole).",
          "Es wird „kindle-bibliothek.json“ heruntergeladen – diese Datei hier importieren. Zum Aktualisieren einfach wiederholen: nur neue Bücher kommen dazu.",
        ]}
        extra={
          <button type="button" onClick={copyBookmarklet} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-line py-2.5 text-sm font-medium" data-testid="copy-kindle-script">
            <Copy size={15} /> Kindle-Export-Skript kopieren
          </button>
        }
        testId="import-kindle"
      />

      <ImportCard
        icon={FileSpreadsheet}
        title="CSV (Goodreads, Tolino, Excel …)"
        description="Jede CSV mit Spalten wie Title/Titel, Author/Autor, ISBN, Status, Rating, Date Read. Goodreads-Export funktioniert direkt."
        accept=".csv,text/csv"
        kind="csv"
        steps={[
          "Goodreads: My Books → Import/Export → Export Library.",
          "Tolino: Es gibt keinen Export – in der tolino-Webreader-Bibliothek (webreader.mytolino.com) Titel markieren/kopieren und als CSV (Titel, Autor) speichern, z. B. in Excel/Numbers.",
        ]}
        testId="import-csv"
      />
      <p className="px-1 text-center text-xs text-fg3">Hinweis: Amazon und Tolino bieten keine offizielle Schnittstelle. Der Kindle-Export läuft komplett in deinem Browser mit deiner eigenen Anmeldung – Zugangsdaten werden nie an BookShelf übertragen.</p>
    </div>
  );
}

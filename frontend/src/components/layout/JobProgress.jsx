import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useJob } from "@/hooks/useBooks";
import { cn } from "@/lib/utils";

const PHASES = {
  import: "Bücher werden importiert",
  covers: "Cover werden gesucht",
  series: "Reihen werden erkannt",
  all: "Bibliothek wird aufgefrischt",
  done: "Fertig",
};

/**
 * Fortschrittsanzeige für Hintergrund-Jobs (Import, Cover-Suche, Reihen-Erkennung).
 * Pollt /jobs/{id}, bis der Job fertig ist. Bitte-warten-Hinweis, solange er läuft.
 */
export function JobProgress({ jobId, onDone, className, compact = false }) {
  const { data: job } = useJob(jobId, onDone);
  if (!jobId || !job) return null;
  const running = job.status === "running";
  const pct = job.total ? Math.round((job.done / job.total) * 100) : running ? 0 : 100;
  return (
    <div className={cn("rounded-2xl bg-surface p-4", className)} data-testid="job-progress" aria-live="polite">
      <div className="flex items-center gap-3">
        {running ? <Loader2 size={20} className="shrink-0 animate-spin text-tint" /> : job.status === "error" ? <XCircle size={20} className="shrink-0 text-red-400" /> : <CheckCircle2 size={20} className="shrink-0 text-emerald-500" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" data-testid="job-phase">{running ? `${PHASES[job.phase] || "Wird verarbeitet"}…` : job.status === "error" ? "Fehler" : "Fertig"}</p>
          <p className="truncate text-xs text-fg2">
            {running ? (job.total ? `${job.done} von ${job.total} · bitte kurz warten, nicht schließen` : "Bitte kurz warten…") : job.message || summary(job)}
          </p>
        </div>
        {running && <span className="tabular-nums text-sm font-semibold" data-testid="job-percent">{pct}%</span>}
      </div>
      {running && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2">
          <div className="h-full rounded-full bg-tint transition-[width] duration-300" style={{ width: `${Math.max(3, pct)}%` }} />
        </div>
      )}
      {!compact && !running && job.failed_count > 0 && (
        <details className="mt-3 text-xs text-fg2">
          <summary className="cursor-pointer">{job.failed_count} Einträge konnten nicht übernommen werden</summary>
          <ul className="mt-1 list-disc pl-5">{job.failed.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

function summary(job) {
  const parts = [];
  if (job.kind === "import") parts.push(`${job.added} neu importiert`, `${job.skipped} bereits vorhanden`);
  if (job.covers_fixed) parts.push(`${job.covers_fixed} Cover gefunden`);
  if (job.series_found) parts.push(`${job.series_found} Reihen erkannt`);
  if (!parts.length) parts.push(job.kind === "covers" ? "Keine neuen Cover gefunden" : job.kind === "series" ? "Keine weiteren Reihen gefunden" : "Alles aktuell");
  return parts.join(" · ");
}

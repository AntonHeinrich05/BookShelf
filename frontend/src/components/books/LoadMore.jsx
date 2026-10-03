import { useEffect, useRef } from "react";
import { Loader2, ArrowDown, RotateCcw } from "lucide-react";

export function LoadMore({ hasMore, loading, error, onLoad, testId = "load-more" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!hasMore || loading || error) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) onLoad();
    }, { root: document.getElementById("root"), rootMargin: "100px" });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasMore, loading, error, onLoad]);
  if (!hasMore && !error) return null;
  return <div ref={ref} className="flex justify-center py-6" data-testid={`${testId}-sentinel`}>
    <button type="button" onClick={() => onLoad()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-5 py-2 text-sm font-medium transition-opacity disabled:opacity-60" data-testid={testId}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : error ? <RotateCcw size={16} /> : <ArrowDown size={16} />}
      {loading ? "Weitere Bücher laden…" : error ? "Erneut versuchen" : "Weitere Bücher"}
    </button>
  </div>;
}
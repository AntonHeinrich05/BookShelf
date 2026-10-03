import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Harmonische Farbpaare für Bücher ohne Cover – deterministisch aus dem Titel gewählt
const PALETTES = [
  ["#5b3a8c", "#2b1b4d"], ["#1f5f6b", "#0f2f38"], ["#8c3a3a", "#4d1b1b"], ["#3a6b4a", "#1b3a26"],
  ["#8c5a2b", "#4d2f12"], ["#2f4b8c", "#16244d"], ["#8c2f6b", "#4d1538"], ["#4a4a8c", "#22224d"],
  ["#6b5f1f", "#38310f"], ["#1f6b5f", "#0f3831"], ["#8c4a1f", "#4d260f"], ["#3a3a3a", "#141414"],
];

const hash = (s = "") => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function paletteFor(title) {
  return PALETTES[hash(title) % PALETTES.length];
}

/** Google-Thumbnails in höherer Auflösung anfordern (sonst wirken große Cover unscharf). */
export function hiRes(url) {
  if (!url) return url;
  if (/books\.google\.com\/books\/content/.test(url) || /books\.google\.\w+\/books/.test(url)) {
    return url.replace(/zoom=\d/, "zoom=2").replace(/&fife=[^&]*/, "") + "&fife=w800-h1200";
  }
  return url;
}

export function CoverFallback({ title, author, className }) {
  const [a, b] = paletteFor(title);
  return (
    <div className={cn("grain relative flex h-full w-full flex-col justify-between p-[9%]", className)} style={{ background: `linear-gradient(160deg, ${a} 0%, ${b} 100%)` }} data-testid="cover-fallback">
      <span className="block h-[3px] w-[30%] rounded-full bg-white/50" />
      <div>
        <span className="line-clamp-5 font-display text-[clamp(9px,8cqw,15px)] font-bold leading-tight text-white/95">{title}</span>
        {author && <span className="mt-[6%] line-clamp-1 block text-[clamp(7px,6cqw,11px)] text-white/60">{author}</span>}
      </div>
    </div>
  );
}

export function Cover({ src, title, author, className, rounded = "rounded-md", large = false }) {
  const [error, setError] = useState(false);
  const [triedOriginal, setTriedOriginal] = useState(false);
  useEffect(() => { setError(false); setTriedOriginal(false); }, [src]);
  const url = large && !triedOriginal ? hiRes(src) : src;

  const onError = () => {
    if (large && !triedOriginal) return setTriedOriginal(true); // hochauflösende Variante gibt es nicht → Original
    setError(true);
  };
  const onLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth <= 2 || naturalHeight <= 2) setError(true); // 1×1-Platzhalter (Open Library / Google)
  };

  return (
    <div className={cn("relative aspect-[2/3] shrink-0 overflow-hidden bg-surface2 shadow-[0_4px_14px_rgba(0,0,0,0.35)] [container-type:inline-size]", rounded, className)}>
      {src && !error ? (
        <img src={url} alt={title} loading="lazy" onError={onError} onLoad={onLoad} className="h-full w-full object-cover" />
      ) : (
        <CoverFallback title={title} author={author} />
      )}
    </div>
  );
}

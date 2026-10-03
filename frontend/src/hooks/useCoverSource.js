import { useEffect, useState } from "react";
import api, { TOKEN_KEY } from "@/lib/api";

const pending = new Map();
const failures = new Map();
const cacheName = () => `bookshelf-covers-${localStorage.getItem("bs_cache_user") || "signed-out"}`;

async function loadCover(src, owner) {
  const key = `${owner}:${src}`;
  if ((failures.get(key) || 0) > Date.now()) return null;
  if (!pending.has(key)) {
    pending.set(key, (async () => {
      const url = `${process.env.REACT_APP_BACKEND_URL}${src}`;
      let cache;
      try { if ("caches" in window) cache = await caches.open(owner); } catch { /* private browsing */ }
      const saved = await cache?.match(url).catch(() => null);
      if (saved) return saved.blob();
      try {
        const { data } = await api.get(src.replace(/^\/api/, ""), { responseType: "blob", timeout: 45000 });
        // A request which completes after sign-out must never recreate private cache data.
        if (localStorage.getItem(TOKEN_KEY) && owner === cacheName()) {
          await cache?.put(url, new Response(data, { headers: { "Content-Type": "image/jpeg" } })).catch(() => {});
        }
        return data;
      } catch {
        failures.set(key, Date.now() + 60_000);
        return null;
      }
    })().finally(() => pending.delete(key)));
  }
  return pending.get(key);
}

export function useCoverSource(src, elementRef) {
  const [resolved, setResolved] = useState(null);
  const stored = !!src;
  const path = src?.startsWith("/api/covers/") ? src : src ? `/api/cover-preview?url=${encodeURIComponent(src.replace(/^http:\/\//, "https://"))}` : null;
  useEffect(() => {
    if (!stored) return;
    let active = true, objectUrl;
    setResolved(null);
    const load = async () => {
      const data = await loadCover(path, cacheName());
      if (!active || !data) return;
      objectUrl = URL.createObjectURL(data);
      setResolved(objectUrl);
    };
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { observer.disconnect(); load(); }
    }, { rootMargin: "250px" });
    if (elementRef.current) observer.observe(elementRef.current);
    return () => { active = false; observer.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path, stored, elementRef]);
  return stored ? resolved : src;
}
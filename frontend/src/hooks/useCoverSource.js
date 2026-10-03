import { useEffect, useState } from "react";
import api, { TOKEN_KEY } from "@/lib/api";

const pending = new Map(), failures = new Map(), memory = new Map();
const waiters = [];
let activeRequests = 0;
const cacheName = () => `bookshelf-covers-${localStorage.getItem("bs_cache_user") || "signed-out"}`;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
window.addEventListener("bookshelf:logout", () => { memory.clear(); failures.clear(); });

async function imageRequest(path) {
  // Reserve slots only for HTTP, not backoff. A missing cover cannot block the grid.
  if (activeRequests < 6) activeRequests++;
  else await new Promise(resolve => waiters.push(resolve));
  try { return await api.get(path.replace(/^\/api/, ""), { responseType: "blob", timeout: 10_000 }); }
  finally { const next = waiters.shift(); if (next) next(); else activeRequests--; }
}

function remember(key, blob) {
  memory.delete(key);
  memory.set(key, blob);
  while (memory.size > 100) memory.delete(memory.keys().next().value);
}

async function getBlob(path, owner) {
  const url = `${process.env.REACT_APP_BACKEND_URL}${path}`;
  let cache;
  try { if ("caches" in window) cache = await caches.open(owner); } catch { /* private browsing */ }
  const cached = await cache?.match(url).catch(() => null);
  if (cached) return cached.blob();
  for (let attempt = 0; attempt < 8; attempt++) {
    if (cacheName() !== owner || !localStorage.getItem(TOKEN_KEY)) return null;
    const response = await imageRequest(path);
    if (response.status === 202) {
      await wait(Math.min(4, Number(response.headers["retry-after"]) || 2) * 1000);
      continue;
    }
    if (!response.data?.size || !response.data.type.startsWith("image/")) return null;
    if (cacheName() !== owner || !localStorage.getItem(TOKEN_KEY)) return null;
    const blob = response.data;
    const store = address => cache?.put(address, new Response(blob, { headers: { "Content-Type": blob.type } })).catch(() => {});
    await store(url);
    const revision = response.headers["x-cover-revision"];
    if (revision && path.startsWith("/api/covers/")) {
      const canonical = new URL(url);
      canonical.searchParams.set("v", revision);
      await store(canonical.href);
      remember(`${owner}:${canonical.pathname}${canonical.search}`, blob);
    }
    return blob;
  }
  return null;
}

async function loadCover(path, owner) {
  const key = `${owner}:${path}`;
  if (memory.has(key)) return memory.get(key);
  if ((failures.get(key) || 0) > Date.now()) return null;
  if (!pending.has(key)) {
    pending.set(key, getBlob(path, owner).then(blob => {
      if (blob && cacheName() === owner) remember(key, blob);
      return blob;
    }).catch(err => {
      failures.set(key, Date.now() + (err.response?.status === 404 ? 60_000 : 5000));
      return null;
    }).finally(() => pending.delete(key)));
  }
  return pending.get(key);
}

export function useCoverSource(src, elementRef) {
  const [image, setImage] = useState({ path: null, url: null });
  const path = src?.startsWith("/api/covers/") ? src : src ? `/api/cover-preview?url=${encodeURIComponent(src.replace(/^http:\/\//, "https://"))}` : null;
  useEffect(() => {
    if (!path) return;
    let active = true, objectUrl;
    const load = async () => {
      const blob = await loadCover(path, cacheName());
      if (!active || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setImage({ path, url: objectUrl });
    };
    const scrollRoot = document.getElementById("root");
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { observer.disconnect(); load(); }
    }, { root: scrollRoot?.contains(elementRef.current) ? scrollRoot : null, rootMargin: "300px" });
    if (elementRef.current) observer.observe(elementRef.current);
    return () => { active = false; observer.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path, elementRef]);
  return image.path === path ? image.url : null;
}
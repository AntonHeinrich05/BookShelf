import { useEffect, useRef } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

const get = (url, params) => async () => (await api.get(url, { params })).data;

export const useBooks = (params = {}) => useQuery({ queryKey: ["books", params], queryFn: get("/books", params) });
export const usePagedBooks = (params = {}) => useInfiniteQuery({
  queryKey: ["books", "pages", params], initialPageParam: 0,
  queryFn: async ({ pageParam, signal }) => (await api.get("/books", { params: { ...params, skip: pageParam, limit: 40 }, signal })).data,
  getNextPageParam: last => last.has_more ? last.next_skip : undefined,
});
export const useBook = (id) => useQuery({ queryKey: ["book", id], queryFn: get(`/books/${id}`), enabled: !!id });
export const useOverview = () => useQuery({ queryKey: ["overview"], queryFn: get("/books/overview") });
export const useTaxonomy = (kind) => useQuery({ queryKey: ["taxonomy", kind], queryFn: get(`/taxonomy/${kind}`) });
export const useAuthors = () => useQuery({ queryKey: ["authors"], queryFn: get("/authors") });
export const useStats = (period) => useQuery({ queryKey: ["stats", period], queryFn: get("/stats", { period: period || "year" }) });
export const useSessions = (bookId) => useQuery({ queryKey: ["sessions", bookId], queryFn: get(`/books/${bookId}/sessions`), enabled: !!bookId });
export const useAuthConfig = () => useQuery({ queryKey: ["auth-config"], queryFn: get("/auth/config"), staleTime: Infinity });
export const useSearch = (q, lang) => useInfiniteQuery({
  queryKey: ["search", q.trim().toLowerCase(), lang], initialPageParam: 0,
  queryFn: async ({ pageParam, signal }) => (await api.get("/search", { params: { q: q.trim(), lang: lang || undefined, start: pageParam }, signal })).data,
  enabled: q.trim().length > 1, staleTime: 60_000, retry: 1,
  getNextPageParam: last => last.has_more ? last.next_start : undefined,
});

/** Hintergrund-Job (Import, Cover, Reihen) alle 800 ms abfragen, bis er fertig ist. */
export const useJob = (jobId, onDone) => {
  const invalidate = useInvalidate();
  const handled = useRef(null);
  const result = useQuery({
    queryKey: ["job", jobId],
    queryFn: get(`/jobs/${jobId}`),
    enabled: !!jobId,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "done" || status === "error") return false;
      return 800;
    },
  });
  useEffect(() => {
    if (["done", "error"].includes(result.data?.status) && handled.current !== jobId) {
      handled.current = jobId;
      invalidate();
      onDone?.(result.data);
    }
  }, [result.data, jobId, invalidate, onDone]);
  return result;
};

const KEYS = ["books", "book", "overview", "taxonomy", "authors", "stats", "sessions"];
const useInvalidate = () => {
  const qc = useQueryClient();
  return () => KEYS.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
};

export const useSaveBook = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, data }) => (id ? (await api.patch(`/books/${id}`, data)).data : (await api.post("/books", data)).data),
    onSuccess: invalidate,
  });
};

export const useUploadCover = () => {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookId, file }) => {
      const data = new FormData();
      data.append("file", file);
      return (await api.post(`/books/${bookId}/cover`, data)).data;
    },
    onSuccess: book => { qc.setQueryData(["book", book.id], book); invalidate(); },
  });
};

export const useDeleteBook = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async (id) => (await api.delete(`/books/${id}`)).data, onSuccess: invalidate });
};

export const useAddSession = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async ({ bookId, data }) => (await api.post(`/books/${bookId}/sessions`, data)).data, onSuccess: invalidate });
};

export const useDeleteSession = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async ({ bookId, sessionId }) => (await api.delete(`/books/${bookId}/sessions/${sessionId}`)).data, onSuccess: invalidate });
};

export const useAddTaxonomy = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async ({ kind, name }) => (await api.post(`/taxonomy/${kind}`, { name })).data, onSuccess: invalidate });
};

export const useRenameTaxonomy = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async ({ kind, name, newName }) => (await api.patch(`/taxonomy/${kind}/${encodeURIComponent(name)}`, { name: newName })).data, onSuccess: invalidate });
};

export const useDeleteTaxonomy = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async ({ kind, name }) => (await api.delete(`/taxonomy/${kind}/${encodeURIComponent(name)}`)).data, onSuccess: invalidate });
};

export const useImport = () => {
  return useMutation({
    mutationFn: async ({ kind, file }) => {
      const fd = new FormData();
      fd.append("file", file);
      return (await api.post(`/import/${kind}`, fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120_000 })).data; // → { job_id }
    },
  });
};

export const useStartEnrich = () => useMutation({ mutationFn: async (kind) => (await api.post(`/enrich/${kind}`)).data }); // → { job_id }

export const useFindCover = () =>
  useMutation({ mutationFn: async ({ title, author, isbn, google_id }) => (await api.get("/search/cover", { params: { title, author: author || undefined, isbn: isbn || undefined, google_id: google_id || undefined } })).data });

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

const get = (url, params) => async () => (await api.get(url, { params })).data;

export const useBooks = (params = {}) => useQuery({ queryKey: ["books", params], queryFn: get("/books", params) });
export const useBook = (id) => useQuery({ queryKey: ["book", id], queryFn: get(`/books/${id}`), enabled: !!id });
export const useOverview = () => useQuery({ queryKey: ["overview"], queryFn: get("/books/overview") });
export const useTaxonomy = (kind) => useQuery({ queryKey: ["taxonomy", kind], queryFn: get(`/taxonomy/${kind}`) });
export const useAuthors = () => useQuery({ queryKey: ["authors"], queryFn: get("/authors") });
export const useStats = (year) => useQuery({ queryKey: ["stats", year], queryFn: get("/stats", year ? { year } : {}) });
export const useSessions = (bookId) => useQuery({ queryKey: ["sessions", bookId], queryFn: get(`/books/${bookId}/sessions`), enabled: !!bookId });
export const useAuthConfig = () => useQuery({ queryKey: ["auth-config"], queryFn: get("/auth/config"), staleTime: Infinity });
export const useSearch = (q, lang) =>
  useQuery({ queryKey: ["search", q.trim().toLowerCase(), lang], queryFn: get("/search", { q: q.trim(), lang: lang || undefined }), enabled: q.trim().length > 1, staleTime: 24 * 60 * 60_000, placeholderData: (prev) => prev });

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
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ kind, file }) => {
      const fd = new FormData();
      fd.append("file", file);
      return (await api.post(`/import/${kind}`, fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120_000 })).data;
    },
    onSuccess: invalidate,
  });
};

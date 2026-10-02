import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

const get = (url, params) => async () => (await api.get(url, { params })).data;

export const useBooks = (params = {}) => useQuery({ queryKey: ["books", params], queryFn: get("/books", params) });
export const useBook = (id) => useQuery({ queryKey: ["book", id], queryFn: get(`/books/${id}`), enabled: !!id });
export const useOverview = () => useQuery({ queryKey: ["overview"], queryFn: get("/books/overview") });
export const useTaxonomy = (kind) => useQuery({ queryKey: ["taxonomy", kind], queryFn: get(`/taxonomy/${kind}`) });
export const useAuthors = () => useQuery({ queryKey: ["authors"], queryFn: get("/authors") });
export const useStats = (year) => useQuery({ queryKey: ["stats", year], queryFn: get("/stats", year ? { year } : {}) });
export const useSearch = (q, lang) =>
  useQuery({ queryKey: ["search", q, lang], queryFn: get("/search", { q, lang: lang || undefined }), enabled: q.trim().length > 1, staleTime: 5 * 60_000 });

const useInvalidate = () => {
  const qc = useQueryClient();
  return () => ["books", "book", "overview", "taxonomy", "authors", "stats"].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
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

export const useAddTaxonomy = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async ({ kind, name }) => (await api.post(`/taxonomy/${kind}`, { name })).data, onSuccess: invalidate });
};

export const useDeleteTaxonomy = () => {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: async ({ kind, name }) => (await api.delete(`/taxonomy/${kind}/${encodeURIComponent(name)}`)).data, onSuccess: invalidate });
};

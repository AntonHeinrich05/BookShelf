import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import "@/index.css";
import App from "@/App";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 1000 * 60 * 60 * 24 * 7,
      refetchOnWindowFocus: false,
      retry: (count, error) => {
        const status = error?.response?.status;
        return !(status >= 400 && status < 500) && count < 2;
      },
    },
  },
});

// Cache (books, search results, covers metadata) survives reloads → app opens instantly
const persister = createSyncStoragePersister({ storage: window.localStorage, key: "bs_query_cache", throttleTime: 1000 });

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7, buster: "v4", dehydrateOptions: { shouldDehydrateQuery: q => q.state.status === "success" && !["search", "job", "auth-config"].includes(q.queryKey[0]) } }}>
      <App />
    </PersistQueryClientProvider>
  </React.StrictMode>,
);

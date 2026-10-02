import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import AppShell from "@/components/layout/AppShell";
import { Splash } from "@/components/layout/Splash";
import AuthCallback from "@/pages/AuthCallback";
import LoginPage from "@/pages/LoginPage";
import LibraryPage from "@/pages/LibraryPage";
import BookListPage from "@/pages/BookListPage";
import BookDetailPage from "@/pages/BookDetailPage";
import SearchPage from "@/pages/SearchPage";
import AuthorsPage from "@/pages/AuthorsPage";
import CalendarPage from "@/pages/CalendarPage";
import StatsPage from "@/pages/StatsPage";
import SettingsPage from "@/pages/SettingsPage";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-canvas"><Splash /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected><AppShell /></Protected>}>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/books" element={<BookListPage />} />
        <Route path="/books/:id" element={<BookDetailPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/authors" element={<AuthorsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster position="top-center" theme={theme} richColors toastOptions={{ style: { borderRadius: 16 } }} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
          <ThemedToaster />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

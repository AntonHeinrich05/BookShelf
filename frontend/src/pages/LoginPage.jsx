import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, Library } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { errorMessage } from "@/lib/api";
import { PillButton } from "@/components/ios/Form";
import { cn } from "@/lib/utils";

const COVERS = [
  "https://covers.openlibrary.org/b/id/12659775-L.jpg",
  "https://covers.openlibrary.org/b/id/14407898-L.jpg",
  "https://covers.openlibrary.org/b/id/10865329-L.jpg",
];

const Field = ({ label, trailing, ...props }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-fg3">{label}</span>
    <span className="flex items-center rounded-xl bg-surface2 ring-tint/60 transition-shadow focus-within:ring-2">
      <input {...props} className="w-full bg-transparent px-4 py-3 text-[16px] text-fg outline-none placeholder:text-fg3" />
      {trailing}
    </span>
  </label>
);

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, "Anmeldung fehlgeschlagen"));
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="grid min-h-screen bg-canvas text-fg lg:grid-cols-2" data-testid="login-page">
      <section className="grain relative flex flex-col justify-between overflow-hidden bg-surface px-6 pb-10 pt-[max(2rem,env(safe-area-inset-top))] lg:px-14 lg:pb-14">
        <div className="anim-in flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-fg text-canvas"><Library size={18} /></span>
          <span className="font-display text-lg font-bold tracking-tight">BookShelf</span>
        </div>
        <div className="relative mt-10 h-48 lg:h-72">
          {COVERS.map((src, i) => (
            <img key={src} src={src} alt="" className={cn("anim-in absolute bottom-0 aspect-[2/3] w-28 rounded-md object-cover shadow-[0_20px_40px_rgba(0,0,0,0.45)] lg:w-44", i === 0 && "left-0 -rotate-6", i === 1 && "left-20 bottom-4 z-10 lg:left-32", i === 2 && "left-40 rotate-6 lg:left-64")} style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
        <div className="anim-in mt-8" style={{ animationDelay: "250ms" }}>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">Alles, was du liest.<br />An einem Ort.</h1>
          <p className="mt-4 max-w-md text-base text-fg2">Bibliothek, Autoren, Serien, Orte und ein Lesekalender mit Covern – dezent, clean und immer dabei.</p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-10 lg:px-14">
        <form onSubmit={submit} className="anim-in w-full max-w-sm space-y-4" style={{ animationDelay: "150ms" }} data-testid="login-form">
          <div className="inline-flex rounded-full bg-surface p-1" data-testid="auth-mode-toggle">
            {[["login", "Anmelden"], ["register", "Registrieren"]].map(([m, label]) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={cn("rounded-full px-5 py-2 text-sm font-medium transition-colors", mode === m ? "bg-fg text-canvas" : "text-fg2")} data-testid={`auth-mode-${m}`}>{label}</button>
            ))}
          </div>
          {mode === "register" && <Field label="Name" value={form.name} onChange={set("name")} placeholder="Lara" required data-testid="auth-name" />}
          <Field label="E-Mail" type="email" value={form.email} onChange={set("email")} placeholder="du@beispiel.de" required autoComplete="email" data-testid="auth-email" />
          <Field
            label="Passwort"
            type={showPw ? "text" : "password"}
            value={form.password}
            onChange={set("password")}
            placeholder="••••••••"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            data-testid="auth-password"
            trailing={
              <button type="button" onClick={() => setShowPw((s) => !s)} className="grid h-11 w-11 shrink-0 place-items-center text-fg2 transition-colors hover:text-fg" aria-label={showPw ? "Passwort verbergen" : "Passwort anzeigen"} data-testid="toggle-password">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
          <PillButton type="submit" disabled={busy} data-testid="auth-submit">{busy ? "Bitte warten…" : mode === "login" ? "Anmelden" : "Konto erstellen"}</PillButton>
          <div className="flex items-center gap-3 py-1 text-xs text-fg3"><span className="h-px flex-1 bg-line" />oder<span className="h-px flex-1 bg-line" /></div>
          <button type="button" onClick={googleLogin} className="flex w-full items-center justify-center gap-3 rounded-full border border-line bg-surface px-6 py-3.5 text-[16px] font-semibold transition-colors hover:bg-surface2 active:scale-[0.98]" data-testid="google-login-button">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.7-6c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
            Mit Google anmelden
          </button>
        </form>
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, Library } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useKeyboardViewport } from "@/hooks/useKeyboardViewport";
import { GoogleSignIn } from "@/components/auth/GoogleSignIn";
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
  useKeyboardViewport();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

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
    <div className="login-page bg-canvas text-fg" data-testid="login-page">
      <section className="login-brand relative lg:grain lg:flex lg:flex-col lg:justify-between lg:overflow-hidden lg:bg-surface lg:px-14 lg:pb-14">
        <div className="flex items-center gap-2.5" data-testid="login-brand">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-fg text-canvas"><Library size={18} /></span>
          <span className="font-display text-2xl font-bold" data-testid="login-brand-name">BookShelf</span>
        </div>
        <div className="relative mt-10 hidden h-72 lg:block">
          {COVERS.map((src, i) => (
            <img key={src} src={src} alt="" className={cn("anim-in absolute bottom-0 aspect-[2/3] w-28 rounded-md object-cover shadow-[0_20px_40px_rgba(0,0,0,0.45)] lg:w-44", i === 0 && "left-0 -rotate-6", i === 1 && "left-20 bottom-4 z-10 lg:left-32", i === 2 && "left-40 rotate-6 lg:left-64")} style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
        <div className="mt-8 hidden lg:block">
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">Alles, was du liest.<br />An einem Ort.</h1>
          <p className="mt-4 max-w-md text-base text-fg2">Bibliothek, Autoren, Serien, Orte und ein Lesekalender mit Covern – dezent, clean und immer dabei.</p>
        </div>
      </section>

      <section className="login-form-section">
        <form onSubmit={submit} className="w-full max-w-sm space-y-3" data-testid="login-form">
          <GoogleSignIn onSignedIn={() => navigate("/", { replace: true })} />
          <div className="flex items-center gap-3 py-1 text-xs text-fg2" data-testid="login-divider"><span className="h-px flex-1 bg-line" />oder mit E-Mail<span className="h-px flex-1 bg-line" /></div>
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
        </form>
      </section>
    </div>
  );
}

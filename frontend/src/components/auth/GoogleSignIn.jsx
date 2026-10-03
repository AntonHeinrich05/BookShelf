import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useAuthConfig } from "@/hooks/useBooks";
import { errorMessage } from "@/lib/api";

const GSI_SRC = "https://accounts.google.com/gsi/client";

/**
 * Google-Login über Google Identity Services (eigene OAuth-Client-ID, kein Drittanbieter).
 * Client-ID kommt vom Backend (/auth/config) – ohne ID wird ein Hinweis angezeigt.
 */
export function GoogleSignIn({ onSignedIn, theme = "filled_black" }) {
  const { googleLogin } = useAuth();
  const { data: cfg } = useAuthConfig();
  const clientId = cfg?.google_client_id;
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try {
            await googleLogin(credential);
            onSignedIn?.();
          } catch (err) {
            toast.error(errorMessage(err, "Google-Anmeldung fehlgeschlagen"));
          }
        },
      });
      ref.current.replaceChildren();
      window.google.accounts.id.renderButton(ref.current, { theme, size: "large", shape: "pill", text: "signin_with", width: 320, locale: "de" });
      setReady(true);
    };
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      if (window.google) render();
      else existing.addEventListener("load", render);
      return () => { cancelled = true; existing.removeEventListener("load", render); };
    }
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
    return () => { cancelled = true; };
  }, [clientId, googleLogin, onSignedIn, theme]);

  if (cfg && !clientId) {
    return <p className="text-center text-xs text-fg3" data-testid="google-not-configured">Google-Login ist noch nicht eingerichtet (GOOGLE_CLIENT_ID im Backend setzen).</p>;
  }
  return (
    <div className="flex min-h-[44px] justify-center" data-testid="google-login-button">
      <div ref={ref} />
      {!ready && clientId && <span className="text-xs text-fg3">Google wird geladen…</span>}
    </div>
  );
}

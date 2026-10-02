import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Splash } from "@/components/layout/Splash";

export default function AuthCallback() {
  const { exchangeSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const sessionId = new URLSearchParams(location.hash.replace(/^#/, "")).get("session_id");
    (async () => {
      try {
        await exchangeSession(sessionId);
        navigate("/", { replace: true });
      } catch {
        toast.error("Google-Anmeldung fehlgeschlagen");
        navigate("/login", { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-canvas">
      <Splash />
    </div>
  );
}

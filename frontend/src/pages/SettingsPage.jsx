import { useNavigate } from "react-router-dom";
import { LogOut, Moon, Share, Sun } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { Group, Row } from "@/components/ios/Group";
import { FormGroup, FormRow, Segmented } from "@/components/ios/Form";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

  return (
    <div data-testid="settings-page">
      <PageHeader back title="Einstellungen" />

      <div className="anim-in mb-8 flex items-center gap-4 rounded-2xl bg-surface p-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-surface2 font-display text-lg font-bold">
          {user.picture ? <img src={user.picture} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : user.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold" data-testid="settings-name">{user.name}</p>
          <p className="truncate text-sm text-fg2" data-testid="settings-email">{user.email}</p>
          <p className="mt-0.5 text-xs text-fg3">{user.auth_provider === "google" ? "Angemeldet mit Google" : "Angemeldet mit E-Mail"}</p>
        </div>
      </div>

      <h2 className="mb-3 px-1 font-display text-xl font-bold tracking-tight">Darstellung</h2>
      <FormGroup className="mb-8 anim-in">
        <FormRow label="Design">
          <Segmented value={theme} onChange={setTheme} options={[{ value: "dark", label: "Dunkel" }, { value: "light", label: "Hell" }]} testId="theme-toggle" />
        </FormRow>
      </FormGroup>

      {!isStandalone && (
        <Group title="Als App nutzen" testId="group-install">
          <div className="flex gap-4 px-4 py-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface2"><Share size={18} /></span>
            <div className="text-sm leading-relaxed text-fg2">
              <p className="font-semibold text-fg">iPhone & iPad</p>
              <p>In Safari auf <span className="text-fg">Teilen</span> tippen → <span className="text-fg">„Zum Home-Bildschirm"</span>. BookShelf öffnet sich dann wie eine echte App im Vollbild.</p>
              <p className="mt-2 font-semibold text-fg">Android</p>
              <p>Im Browser-Menü <span className="text-fg">„App installieren"</span> bzw. „Zum Startbildschirm hinzufügen" wählen.</p>
            </div>
          </div>
        </Group>
      )}

      <Group testId="group-logout">
        <Row icon={theme === "dark" ? Moon : Sun} label="Version" value="1.0" />
        <Row icon={LogOut} label="Abmelden" onClick={async () => { await logout(); navigate("/login", { replace: true }); }} iconClass="text-red-400" testId="logout-button" />
      </Group>
    </div>
  );
}

import { NavLink, useNavigate } from "react-router-dom";
import { CalendarDays, Library, Search, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Bücher", icon: Library, id: "tab-library" },
  { to: "/calendar", label: "Kalender", icon: CalendarDays, id: "tab-calendar" },
  { to: "/stats", label: "Statistiken", icon: TrendingUp, id: "tab-stats" },
];

export function TabBar() {
  const navigate = useNavigate();
  return (
    <nav className="app-nav inset-x-0 z-40 flex justify-center px-3 pointer-events-none" data-testid="tab-bar">
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="flex items-center gap-0.5 rounded-full border border-line bg-surface p-1 shadow-[0_4px_16px_rgba(0,0,0,0.2)]">
          {TABS.map(({ to, label, icon: Icon, id }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              data-testid={id}
              className={({ isActive }) =>
                cn(
                  "flex min-w-[68px] flex-col items-center justify-center gap-0.5 rounded-full px-3 py-2 transition-colors duration-200 active:scale-95",
                  isActive ? "bg-surface2 text-fg" : "text-fg2 hover:text-fg"
                )
              }
            >
              <Icon size={20} strokeWidth={2} />
              <span className="text-[11px] font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
        <button
          type="button"
          data-testid="tab-search"
          onClick={() => navigate("/search")}
          className="grid h-14 w-14 place-items-center rounded-full border border-line bg-surface text-fg shadow-[0_4px_16px_rgba(0,0,0,0.2)] transition-transform active:scale-95"
          aria-label="Entdecken"
        >
          <Search size={22} />
        </button>
      </div>
    </nav>
  );
}

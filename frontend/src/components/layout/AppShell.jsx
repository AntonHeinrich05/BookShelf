import { Outlet } from "react-router-dom";
import { createPortal } from "react-dom";
import { TabBar } from "./TabBar";
import { TimerBar } from "./TimerBar";
import { useKeyboardViewport } from "@/hooks/useKeyboardViewport";
import { useReadingTimer } from "@/context/ReadingTimerContext";

export default function AppShell() {
  useKeyboardViewport();
  const { timer } = useReadingTimer();
  const overlay = document.getElementById("app-overlay");
  return (
    <div className={`min-h-full bg-canvas text-fg${timer ? " has-timer" : ""}`} data-testid="app-shell">
      <main className="pb-tabbar mx-auto w-full max-w-lg px-4 sm:px-6 md:max-w-3xl lg:max-w-5xl">
        <Outlet />
      </main>
      {overlay && createPortal(<><TimerBar /><TabBar /></>, overlay)}
    </div>
  );
}

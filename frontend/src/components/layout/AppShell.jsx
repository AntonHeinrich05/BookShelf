import { Outlet } from "react-router-dom";
import { TabBar } from "./TabBar";
import { TimerBar } from "./TimerBar";
import { useKeyboardViewport } from "@/hooks/useKeyboardViewport";

export default function AppShell() {
  useKeyboardViewport();
  return (
    <div className="min-h-full bg-canvas text-fg">
      <main className="pb-tabbar mx-auto w-full max-w-lg px-4 sm:px-6 md:max-w-3xl lg:max-w-5xl">
        <Outlet />
      </main>
      <TimerBar />
      <TabBar />
    </div>
  );
}

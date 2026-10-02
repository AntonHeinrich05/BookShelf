import { Outlet } from "react-router-dom";
import { TabBar } from "./TabBar";

export default function AppShell() {
  return (
    <div className="min-h-screen bg-canvas text-fg">
      <main className="mx-auto w-full max-w-lg px-4 pb-36 pt-safe sm:px-6 md:max-w-3xl lg:max-w-5xl">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}

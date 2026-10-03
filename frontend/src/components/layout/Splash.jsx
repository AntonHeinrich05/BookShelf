import { Loader2 } from "lucide-react";

export function Splash() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-fg2" data-testid="splash">
      <Loader2 className="animate-spin" size={26} />
    </div>
  );
}

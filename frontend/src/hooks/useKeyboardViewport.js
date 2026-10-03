import { useEffect } from "react";

/**
 * Tastatur-Handling für iOS/Android-PWA:
 *  - setzt --kb (Höhe der eingeblendeten Tastatur) aus visualViewport, damit Sheets mitschrumpfen
 *  - scrollt das fokussierte Feld sichtbar in die Mitte
 *  - setzt nach dem Einklappen den Viewport zurück (kein "schwarzer Bereich", nichts bleibt verschoben)
 */
export function useKeyboardViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const standalone = window.matchMedia("(display-mode: standalone)");
    const setMode = () => root.classList.toggle("is-standalone", standalone.matches || !!window.navigator.standalone);
    setMode();
    standalone.addEventListener?.("change", setMode);
    const update = () => {
      if (!vv) return;
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.style.setProperty("--kb", `${kb < 60 ? 0 : kb}px`);
    };
    const onFocusIn = (e) => {
      const el = e.target;
      if (!(el instanceof HTMLElement) || !el.matches("input, textarea, select, [contenteditable]")) return;
      setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
    };
    const onFocusOut = () => {
      setTimeout(() => {
        if (document.activeElement && document.activeElement.matches("input, textarea, select")) return;
        root.style.setProperty("--kb", "0px");
        window.scrollTo(0, 0);
      }, 80);
    };
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    update();
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      standalone.removeEventListener?.("change", setMode);
    };
  }, []);
}

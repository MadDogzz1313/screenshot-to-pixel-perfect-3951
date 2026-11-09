import { useEffect, type RefObject } from "react";

/** Chat-Layout fürs iPhone: Container füllt exakt den sichtbaren Bereich (visualViewport) oberhalb der echten
 *  Navigationsleiste. Bei geöffneter Tastatur liegt die Leiste hinter der Tastatur – dann sitzt das Eingabefeld direkt darüber.
 *  Setzt --chat-vh, --chat-top, --chat-nav-h (genutzt von Community-Chat und Privatchat). */
export function useChatViewport(listRef: RefObject<HTMLDivElement | null>, stickRef: RefObject<boolean>) {
  useEffect(() => {
    const root = document.documentElement; const viewport = window.visualViewport;
    const navEl = document.querySelector<HTMLElement>("[data-testid='app-bottom-nav']");
    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      const keyboardOpen = window.innerHeight - height > 120;
      root.style.setProperty("--chat-vh", `${height}px`);
      root.style.setProperty("--chat-top", `${viewport?.offsetTop ?? 0}px`);
      root.style.setProperty("--chat-nav-h", `${keyboardOpen ? 0 : navEl?.offsetHeight ?? 0}px`);
      if (stickRef.current && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    };
    update();
    const observer = navEl ? new ResizeObserver(update) : null; if (navEl) observer?.observe(navEl);
    viewport?.addEventListener("resize", update); viewport?.addEventListener("scroll", update); window.addEventListener("resize", update);
    return () => { observer?.disconnect(); viewport?.removeEventListener("resize", update); viewport?.removeEventListener("scroll", update); window.removeEventListener("resize", update); ["--chat-vh", "--chat-top", "--chat-nav-h"].forEach((key) => root.style.removeProperty(key)); };
  }, []);
}

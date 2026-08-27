// Tema claro u oscuro. Por defecto sigue al sistema; si el usuario lo cambia, se guarda su elección.

import { useEffect, useState } from "react";

type Tema = "light" | "dark";
const CLAVE = "jondasiviz-tema";

function leerGuardado(): Tema | null {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === "light" || valor === "dark" ? valor : null;
  } catch {
    return null;
  }
}

function prefiereOscuro(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useTema() {
  const [tema, setTema] = useState<Tema | null>(() => leerGuardado());

  useEffect(() => {
    const raiz = document.documentElement;
    if (tema) raiz.setAttribute("data-theme", tema);
    else raiz.removeAttribute("data-theme");
  }, [tema]);

  const alternar = () => {
    setTema((actual) => {
      const base: Tema = actual ?? (prefiereOscuro() ? "dark" : "light");
      const siguiente: Tema = base === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(CLAVE, siguiente);
      } catch {
        // Si el navegador bloquea el almacenamiento, el tema dura solo esta sesión.
      }
      return siguiente;
    });
  };

  return { oscuro: tema ? tema === "dark" : prefiereOscuro(), alternar };
}

// Caja modal compartida por el acceso y la suscripción. El resto de la interfaz no usa
// diálogos, así que este es el único sitio que tiene que resolver foco y Escape.

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Icono } from "./icons";

interface Props {
  eyebrow: string;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  /** "grande" es para pantallas con varias secciones, como el perfil. */
  ancho?: "normal" | "grande";
}

export function Modal({ eyebrow, titulo, onCerrar, children, ancho = "normal" }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const primero = panelRef.current?.querySelector<HTMLElement>(
      "input, button:not(.modal-cerrar), select, [href]",
    );
    primero?.focus();

    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alTeclado);
    return () => document.removeEventListener("keydown", alTeclado);
  }, [onCerrar]);

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div
        className={"modal-panel" + (ancho === "grande" ? " modal-panel-grande" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        ref={panelRef}
      >
        <button type="button" className="modal-cerrar" onClick={onCerrar} aria-label="Cerrar">
          <Icono nombre="cerrar" />
        </button>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="modal-titulo">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}

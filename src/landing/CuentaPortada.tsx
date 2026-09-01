// Lo que se monta dentro de la portada: el avatar por un portal en `.nav-links`, y los
// modales sueltos donde caiga la raíz de React. Aparte de `cuenta-landing.tsx` para que
// ese fichero se quede como lo que es, un punto de arranque sin componentes propios.

import { createPortal } from "react-dom";
import { useCuenta } from "../cuenta/useCuenta";
import { AccesoModal } from "../ui/AccesoModal";
import { SuscripcionModal } from "../ui/SuscripcionModal";
import { PerfilModal } from "../ui/PerfilModal";
import { CuentaBarra } from "../ui/CuentaBarra";

export function CuentaPortada({ nav }: { nav: HTMLElement }) {
  const { modal } = useCuenta();
  return (
    <>
      {createPortal(<CuentaBarra />, nav)}
      <AccesoModal />
      <SuscripcionModal />
      {modal?.tipo === "perfil" && <PerfilModal />}
    </>
  );
}

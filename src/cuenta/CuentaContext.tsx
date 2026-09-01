// Estado de cuenta, compartido por toda la interfaz.
//
// Se pide una sola vez al arrancar (`/api/auth/yo`) y desde ahí vive en memoria: entrar,
// registrarse o salir actualiza este mismo estado, así que la barra, el formulario y el
// plan nunca pueden enseñar cosas distintas.
//
// Sin API (la app de escritorio sin servidor, o la web con el backend apagado) se cae al
// plan gratuito por defecto, que es exactamente lo que la API diría si contestara. Los
// límites y el precio salen de `src/suscripcion/planes.ts`, el mismo módulo que usa el
// servidor: es TypeScript puro, sin nada de Node, así que corre igual en el navegador.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { entrarCuenta, quienSoy, registrarCuenta, salirCuenta, type Acceso } from "./api";
import { LIMITES, PRECIO } from "../suscripcion/planes";
import { CuentaContexto, type EstadoCuenta, type Modal, type ValorCuenta } from "./contexto";

const ANONIMO: EstadoCuenta = {
  cargando: true,
  disponibleApi: false,
  usuario: null,
  plan: "gratis",
  limites: LIMITES.gratis,
  suscripcion: null,
  planesHoy: 0,
  precio: PRECIO,
};

function deAcceso(acceso: Acceso): EstadoCuenta {
  return {
    cargando: false,
    disponibleApi: true,
    usuario: acceso.usuario,
    plan: acceso.plan,
    limites: acceso.limites,
    suscripcion: acceso.suscripcion,
    planesHoy: acceso.planesHoy,
    precio: acceso.precio,
  };
}

export function CuentaProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoCuenta>(ANONIMO);
  const [modal, setModal] = useState<Modal>(null);
  const montado = useRef(true);

  const refrescar = useCallback(async () => {
    const acceso = await quienSoy();
    if (!montado.current) return;
    setEstado(acceso ? deAcceso(acceso) : { ...ANONIMO, cargando: false, disponibleApi: false });
  }, []);

  useEffect(() => {
    montado.current = true;
    void refrescar();
    return () => {
      montado.current = false;
    };
  }, [refrescar]);

  const entrar = useCallback(async (correo: string, contrasena: string) => {
    const resultado = await entrarCuenta(correo, contrasena);
    if (!resultado.ok) return resultado.error;
    setEstado(deAcceso(resultado.datos));
    setModal(null);
    return null;
  }, []);

  const registrar = useCallback(async (correo: string, contrasena: string) => {
    const resultado = await registrarCuenta(correo, contrasena);
    if (!resultado.ok) return resultado.error;
    setEstado(deAcceso(resultado.datos));
    setModal(null);
    return null;
  }, []);

  const salir = useCallback(async () => {
    await salirCuenta();
    if (!montado.current) return;
    setEstado({ ...ANONIMO, cargando: false, disponibleApi: estado.disponibleApi });
  }, [estado.disponibleApi]);

  const valor = useMemo<ValorCuenta>(
    () => ({
      ...estado,
      entrar,
      registrar,
      salir,
      refrescar,
      modal,
      abrirAcceso: (modo = "entrar") => setModal({ tipo: "acceso", modo }),
      abrirSuscripcion: (motivo = null) => setModal({ tipo: "suscripcion", motivo }),
      cerrarModal: () => setModal(null),
    }),
    [estado, entrar, registrar, salir, refrescar, modal],
  );

  return <CuentaContexto.Provider value={valor}>{children}</CuentaContexto.Provider>;
}

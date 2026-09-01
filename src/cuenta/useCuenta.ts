import { useContext } from "react";
import { CuentaContexto, type ValorCuenta } from "./contexto";

/** Estado de cuenta y acciones (entrar, registrar, salir, abrir los modales). */
export function useCuenta(): ValorCuenta {
  const valor = useContext(CuentaContexto);
  if (!valor) throw new Error("useCuenta se usa dentro de <CuentaProvider>.");
  return valor;
}

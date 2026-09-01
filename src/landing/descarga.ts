// Boton de descarga de la portada.
//
// No apunta a un archivo fijo: el nombre del instalador que genera Tauri lleva
// dentro el numero de version ("Jondasiviz Build Planner_0.1.2_x64_en-US.msi"),
// asi que una URL escrita a mano se rompe en cuanto se publica una version
// nueva. En vez de eso se pregunta a GitHub cual es la ultima release y se
// coge de ahi el instalador que toca.
//
// Si algo falla (sin conexion, sin releases todavia, limite de la API) el
// enlace sigue llevando a la pagina de descargas, que es lo que ya hacia antes.

const REPO = "JondaSivizVolkswagen/jondasiviz";
const RELEASES = `https://github.com/${REPO}/releases/latest`;

interface Recurso {
  name: string;
  browser_download_url: string;
  size: number;
}

interface Publicacion {
  tag_name: string;
  assets: Recurso[];
}

/** Plataforma del visitante, para etiquetar el boton con lo que le sirve. */
type Plataforma = "windows" | "mac" | "linux";

function plataforma(): Plataforma {
  const ua = navigator.userAgent;
  if (/Mac|iPhone|iPad/.test(ua)) return "mac";
  if (/Linux|Android/.test(ua) && !/Windows/.test(ua)) return "linux";
  return "windows";
}

/**
 * Extensiones de instalador por plataforma, en orden de preferencia.
 *
 * En Windows va primero el instalador NSIS (`-setup.exe`) y no el .msi. El NSIS se
 * instala solo para el usuario actual, asi que no pide elevacion y el sistema no
 * enseña el aviso de UAC con "Editor desconocido". El .msi instala para toda la
 * maquina y si la pide. Los dos siguen sin firmar, asi que SmartScreen avisa igual,
 * pero al menos es un aviso y no dos. El .msi se mantiene como alternativa para
 * quien despliegue por directiva de grupo.
 */
const EXTENSIONES: Record<Plataforma, string[]> = {
  windows: ["-setup.exe", ".msi", ".exe"],
  mac: ["aarch64.dmg", ".dmg"],
  linux: [".appimage", ".deb"],
};

const ETIQUETA: Record<Plataforma, string> = {
  windows: "Descargar para Windows",
  mac: "Descargar para macOS",
  linux: "Descargar para Linux",
};

function instalador(publicacion: Publicacion, para: Plataforma): Recurso | null {
  for (const extension of EXTENSIONES[para]) {
    const encontrado = publicacion.assets.find((a) => a.name.toLowerCase().endsWith(extension));
    if (encontrado) return encontrado;
  }
  return null;
}

function pesoLegible(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function arrancar() {
  const boton = document.querySelector<HTMLAnchorElement>("[data-descarga]");
  const nota = document.querySelector<HTMLElement>("[data-descarga-nota]");
  if (!boton) return;

  // Dentro de la propia aplicacion de escritorio el bloque no pinta nada: ya la
  // tienes instalada. Se quita la seccion y, con ella, su enlace de la barra, que
  // si no se quedaria apuntando a un ancla que ya no existe.
  const enTauri = "__TAURI__" in window || "__TAURI_INTERNALS__" in window;
  if (enTauri) {
    const seccion = boton.closest("section");
    if (seccion?.id) {
      document.querySelector(`.nav-links a[href="#${seccion.id}"]`)?.remove();
    }
    seccion?.remove();
    return;
  }

  const para = plataforma();
  const texto = boton.querySelector("span");
  if (texto) texto.textContent = ETIQUETA[para];

  let resuelto: Recurso | null = null;

  const buscar = async (): Promise<Recurso | null> => {
    const respuesta = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!respuesta.ok) throw new Error(`GitHub respondió ${respuesta.status}`);
    const publicacion: Publicacion = await respuesta.json();
    const recurso = instalador(publicacion, para);
    if (nota) {
      nota.textContent = recurso
        ? `Versión ${publicacion.tag_name} · ${pesoLegible(recurso.size)} · ${recurso.name}`
        : `Versión ${publicacion.tag_name}, pero todavía no hay binario para tu sistema.`;
    }
    return recurso;
  };

  // Se intenta al cargar, sin bloquear nada: si sale, el boton ya lleva el
  // archivo puesto y el clic es una descarga directa.
  void buscar()
    .then((recurso) => {
      resuelto = recurso;
      if (recurso) {
        boton.href = recurso.browser_download_url;
        boton.setAttribute("download", "");
      }
    })
    .catch(() => {
      if (nota) nota.textContent = "";
    });

  boton.addEventListener("click", (e) => {
    if (resuelto) return; // ya apunta al instalador, que siga su camino

    // Todavia no habia respuesta: se busca ahora y se avisa mientras tanto.
    e.preventDefault();
    const original = texto?.textContent ?? "";
    if (texto) texto.textContent = "Buscando la última versión…";

    void buscar()
      .then((recurso) => {
        if (recurso) {
          window.location.href = recurso.browser_download_url;
          if (texto) texto.textContent = original;
        } else {
          window.open(RELEASES, "_blank", "noopener");
          if (texto) texto.textContent = original;
        }
      })
      .catch(() => {
        if (texto) texto.textContent = original;
        if (nota) nota.textContent = "No se pudo consultar GitHub. Abre la página de descargas.";
        window.open(RELEASES, "_blank", "noopener");
      });
  });
}

arrancar();

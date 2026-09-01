// Visor 3D de la portada: plato giratorio, luz de estudio y el Civic del 98.
//
// Vive fuera de src/ui/ a proposito. La portada es HTML plano sin React (asi
// quien solo mira la portada no se descarga el bundle de la app), y este
// modulo es lo unico que carga three. El planner no lo toca.

import * as THREE from "three";
import { crearCivic } from "./modelo-ek";
import "./landing.css";

const PINTURAS: Record<string, number> = {
  rojo: 0xb4141b,
  blanco: 0xd8dbdd,
  negro: 0x121417,
  amarillo: 0xd9a626,
  azul: 0x1d4f8c,
};

/** Angulo fijo de la camara alrededor del plato. El que gira es el coche. */
const AZIMUT = 0.55;

/**
 * Vistas fijas. El giro esta calculado contra AZIMUT: con la camara en 0,55 rad,
 * el lateral limpio cae en -2,59 y el frontal en -1,02. Si se mueve AZIMUT hay
 * que recalcular estos tres numeros o las vistas dejan de estar encuadradas.
 */
const VISTAS: Record<string, { giro: number; inclinacion: number; dist: number }> = {
  tresCuartos: { giro: -1.75, inclinacion: 0.06, dist: 7.4 },
  lateral: { giro: -2.59, inclinacion: 0.02, dist: 6.9 },
  frontal: { giro: -1.02, inclinacion: 0.05, dist: 6.4 },
  cenital: { giro: -1.75, inclinacion: 0.52, dist: 7.8 },
};

/**
 * Un plato de fotografia pintado en un canvas: dos pantallas de luz arriba,
 * suelo oscuro y un rebote rojo a un lado. Convertido en mapa de entorno es lo
 * que hace que la chapa parezca chapa; sin el, el metal se ve como plastico.
 */
function entornoPlato(renderer: THREE.WebGLRenderer): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const g = c.getContext("2d");
  if (!g) throw new Error("Sin contexto 2d para el mapa de entorno");

  const cielo = g.createLinearGradient(0, 0, 0, 512);
  cielo.addColorStop(0, "#3a4048");
  cielo.addColorStop(0.48, "#171a1e");
  cielo.addColorStop(0.52, "#0a0b0d");
  cielo.addColorStop(1, "#060708");
  g.fillStyle = cielo;
  g.fillRect(0, 0, 1024, 512);

  const foco = (x: number, y: number, w: number, h: number, fuerza: number) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, Math.max(w, h));
    rg.addColorStop(0, `rgba(255,255,255,${fuerza})`);
    rg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = rg;
    g.fillRect(x - w, y - h, w * 2, h * 2);
  };
  foco(250, 120, 260, 130, 0.95);
  foco(760, 90, 220, 110, 0.8);
  foco(520, 200, 160, 70, 0.35);

  const rebote = g.createRadialGradient(60, 260, 0, 60, 260, 240);
  rebote.addColorStop(0, "rgba(227,18,28,0.55)");
  rebote.addColorStop(1, "rgba(227,18,28,0)");
  g.fillStyle = rebote;
  g.fillRect(0, 20, 300, 480);

  const textura = new THREE.CanvasTexture(c);
  textura.mapping = THREE.EquirectangularReflectionMapping;
  textura.colorSpace = THREE.SRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const destino = pmrem.fromEquirectangular(textura);
  textura.dispose();
  pmrem.dispose();
  return destino.texture;
}

function arrancar(contenedor: HTMLElement) {
  const ancho = () => contenedor.clientWidth;
  const alto = () => contenedor.clientHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(ancho(), alto());
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  contenedor.appendChild(renderer.domElement);

  const escena = new THREE.Scene();
  escena.environment = entornoPlato(renderer);

  const camara = new THREE.PerspectiveCamera(32, ancho() / alto(), 0.1, 100);
  const mira = new THREE.Vector3(0, 0.66, 0);

  const { coche, materiales } = crearCivic(PINTURAS.rojo);
  escena.add(coche);

  // Plato y aros del suelo.
  const plato = new THREE.Mesh(
    new THREE.CircleGeometry(3.9, 80),
    // Mate y oscuro. Con metalness alta el rebote rojo del entorno lo encendia
    // entero y el coche se perdia encima de una mancha rosa.
    new THREE.MeshStandardMaterial({ color: 0x090a0c, metalness: 0.2, roughness: 0.58 }),
  );
  plato.rotation.x = -Math.PI / 2;
  plato.receiveShadow = true;
  escena.add(plato);

  const aroRojo = new THREE.Mesh(
    new THREE.TorusGeometry(2.85, 0.006, 8, 140),
    new THREE.MeshBasicMaterial({ color: 0xe3121c }),
  );
  aroRojo.rotation.x = -Math.PI / 2;
  aroRojo.position.y = 0.002;
  escena.add(aroRojo);

  const aroGris = new THREE.Mesh(
    new THREE.TorusGeometry(3.55, 0.004, 8, 140),
    new THREE.MeshBasicMaterial({ color: 0x2a2f36 }),
  );
  aroGris.rotation.x = -Math.PI / 2;
  aroGris.position.y = 0.002;
  escena.add(aroGris);

  // Tres puntos de luz: clave blanca con sombra, contra rojo detras y relleno
  // frio delante. Solo direccionales y hemisferio, que son los que no cambiaron
  // de escala con el modo de luces fisicas de three.
  escena.add(new THREE.HemisphereLight(0x9fb4d8, 0x050607, 0.34));

  const clave = new THREE.DirectionalLight(0xffffff, 2.5);
  clave.position.set(4.2, 6.2, 5.0);
  clave.castShadow = true;
  clave.shadow.mapSize.set(2048, 2048);
  clave.shadow.camera.near = 1;
  clave.shadow.camera.far = 22;
  clave.shadow.camera.left = -5;
  clave.shadow.camera.right = 5;
  clave.shadow.camera.top = 5;
  clave.shadow.camera.bottom = -5;
  clave.shadow.bias = -0.0006;
  clave.shadow.radius = 3;
  escena.add(clave);

  const contra = new THREE.DirectionalLight(0xff2f22, 0.95);
  contra.position.set(-5.5, 2.8, -4.4);
  escena.add(contra);

  const relleno = new THREE.DirectionalLight(0x7ba0ff, 0.75);
  relleno.position.set(-3.4, 1.6, 5.2);
  escena.add(relleno);

  // --- Interaccion ------------------------------------------------------
  let giro = -1.75;
  let giroObjetivo = -1.75;
  let inclinacion = 0.06;
  let inclinacionObjetivo = 0.06;
  let distancia = 10.8;
  let distanciaObjetivo = 7.4;
  let velocidad = 0;
  let arrastrando = false;
  let ultimoX = 0;
  let ultimoY = 0;
  let ocioso = 0;
  let entrada = 0;

  const lienzo = renderer.domElement;

  lienzo.addEventListener("pointerdown", (e) => {
    arrastrando = true;
    ultimoX = e.clientX;
    ultimoY = e.clientY;
    lienzo.setPointerCapture(e.pointerId);
  });

  lienzo.addEventListener("pointermove", (e) => {
    if (!arrastrando) return;
    const dx = e.clientX - ultimoX;
    const dy = e.clientY - ultimoY;
    ultimoX = e.clientX;
    ultimoY = e.clientY;
    giroObjetivo += dx * 0.0075;
    inclinacionObjetivo = Math.max(-0.12, Math.min(0.55, inclinacionObjetivo + dy * 0.0035));
    velocidad = dx * 0.0075;
    ocioso = 0;
  });

  const soltar = (e: PointerEvent) => {
    arrastrando = false;
    if (lienzo.hasPointerCapture(e.pointerId)) lienzo.releasePointerCapture(e.pointerId);
  };
  lienzo.addEventListener("pointerup", soltar);
  lienzo.addEventListener("pointercancel", soltar);

  lienzo.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      distanciaObjetivo = Math.max(4.6, Math.min(11, distanciaObjetivo + e.deltaY * 0.0035));
      ocioso = 0;
    },
    { passive: false },
  );

  // --- Mandos de la portada --------------------------------------------
  const pintar = (hex: number) => {
    const destino = new THREE.Color(hex);
    const desde = materiales.chapa.color.clone();
    const inicio = performance.now();
    const paso = () => {
      const t = Math.min(1, (performance.now() - inicio) / 420);
      materiales.chapa.color.copy(desde).lerp(destino, t * t * (3 - 2 * t));
      if (t < 1) requestAnimationFrame(paso);
    };
    paso();
  };

  document.querySelectorAll<HTMLButtonElement>(".pintura").forEach((boton) => {
    boton.addEventListener("click", () => {
      const nombre = boton.dataset.pintura ?? "rojo";
      document
        .querySelectorAll(".pintura")
        .forEach((otro) => otro.setAttribute("aria-pressed", "false"));
      boton.setAttribute("aria-pressed", "true");
      pintar(PINTURAS[nombre] ?? PINTURAS.rojo);
    });
  });

  document.querySelectorAll<HTMLElement>("[data-vista]").forEach((boton) => {
    boton.addEventListener("click", (e) => {
      e.preventDefault();
      const v = VISTAS[boton.dataset.vista ?? ""];
      if (!v) return;
      giroObjetivo = v.giro;
      inclinacionObjetivo = v.inclinacion;
      distanciaObjetivo = v.dist;
      velocidad = 0;
      // Negativo a proposito: da unos segundos para mirar la vista antes de
      // que el plato vuelva a girar solo.
      ocioso = -240;
    });
  });

  // --- Bucle ------------------------------------------------------------
  const medir = () => {
    renderer.setSize(ancho(), alto());
    camara.aspect = ancho() / alto();
    camara.updateProjectionMatrix();
  };
  window.addEventListener("resize", medir);

  const animar = () => {
    requestAnimationFrame(animar);

    if (entrada < 1) {
      // Aparicion: el coche entra girando mientras la camara se acerca.
      entrada = Math.min(1, entrada + 0.008);
      const e = 1 - Math.pow(1 - entrada, 3);
      giroObjetivo = -1.75 - (1 - e) * 1.6;
      distancia += (7.4 + (1 - e) * 3.4 - distancia) * 0.08;
    } else {
      distancia += (distanciaObjetivo - distancia) * 0.08;
      if (!arrastrando) {
        ocioso++;
        if (ocioso > 150) giroObjetivo += 0.0018;
        velocidad *= 0.94;
        giroObjetivo += velocidad;
      }
    }

    giro += (giroObjetivo - giro) * 0.1;
    inclinacion += (inclinacionObjetivo - inclinacion) * 0.08;

    coche.rotation.y = giro;
    aroRojo.rotation.z = giro * 0.4;

    camara.position.set(
      Math.sin(AZIMUT) * distancia,
      0.9 + inclinacion * 6.5,
      Math.cos(AZIMUT) * distancia,
    );
    camara.lookAt(mira);

    renderer.render(escena, camara);
  };

  medir();
  animar();
}

// --- Arranque -----------------------------------------------------------
const escena = document.getElementById("escena");
if (escena) {
  try {
    arrancar(escena);
  } catch (error) {
    // Sin WebGL (maquina vieja, driver capado, navegador en modo seguro) la
    // portada no se rompe: se queda la silueta de repuesto que ya esta en el
    // HTML y todo lo demas sigue funcionando.
    console.warn("No se pudo arrancar el visor 3D:", error);
    escena.classList.add("sin-3d");
  }
}

// Revelado por scroll y barra de progreso de lectura.
const observador = new IntersectionObserver(
  (entradas) => {
    for (const en of entradas) {
      if (en.isIntersecting) {
        en.target.classList.add("visible");
        observador.unobserve(en.target);
      }
    }
  },
  { threshold: 0.12 },
);
document.querySelectorAll(".revela").forEach((n) => observador.observe(n));

const progreso = document.querySelector<HTMLElement>(".progreso");
if (progreso) {
  const alScroll = () => {
    const raiz = document.documentElement;
    const recorrido = raiz.scrollHeight - raiz.clientHeight;
    progreso.style.width = recorrido > 0 ? `${(raiz.scrollTop / recorrido) * 100}%` : "0%";
  };
  alScroll();
  document.addEventListener("scroll", alScroll, { passive: true });
}

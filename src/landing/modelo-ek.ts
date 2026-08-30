// Honda Civic EK · 1998 · tres puertas.
//
// La carroceria NO es un perfil extruido: es un casco lofteado. Se describe el
// coche por secciones transversales a lo largo del eje X (como se describe un
// casco de barco, o una carroceria en el taller de chapa) y luego se cose una
// malla entre seccion y seccion. Eso es lo que da los costados abombados, el
// morro que se estrecha, la caida del techo hacia dentro y unos pasos de rueda
// que son huecos de verdad, no un arco pintado.
//
// Medidas de fabrica del EK de tres puertas:
//   largo 4180 · ancho 1695 · alto 1355 · batalla 2620
// Aqui van en metros, con el coche mirando a +X, el suelo en y = 0 y el ancho
// por Z. Ruedas 195/50 R15 (radio 0,29) con la altura bajada un dedo.
//
// No hay ningun .glb: un modelo descargado decente son varios megas y una
// licencia que vigilar, y esta malla pesa lo que pesa este archivo.

import * as THREE from "three";

export const LARGO = 4.18;
export const ANCHO = 1.695;
const EJE_DEL = 1.29;
const EJE_TRA = -1.33;
const R_RUEDA = 0.29;
const MEDIO_ANCHO = ANCHO / 2;

/** Materiales que la escena necesita tocar en vivo. */
export interface MaterialesCoche {
  chapa: THREE.MeshStandardMaterial;
}

// ==========================================================================
// Curvas maestras
// ==========================================================================
// Cada una es una tabla [x, valor] ordenada de cola a morro. Entre puntos se
// interpola con coseno. Mover un numero de aqui cambia la forma del coche sin
// tocar una sola linea de malla.

type Curva = [number, number][];

/** Linea de arriba: porton, luneta, techo, parabrisas y capo. */
const Y_ALTO: Curva = [
  [-2.09, 0.7],
  [-2.05, 0.79],
  [-1.95, 0.875],
  [-1.82, 0.935],
  [-1.7, 0.985],
  [-1.55, 1.06],
  [-1.4, 1.14],
  [-1.2, 1.225],
  [-1.0, 1.29],
  [-0.86, 1.335],
  [-0.6, 1.352],
  [-0.2, 1.355],
  [0.1, 1.345],
  [0.34, 1.313],
  [0.55, 1.24],
  [0.75, 1.13],
  [0.88, 1.0],
  [0.95, 0.945],
  [1.1, 0.935],
  [1.4, 0.915],
  [1.7, 0.885],
  [1.9, 0.845],
  [2.0, 0.8],
  [2.06, 0.75],
  [2.09, 0.7],
];

/**
 * Borde de abajo. Entre ejes es el faldon, y sobre cada eje sube dibujando el
 * hueco del paso de rueda. Como el casco se cose siguiendo esta linea, los
 * pasos son aberturas de verdad: se ve el interior de la aleta por detras del
 * neumatico.
 */
const Y_BAJO: Curva = [
  [-2.09, 0.40],
  [-2.02, 0.30],
  [-1.9, 0.25],
  [-1.76, 0.235],
  [-1.72, 0.36],
  [-1.62, 0.52],
  [-1.47, 0.60],
  [-1.33, 0.625],
  [-1.19, 0.60],
  [-1.04, 0.52],
  [-0.94, 0.36],
  [-0.9, 0.19],
  [0.88, 0.19],
  [0.92, 0.36],
  [1.02, 0.52],
  [1.15, 0.60],
  [1.29, 0.625],
  [1.43, 0.60],
  [1.58, 0.52],
  [1.68, 0.36],
  [1.72, 0.24],
  [1.9, 0.235],
  [2.02, 0.3],
  [2.09, 0.40],
];

/** Semianchura en el hombro, donde el coche es mas ancho. */
const W_MAX: Curva = [
  [-2.09, 0.71],
  [-2.02, 0.765],
  [-1.92, 0.80],
  [-1.78, 0.825],
  [-1.6, 0.838],
  [-1.2, 0.8475],
  [0.6, 0.8475],
  [1.1, 0.845],
  [1.45, 0.835],
  [1.7, 0.82],
  [1.88, 0.805],
  [2.0, 0.78],
  [2.06, 0.745],
  [2.09, 0.70],
];

/** Semianchura arriba del todo: techo en la cabina, capo y porton fuera. */
const W_ALTO: Curva = [
  [-2.09, 0.52],
  [-2.02, 0.6],
  [-1.92, 0.645],
  [-1.78, 0.67],
  [-1.6, 0.68],
  [-1.3, 0.695],
  [-1.0, 0.665],
  [-0.86, 0.645],
  [-0.4, 0.645],
  [0.1, 0.64],
  [0.34, 0.632],
  [0.6, 0.665],
  [0.8, 0.705],
  [0.95, 0.735],
  [1.3, 0.75],
  [1.7, 0.735],
  [1.9, 0.7],
  [2.0, 0.655],
  [2.09, 0.56],
];

function enCurva(curva: Curva, x: number): number {
  if (x <= curva[0][0]) return curva[0][1];
  const ultimo = curva[curva.length - 1];
  if (x >= ultimo[0]) return ultimo[1];
  for (let i = 1; i < curva.length; i++) {
    const [x1, v1] = curva[i];
    if (x <= x1) {
      const [x0, v0] = curva[i - 1];
      const t = (x - x0) / (x1 - x0);
      // Coseno en vez de recta: sin esto se ven las aristas de la tabla.
      const s = 0.5 - Math.cos(t * Math.PI) / 2;
      return v0 + (v1 - v0) * s;
    }
  }
  return ultimo[1];
}

/**
 * Linea de cintura: el borde de abajo del cristal en la cabina y, fuera de
 * ella, la cresta de la aleta. Sin esa cresta el capo y el guardabarros salen
 * como una sola plancha con el canto vivo, que es justo lo que no hace ningun
 * coche.
 */
function cintura(alto: number): number {
  return Math.min(alto - 0.07, 0.95);
}

// ==========================================================================
// Secciones
// ==========================================================================

type Punto = [number, number]; // [z, y]

/** Chaikin: redondea las esquinas de un tramo sin mover sus extremos. */
function suavizar(pts: Punto[], pasadas: number): Punto[] {
  let salida = pts;
  for (let p = 0; p < pasadas; p++) {
    const nueva: Punto[] = [salida[0]];
    for (let i = 0; i < salida.length - 1; i++) {
      const [z0, y0] = salida[i];
      const [z1, y1] = salida[i + 1];
      nueva.push([z0 * 0.75 + z1 * 0.25, y0 * 0.75 + y1 * 0.25]);
      nueva.push([z0 * 0.25 + z1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    nueva.push(salida[salida.length - 1]);
    salida = nueva;
  }
  return salida;
}

/**
 * Suaviza la seccion respetando las aristas vivas.
 *
 * Un coche no es una pastilla de jabon: tiene lineas. La de cintura y el canto
 * del techo son aristas, y si se pasa Chaikin por encima de toda la seccion se
 * redondean y el coche pierde el dibujo. Aqui la seccion se parte por esos
 * puntos, se suaviza cada tramo por separado y se vuelve a unir: las curvas
 * salen curvas y las aristas siguen siendo aristas.
 */
function suavizarConAristas(pts: Punto[], aristas: number[], pasadas: number): Punto[] {
  const cortes = [0, ...aristas.filter((i) => i > 0 && i < pts.length - 1), pts.length - 1];
  const salida: Punto[] = [];
  for (let t = 0; t < cortes.length - 1; t++) {
    const tramo = suavizar(pts.slice(cortes[t], cortes[t + 1] + 1), pasadas);
    salida.push(...(t === 0 ? tramo : tramo.slice(1)));
  }
  return salida;
}

/** Reparte n puntos por la polilinea, a distancias iguales. */
function repartir(pts: Punto[], n: number): Punto[] {
  const largos: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    largos.push(largos[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = largos[largos.length - 1] || 1;
  const salida: Punto[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const objetivo = (total * k) / (n - 1);
    while (j < largos.length - 1 && largos[j] < objetivo) j++;
    const tramo = largos[j] - largos[j - 1] || 1;
    const t = (objetivo - largos[j - 1]) / tramo;
    salida.push([
      pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * t,
      pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * t,
    ]);
  }
  return salida;
}

const POR_SECCION = 26; // puntos de media seccion

/**
 * Media seccion transversal en una estacion X: del centro de los bajos, por el
 * costado, hasta el centro del techo. La otra mitad es su espejo.
 */
function mediaSeccion(x: number): Punto[] {
  const bajo = enCurva(Y_BAJO, x);
  const alto = enCurva(Y_ALTO, x);
  const wMax = enCurva(W_MAX, x);
  const wAlto = enCurva(W_ALTO, x);
  const belt = cintura(alto);

  const pts: Punto[] = [
    [0, bajo],
    [wMax * 0.55, bajo],
    [wMax * 0.93, bajo + (belt - bajo) * 0.16],
    [wMax * 0.995, bajo + (belt - bajo) * 0.46],
    [wMax, belt - (belt - bajo) * 0.12],
    [wMax * 0.988, belt], // arista: linea de cintura
  ];
  const aristaCintura = pts.length - 1;

  // Si en esta estacion hay invernadero, el costado se mete hacia dentro al
  // subir. Esa caida es lo que hace que parezca un coche y no una caja. Fuera
  // de la cabina, los mismos dos puntos dibujan la cresta de la aleta.
  if (alto - belt > 0.03) {
    pts.push([wAlto + (wMax - wAlto) * 0.55, belt + (alto - belt) * 0.34]);
    pts.push([wAlto + (wMax - wAlto) * 0.12, belt + (alto - belt) * 0.78]);
  }
  pts.push([wAlto, alto - (alto - belt) * 0.06]); // arista: canto del techo
  const aristaTecho = pts.length - 1;
  pts.push([wAlto * 0.88, alto]);
  pts.push([0, alto]);

  return repartir(suavizarConAristas(pts, [aristaCintura, aristaTecho], 2), POR_SECCION);
}

/** Semianchura del coche a una altura dada. Sirve para pegar detalles. */
function anchoEn(x: number, yPedida: number): number {
  const media = mediaSeccion(x);
  // Si la altura pedida cae fuera de la seccion (por ejemplo a la altura del
  // eje, donde el hueco del paso de rueda se ha comido la carroceria) hay que
  // pegarse al borde. Antes devolvia 0, o sea el centro del coche, y la pieza
  // aparecia flotando en mitad de los bajos.
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, py] of media) {
    minY = Math.min(minY, py);
    maxY = Math.max(maxY, py);
  }
  const y = Math.min(maxY, Math.max(minY, yPedida));

  let mejor = media[0][0];
  for (let i = 1; i < media.length; i++) {
    const [z0, y0] = media[i - 1];
    const [z1, y1] = media[i];
    if ((y0 - y) * (y1 - y) <= 0 && y0 !== y1) {
      const t = (y - y0) / (y1 - y0);
      mejor = Math.max(mejor, z0 + (z1 - z0) * t);
    }
  }
  return mejor;
}

// ==========================================================================
// Casco
// ==========================================================================

const CHAPA = 0;
const CRISTAL = 1;
const OSCURO = 2;

/** Que es cada trozo del casco: chapa, cristal o bajos. */
function materialDe(x: number, y: number, zAbs: number, wMax: number): number {
  if (y < 0.3 && zAbs < wMax * 0.55) return OSCURO;

  const alto = enCurva(Y_ALTO, x);
  const belt = cintura(alto);
  if (y <= belt + 0.012) return CHAPA;

  const r = zAbs / Math.max(wMax, 0.001);

  // Techo: la franja de arriba del todo en el tramo donde el techo es plano.
  // Se mira la ALTURA, no la anchura. Con la anchura fallaba: el techo del EK
  // cae en z/wMax = 0.76, asi que cualquier umbral por debajo de eso pintaba
  // el techo entero de cristal.
  if (x > -0.9 && x < 0.34 && y >= alto - 0.07) return CHAPA;
  // Montante B, entre la puerta y la ventanilla de atras.
  if (x > -0.34 && x < -0.2) return CHAPA;
  // Montantes A y C: los bordes del parabrisas y de la luneta.
  if (x >= 0.34 && x < 0.96 && r > 0.72) return CHAPA;
  if (x > -1.6 && x <= -0.9 && r > 0.72) return CHAPA;
  // Capo y porton, fuera del invernadero.
  if (x >= 0.96 || x <= -1.6) return CHAPA;

  return CRISTAL;
}

function cascoCarroceria(): THREE.BufferGeometry {
  const ESTACIONES = 108;
  const secciones: Punto[][] = [];
  const equis: number[] = [];

  for (let i = 0; i < ESTACIONES; i++) {
    const x = 2.09 - (LARGO * i) / (ESTACIONES - 1);
    equis.push(x);
    secciones.push(mediaSeccion(x));
  }

  // Anillo completo = media seccion mas su espejo, sin repetir los extremos.
  const porAnillo = POR_SECCION * 2 - 2;
  const posiciones: number[] = [];

  for (let i = 0; i < ESTACIONES; i++) {
    const x = equis[i];
    const media = secciones[i];
    for (let j = 0; j < POR_SECCION; j++) posiciones.push(x, media[j][1], media[j][0]);
    for (let j = POR_SECCION - 2; j >= 1; j--) posiciones.push(x, media[j][1], -media[j][0]);
  }

  // Los indices se agrupan por material para poder pintar cada zona con el
  // suyo dentro de una sola malla.
  const grupos: number[][] = [[], [], []];

  for (let i = 0; i < ESTACIONES - 1; i++) {
    const x = (equis[i] + equis[i + 1]) / 2;
    const wMax = enCurva(W_MAX, x);
    for (let j = 0; j < porAnillo; j++) {
      const j2 = (j + 1) % porAnillo;
      const a = i * porAnillo + j;
      const b = i * porAnillo + j2;
      const c = (i + 1) * porAnillo + j2;
      const d = (i + 1) * porAnillo + j;

      const y =
        (posiciones[a * 3 + 1] +
          posiciones[b * 3 + 1] +
          posiciones[c * 3 + 1] +
          posiciones[d * 3 + 1]) /
        4;
      const zAbs =
        (Math.abs(posiciones[a * 3 + 2]) +
          Math.abs(posiciones[b * 3 + 2]) +
          Math.abs(posiciones[c * 3 + 2]) +
          Math.abs(posiciones[d * 3 + 2])) /
        4;

      grupos[materialDe(x, y, zAbs, wMax)].push(a, b, c, a, c, d);
    }
  }

  // Tapas del morro y de la cola, en abanico hacia el centro del anillo.
  for (const extremo of [0, ESTACIONES - 1]) {
    const base = extremo * porAnillo;
    let cy = 0;
    for (let j = 0; j < porAnillo; j++) cy += posiciones[(base + j) * 3 + 1];
    cy /= porAnillo;
    const centro = posiciones.length / 3;
    posiciones.push(equis[extremo], cy, 0);
    for (let j = 0; j < porAnillo; j++) {
      const j2 = (j + 1) % porAnillo;
      if (extremo === 0) grupos[CHAPA].push(centro, base + j, base + j2);
      else grupos[CHAPA].push(centro, base + j2, base + j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(posiciones, 3));
  geo.setIndex([...grupos[CHAPA], ...grupos[CRISTAL], ...grupos[OSCURO]]);
  geo.addGroup(0, grupos[CHAPA].length, CHAPA);
  geo.addGroup(grupos[CHAPA].length, grupos[CRISTAL].length, CRISTAL);
  geo.addGroup(grupos[CHAPA].length + grupos[CRISTAL].length, grupos[OSCURO].length, OSCURO);
  geo.computeVertexNormals();
  return geo;
}

// ==========================================================================
// Piezas sueltas
// ==========================================================================

function caja(
  x: number,
  y: number,
  z: number,
  ancho: number,
  alto: number,
  fondo: number,
  material: THREE.Material,
  giro: { z?: number; y?: number } = {},
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), material);
  m.position.set(x, y, z);
  if (giro.z) m.rotation.z = giro.z;
  if (giro.y) m.rotation.y = giro.y;
  m.castShadow = true;
  return m;
}

function rueda(
  goma: THREE.Material,
  llanta: THREE.Material,
  cromo: THREE.Material,
  pinza: THREE.Material,
) {
  const g = new THREE.Group();

  const neumatico = new THREE.Mesh(new THREE.CylinderGeometry(R_RUEDA, R_RUEDA, 0.2, 34), goma);
  neumatico.geometry.rotateX(Math.PI / 2);
  neumatico.castShadow = true;
  g.add(neumatico);

  // Flanco algo mas estrecho, para que la rueda no sea un disco recto.
  const flanco = new THREE.Mesh(new THREE.CylinderGeometry(R_RUEDA, R_RUEDA, 0.215, 34), goma);
  flanco.geometry.rotateX(Math.PI / 2);
  flanco.scale.set(0.985, 0.985, 1);
  g.add(flanco);

  const aro = new THREE.Mesh(new THREE.CylinderGeometry(0.192, 0.192, 0.206, 28), llanta);
  aro.geometry.rotateX(Math.PI / 2);
  g.add(aro);

  // Cinco radios dobles, que es lo que lleva medio paddock.
  for (let i = 0; i < 5; i++) {
    const par = new THREE.Group();
    for (const lado of [-1, 1]) {
      const radio = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.34, 0.03), llanta);
      radio.position.set(lado * 0.028, 0, 0.09);
      radio.rotation.z = lado * 0.06;
      par.add(radio);
    }
    par.rotation.z = (i * Math.PI * 2) / 5;
    g.add(par);
  }

  const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 18), cromo);
  tapa.geometry.rotateX(Math.PI / 2);
  tapa.position.z = 0.108;
  g.add(tapa);

  const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.02, 24), cromo);
  disco.geometry.rotateX(Math.PI / 2);
  disco.position.z = 0.015;
  g.add(disco);

  const mordaza = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.045), pinza);
  mordaza.position.set(-0.1, 0.02, 0.025);
  g.add(mordaza);

  return g;
}

// ==========================================================================
// Montaje
// ==========================================================================

export function crearCivic(colorInicial: number): {
  coche: THREE.Group;
  materiales: MaterialesCoche;
} {
  const chapa = new THREE.MeshStandardMaterial({
    color: colorInicial,
    metalness: 0.72,
    roughness: 0.26,
  });
  const cristal = new THREE.MeshPhysicalMaterial({
    color: 0x06080a,
    metalness: 0.3,
    roughness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });
  const negro = new THREE.MeshStandardMaterial({
    color: 0x0b0d0f,
    metalness: 0.35,
    roughness: 0.62,
  });
  const goma = new THREE.MeshStandardMaterial({
    color: 0x0b0c0e,
    metalness: 0.04,
    roughness: 0.93,
  });
  const llanta = new THREE.MeshStandardMaterial({
    color: 0x9a7742,
    metalness: 1,
    roughness: 0.25,
  });
  const cromo = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1, roughness: 0.13 });
  const faro = new THREE.MeshStandardMaterial({
    color: 0xfff4e2,
    emissive: 0xfff0d0,
    emissiveIntensity: 1.35,
    metalness: 0.25,
    roughness: 0.12,
  });
  const piloto = new THREE.MeshStandardMaterial({
    color: 0xff2a20,
    emissive: 0xd8141b,
    emissiveIntensity: 1.25,
    metalness: 0.3,
    roughness: 0.18,
  });
  const ambar = new THREE.MeshStandardMaterial({
    color: 0xffb347,
    emissive: 0xd98a12,
    emissiveIntensity: 0.9,
    metalness: 0.3,
    roughness: 0.2,
  });
  const pinza = new THREE.MeshStandardMaterial({
    color: 0xc7161d,
    metalness: 0.6,
    roughness: 0.38,
  });

  const coche = new THREE.Group();

  const casco = new THREE.Mesh(cascoCarroceria(), [chapa, cristal, negro]);
  casco.castShadow = true;
  casco.receiveShadow = true;
  coche.add(casco);

  // --- Frontal ----------------------------------------------------------
  // El EK lleva el faro casi rectangular y muy tumbado, siguiendo la caida del
  // capo, con el intermitente pegado por fuera.
  // Van metidos en el morro y solo asoma la cara: como cajas sueltas por fuera
  // parecian pegatinas blancas.
  for (const lado of [1, -1]) {
    coche.add(caja(1.93, 0.79, lado * 0.42, 0.2, 0.075, 0.34, faro, { z: -0.2, y: lado * 0.08 }));
    coche.add(caja(1.95, 0.755, lado * 0.63, 0.14, 0.055, 0.1, ambar, { z: -0.2 }));
    coche.add(caja(1.97, 0.55, lado * 0.42, 0.07, 0.06, 0.15, faro));
  }
  coche.add(caja(1.99, 0.735, 0, 0.08, 0.055, 0.5, negro, { z: -0.13 }));
  coche.add(caja(2.01, 0.735, 0, 0.035, 0.035, 0.11, cromo, { z: -0.13 }));
  coche.add(caja(1.97, 0.6, 0, 0.08, 0.1, 0.78, negro));
  coche.add(caja(1.88, 0.3, 0, 0.24, 0.05, 1.12, negro));

  // --- Trasera ----------------------------------------------------------
  // Los pilotos del hatch son verticales y flanquean el porton.
  for (const lado of [1, -1]) {
    coche.add(
      caja(-1.94, 0.88, lado * (anchoEn(-1.94, 0.88) - 0.05), 0.1, 0.3, 0.12, piloto, {
        y: lado * 0.1,
      }),
    );
  }
  coche.add(caja(-1.98, 0.68, 0, 0.08, 0.09, 0.72, negro));
  coche.add(caja(-1.9, 0.3, 0, 0.24, 0.05, 1.08, negro));

  const cola = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.16, 20), cromo);
  cola.rotation.z = Math.PI / 2;
  cola.position.set(-2.03, 0.34, -0.42);
  coche.add(cola);

  // --- Costados ---------------------------------------------------------
  for (const lado of [1, -1]) {
    // Las ranuras van pegadas a la superficie real, consultada con anchoEn.
    coche.add(caja(0.62, 0.6, lado * anchoEn(0.62, 0.6), 0.012, 0.66, 0.02, negro));
    coche.add(caja(-0.68, 0.6, lado * anchoEn(-0.68, 0.6), 0.012, 0.66, 0.02, negro));
    coche.add(caja(0.02, 0.83, lado * anchoEn(0.02, 0.83), 0.15, 0.04, 0.03, chapa));

    // El faldon iba suelto y flotaba: el propio casco ya dibuja el bajo de la
    // puerta, asi que basta con marcarlo con una moldura fina pegada a el.
    coche.add(caja(0, 0.3, lado * (anchoEn(0, 0.3) - 0.012), 1.8, 0.045, 0.03, negro));

    const zEspejo = anchoEn(0.84, 1.0);
    coche.add(caja(0.84, 1.0, lado * (zEspejo + 0.035), 0.045, 0.032, 0.09, chapa));
    coche.add(caja(0.82, 1.02, lado * (zEspejo + 0.1), 0.15, 0.085, 0.055, chapa, {
      y: lado * 0.18,
    }));

    coche.add(caja(-1.74, 1.03, lado * 0.5, 0.045, 0.14, 0.045, negro));
  }

  // Aleron de porton, estilo EK9
  coche.add(caja(-1.78, 1.11, 0, 0.28, 0.038, 1.24, negro, { z: -0.13 }));

  // --- Ruedas y aletines -----------------------------------------------
  const ruedas: [number, number][] = [
    [EJE_DEL, 1],
    [EJE_DEL, -1],
    [EJE_TRA, 1],
    [EJE_TRA, -1],
  ];
  for (const [x, lado] of ruedas) {
    const r = rueda(goma, llanta, cromo, pinza);
    r.position.set(x, R_RUEDA, lado * (MEDIO_ANCHO - 0.075));
    r.rotation.y = lado > 0 ? 0 : Math.PI;
    coche.add(r);

    // Labio del paso, siguiendo el hueco que ya deja el casco. La Z sale de la
    // anchura maxima de esa estacion, no de una altura consultada: a la altura
    // del eje la carroceria ya no existe, ahi esta el hueco.
    const labio = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.017, 8, 30, Math.PI), negro);
    labio.position.set(x, R_RUEDA, lado * (enCurva(W_MAX, x) - 0.015));
    coche.add(labio);
  }

  return { coche, materiales: { chapa } };
}

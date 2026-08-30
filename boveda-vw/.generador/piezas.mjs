// Piezas de mercado para cada modelo.
//
// Las no oficiales salen del catálogo del planner (src/data/catalog.json), que es la
// fuente de verdad y no se duplica aquí: se lee tal cual y se enlaza a los modelos por
// familia de motor. Las oficiales se definen en este archivo, porque el planner no las
// tiene: son accesorios y recambio original de Volkswagen, que se atan a modelos
// concretos y no a motores.
//
// OFERTAS y HOMOLOGACION son datos que hay que verificar a mano, uno a uno. Todo lo que
// no esté aquí sale en la bóveda marcado como pendiente, nunca inventado.

// --- ámbito de cada categoría ---------------------------------------------
// Una pieza de motor entra en cualquier coche que monte esa familia: el downpipe de un
// EA888 vale igual en un Golf que en un Tiguan. Una pieza de chasis no funciona así,
// depende de la carrocería, así que cruzarla solo por motor produce disparates del tipo
// "coilovers de Golf para Crafter" porque ambos llevan un TDI.
//
// Las de chasis se limitan además a plataformas de turismo. Sigue sin ser fitment exacto
// (cada referencia vale para un modelo concreto), y por eso las fichas lo advierten.

export const AMBITO = {
  admision: "motor",
  escape: "motor",
  gestion: "motor",
  turbo: "motor",
  transmision: "motor",
  suspension: "chasis",
  frenos: "chasis",
  ruedas: "chasis",
  direccion: "chasis",
  estetica: "chasis",
  seguridad: "chasis",
  transporte: "chasis",
};

/** Plataformas de turismo: las que admiten piezas de chasis del mercado de compactos. */
export const PLATAFORMAS_TURISMO = [
  "PQ24", "PQ25", "PQ34", "PQ35", "PQ35 alargada", "PQ46", "PQ46 alargada",
  "MQB", "MQB A0", "MQB A0 IN", "MQB A0 alargada", "MQB A1", "MQB Evo", "MQB alargada",
  "NSF", "Plataforma Fox", "Plataforma Gol",
];

// --- piezas oficiales de Volkswagen ---------------------------------------

export const OFICIALES = [
  {
    id: "of-portaequipajes-golf8",
    nombre: "Portaequipajes de techo original (barras Grundträger)",
    categoria: "transporte",
    referencia: "5H4071126",
    modelos: ["Golf Mk8", "Golf Mk8.5"],
    nota: "Barras de perfil aerodinámico con perfil en T, 50 kg de carga y cierre con llave. Solo para carrocerías sin railing de fábrica.",
  },
  {
    id: "of-portaequipajes-golf8-variant",
    nombre: "Portaequipajes de techo original para Variant",
    categoria: "transporte",
    referencia: "5H9071151A",
    modelos: ["Golf Mk8", "Golf Mk8.5"],
    nota: "Versión para el Variant y el Alltrack, con 70 kg de carga. Probado en City Crash Plus.",
  },
  {
    id: "of-enganche-golf8",
    nombre: "Enganche de remolque desmontable con kit eléctrico de 13 polos",
    categoria: "transporte",
    referencia: "5H0092150B",
    modelos: ["Golf Mk8", "Golf Mk8.5"],
    nota: "Juego completo de posventa con bola desmontable y código de activación para la electrónica del coche.",
  },
  {
    id: "of-llanta-richmond",
    nombre: "Llanta de aleación Richmond 18 pulgadas",
    categoria: "ruedas",
    referencia: "5H0601025H",
    modelos: ["Golf Mk8", "Golf Mk8.5"],
    nota: "Medida 7,5J x 18 ET51, la de serie del GTI y el GTD. Homologada de fábrica para el modelo.",
  },
  {
    id: "of-faldones-rline",
    nombre: "Faldones y difusor R-Line originales",
    categoria: "estetica",
    referencia: "pendiente",
    modelos: ["Golf Mk8", "Golf Mk8.5", "Tiguan Mk3", "T-Roc Mk1"],
    nota: "Paquete estético R-Line de posventa. Al ser pieza original homologada para el modelo, no exige reforma.",
  },
];

// --- ofertas verificadas ---------------------------------------------------
// Una oferta es un producto concreto en una tienda concreta, con el precio que tenía el
// día de la consulta. Cada una se ha abierto y leído; ninguna sale de una estimación.
// Los precios caducan: la fecha está para poder descartarlos cuando envejezcan.

export const OFERTAS = [
  {
    pieza: "esc-dp-media",
    producto: "Milltek Sport Downpipe VW Golf Mk7 y 7.5 R 2.0 TSI 300 CV, 80 mm",
    referencia: "SSXVW711",
    vendedor: "Milltek Alemania",
    url: "https://www.milltek.de/Milltek-Sport-Downpipe-passend-fuer-VW-Golf-Mk7-75-R-20-TSI-300-PS-80mm",
    precio: 1010.74, moneda: "EUR", fecha: "2026-08-29",
  },
  {
    pieza: "adm-catchcan-baja",
    producto: "BAR-TEK 2.0 TSI EA888 Gen.1/2 Oil Catch Tank Kit",
    referencia: null,
    vendedor: "BAR-TEK Tuning",
    url: "https://www.bar-tek.com/oil-catchtnak-kit-tuev-2-0-l-tsi-ea888",
    precio: 544.00, moneda: "EUR", fecha: "2026-08-29",
  },
  {
    pieza: "susp-muelles-baja",
    producto: "Eibach Pro-Kit 20 mm para Golf 7 GTI TCR",
    referencia: "E10-85-041-10-22",
    vendedor: "Federnwerk",
    url: "https://www.federn-werk.de/p/eibach-prokit-federn-oder-20mm-tieferlegung-oder-vw-golf-7-gti-tcr-mit-abe-oder-e10-85-041-10-22",
    precio: 187.95, moneda: "EUR", fecha: "2026-08-29",
  },
  {
    pieza: "susp-coil-media",
    producto: "KW Gewindefahrwerk V1 inox para Golf VII",
    referencia: "1028000N",
    vendedor: "Tunershop",
    url: "https://www.tunershop.de/kw-gewindefahrwerk-v1-1028000n-fur-vw-golf-vii.html",
    precio: 1260.50, moneda: "EUR", fecha: "2026-08-29",
  },
  {
    pieza: "susp-coil-media",
    producto: "Bilstein B14 PSS para Golf VII 2.0 GTI",
    referencia: "47-229945",
    vendedor: "MK Fahrwerkstechnik",
    url: "https://www.mk-fahrwerkstechnik.de/BILSTEIN-B14-PSS-Gewindefahrwerk-fuer-VW-GOLF-VII-5G1-20-GTI-47-229945",
    precio: 1130.94, moneda: "EUR", fecha: "2026-08-29",
  },
  {
    pieza: "adm-fmic-media",
    producto: "Wagner Tuning Competition Intercooler Kit 1.8/2.0 TSI EA888 Gen.3 MQB",
    referencia: "200001048",
    vendedor: "Wagner Tuning",
    url: "https://www.wagner-tuningshop.de/Competition-Intercooler-Kit-fuer-Audi-Volkswagen-1-8-2-0-TSI-Gen-3-EA888-Motor-MQB-200001048",
    precio: 949.00, moneda: "EUR", fecha: "2026-08-29",
  },
  {
    pieza: "trans-lsd-media",
    producto: "Quaife ATB autoblocante para cambio 02Q de 6 marchas, tracción delantera",
    referencia: "QDF16R",
    vendedor: "Boost-Parts",
    url: "https://boost-parts.de/en/quaife/206-quaife-differential-lock-02q-2wd-6-speed-gearbox-vw-audi-qdf16r.html",
    precio: 1249.00, moneda: "EUR", fecha: "2026-08-29",
  },
  {
    pieza: "trans-embrague-alta",
    producto: "Sachs Performance Racing, embrague para 2.0 TFSI EA113 y 2.0 TDI",
    referencia: "40021",
    vendedor: "Boost-Parts",
    url: "https://boost-parts.de/en/20-tfsi-ea113/90-20-tfsi-ea113-20-tdi-sachs-performance-racing-clutch-golf-5-golf-6-audi-a3-seat-leon-skoda-octavia.html",
    precio: 1179.00, moneda: "EUR", fecha: "2026-08-29",
  },
  {
    pieza: "adm-filtro-baja",
    producto: "BMC Sportluftfilter FB756/20 para Golf 8 GTI y GTI Clubsport",
    referencia: "FB756/20",
    vendedor: "GG2 Fahrzeugtechnik",
    url: "https://www.gg2.shop/products/bmc-sportluftfilter-fb756-20-fur-vw-golf-8-gti-gti-clubsport",
    precio: 67.74, moneda: "EUR", fecha: "2026-08-30",
  },
  {
    pieza: "adm-dv-baja",
    producto: "GFB DV+ T9351, válvula de descarga para 2.0 TFSI",
    referencia: "SW10005",
    vendedor: "BBM Tuningshop",
    url: "https://bbm-tuningshop.de/GFB-DV-20TFSI-T9351-Schubumluftventil",
    precio: 123.70, moneda: "EUR", fecha: "2026-08-30",
  },
  {
    pieza: "trans-lsd-alta",
    producto: "Wavetrac autoblocante para cambio 02Q de 6 marchas, tracción delantera",
    referencia: "10.309.175WK",
    vendedor: "EM-Racing",
    url: "https://www.em-racing.de/Wavetrac-Differentialsperre-10309175WK-VW-02Q-2WD-Getriebe",
    precio: 1499.00, moneda: "EUR", fecha: "2026-08-30",
  },
  {
    pieza: "susp-brazos-media",
    producto: "Juego de brazos con silentblocks de poliuretano Powerflex para Golf VII GTI y R",
    referencia: null,
    vendedor: "Powerflex Shop",
    url: "https://www.powerflex-shop.com/?a=139577&lang=eng",
    precio: 389.99, moneda: "EUR", fecha: "2026-08-30",
  },
  {
    pieza: "susp-coil-alta",
    producto: "KW V4 Clubsport para Golf 7 GTI y R",
    referencia: "3978020N-01",
    vendedor: "CDT-Shop",
    url: "https://www.cdt-shop.de/produkt/kw-v4-clubsport-gewindefahrwerk-vw-golf-7-gti-r/",
    precio: 4867.68, moneda: "EUR", fecha: "2026-08-30",
  },
  {
    pieza: "fren-pastillas-baja",
    producto: "Ferodo DS2500 eje delantero, Golf 7 GTI, Clubsport, R y TCR desde 2016",
    referencia: "FCP4425H",
    vendedor: "EZT Autoteile",
    url: "https://www.ezt-autoteile.de/bremse/ferodo-racing-bremsbelag/vw/golf-7/ds2500/210372/ferodo-ds2500-bremsbelaege-fuer-vw-golf-7-5g1-2.0-gti-inkl.-clubsport/r/tcr-ab-bj.-2016-va-fcp4425h",
    precio: 203.00, moneda: "EUR", fecha: "2026-08-30",
  },
  {
    pieza: "of-portaequipajes-golf8",
    producto: "Portaequipajes original VW Golf 8, barras con perfil en T",
    referencia: "5H4071126",
    vendedor: "ahw-shop",
    url: "https://shop.ahw-shop.de/original-vw-golf-8-5h-grundtraeger-dachtraeger-t-nut-tragstaebe-dachgepaecktraeger-5h4071126",
    precio: 299.90, moneda: "EUR", fecha: "2026-08-29",
  },
  {
    pieza: "of-portaequipajes-golf8-variant",
    producto: "Portaequipajes original VW Golf 8 Variant",
    referencia: "5H9071151A",
    vendedor: "Rosier",
    url: "https://shop.rosier.de/volkswagen-golf-8-variant-grundtraeger-dachtraeger-t-nut-tragstaebe-dachgepaecktraeger-5h9071151a/5h9071151a",
    precio: 284.99, moneda: "EUR", fecha: "2026-08-29",
  },
  {
    pieza: "of-enganche-golf8",
    producto: "Enganche de remolque desmontable original con kit eléctrico de 13 polos",
    referencia: "5H0092150B",
    vendedor: "Rosier",
    url: "https://shop.rosier.de/volkswagen-golf-8-anhaengevorrichtung-satz-abnehmbar-mit-elektro-einbausatz-13-polig-5h0092150b/5h0092150b",
    precio: 699.00, moneda: "EUR", fecha: "2026-08-29",
  },
];

// --- homologación ----------------------------------------------------------
// Solo se rellena lo verificable. Alemania sale de lo que declara la ficha del producto
// (ABE, Teilegutachten, TÜV o la frase "nicht zugelassen im Bereich der StVZO"). España
// se deduce del régimen de reformas del Real Decreto 866/2010, que no depende del
// producto sino del tipo de modificación.
//
// homologada     = se puede circular con ello, con el papel que indique la nota
// no_homologada  = no es legal en vía pública en ese país, ni con reforma
// Lo que no aparece aquí queda como pendiente en la bóveda.

export const HOMOLOGACION = {
  "esc-dp-media": {
    homologada: [],
    no_homologada: ["Alemania", "España"],
    nota: "La ficha del downpipe Milltek de esta gama declara 'Nicht zugelassen im Bereich der StVZO' y 'Nicht ECE geprüft': solo circuito. Suprimir el catalizador rompe la homologación de emisiones del vehículo, así que en España es rechazo directo en ITV. Las variantes con catalizador deportivo y Teilegutachten sí se pueden inscribir en Alemania.",
  },
  "esc-decat-baja": {
    homologada: [],
    no_homologada: ["Alemania", "España"],
    nota: "Downpipe descatalizado genérico y sin certificado. No es legalizable en vía pública en ningún país de la Unión Europea.",
  },
  "esc-turboback-alta": {
    homologada: [],
    no_homologada: ["Alemania", "España"],
    nota: "La línea Milltek Race va sin catalizador. Uso en circuito.",
  },
  "esc-catback-media": {
    homologada: ["Alemania", "España"],
    no_homologada: [],
    nota: "Al ir por detrás del catalizador no toca el sistema de emisiones. Con marcado EG o ECE se circula sin trámite; sin él hace falta reforma con proyecto en España.",
  },
  "adm-catchcan-baja": {
    homologada: ["Alemania"],
    no_homologada: [],
    nota: "El kit de BAR-TEK se vende con TÜV. En España modifica la ventilación del cárter, así que necesita legalización de reforma aportando el certificado del fabricante.",
  },
  "adm-fmic-media": {
    homologada: ["Alemania"],
    no_homologada: [],
    nota: "El kit Wagner lleva Teilegutachten: en Alemania hay que pasar por el TÜV para inscribirlo. Excluye los coches con filtro de partículas de gasolina (OPF).",
  },
  "susp-muelles-baja": {
    homologada: ["Alemania", "España"],
    no_homologada: [],
    nota: "El Pro-Kit de Eibach de esta referencia tiene ABE, que en Alemania evita el trámite individual. En España entra como reforma 8.50 con la ficha del fabricante.",
  },
  "susp-coil-media": {
    homologada: ["Alemania", "España"],
    no_homologada: [],
    nota: "Tanto el KW V1 como el Bilstein B14 tienen certificado TÜV del rango de regulación. En España, reforma 8.51 con proyecto o ficha reducida según el certificado.",
  },
  "susp-coil-baja": {
    homologada: [],
    no_homologada: [],
    nota: "Las marcas de entrada suelen venderse sin certificado. Sin él no hay forma de legalizarlo, aunque el producto en sí no sea ilegal. Verificar referencia por referencia.",
  },
  "seg-jaula-alta": {
    homologada: [],
    no_homologada: ["España"],
    nota: "Una jaula soldada homologada FIA vale para competición con licencia. En vía pública en España no es legalizable si invade el habitáculo de los ocupantes sin acolchado homologado y reforma específica.",
  },
  "dir-eje-rigido-alta": {
    homologada: [],
    no_homologada: ["Alemania", "España"],
    nota: "Soldar el eje trasero altera la estructura portante. No es legalizable en vía pública.",
  },
  "gestion-standalone-alta": {
    homologada: [],
    no_homologada: ["Alemania", "España"],
    nota: "Una gestión standalone elimina los diagnósticos de emisiones de serie. No supera una ITV con lectura OBD.",
  },
  "trans-lsd-media": {
    homologada: ["Alemania", "España"],
    no_homologada: [],
    nota: "Va dentro de la caja y no altera ningún parámetro homologado del vehículo.",
  },
  "trans-lsd-alta": {
    homologada: ["Alemania", "España"],
    no_homologada: [],
    nota: "Como el ATB: es una pieza interna del cambio y no toca nada de lo que mira una inspección.",
  },
  "adm-filtro-baja": {
    homologada: ["Alemania", "España"],
    no_homologada: [],
    nota: "Filtro de recambio que va en la caja original, sin modificar el circuito de admisión. No necesita trámite en ninguno de los dos países.",
  },
  "susp-coil-alta": {
    homologada: ["Alemania"],
    no_homologada: [],
    nota: "El KW V4 Clubsport se vende con Teilegutachten, así que en Alemania hay que pasar por el TÜV para inscribirlo. En España, reforma 8.51 con proyecto.",
  },
  "fren-pastillas-baja": {
    homologada: [],
    no_homologada: [],
    nota: "Depende de la referencia, no del tipo de pieza. Las Ferodo DS2500 se venden 'ohne Gutachten, nur für Rennsport': solo circuito. Las DS Performance del mismo fabricante y para el mismo coche sí llevan ABE y valen para calle. Mira la referencia concreta antes de comprar.",
  },
};

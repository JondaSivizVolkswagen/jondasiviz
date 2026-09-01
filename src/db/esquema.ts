// Esquema de la base de datos.
//
// El catálogo vive en JSON porque lo autoran personas en un vault de Obsidian, y eso no
// cambia: sigue siendo la fuente de verdad. Lo que hace esta capa es volcarlo a SQLite
// para poder consultarlo de verdad, con filtros y cruces, desde la API.
//
// Se guarda normalizado y no como un JSON dentro de una columna. Una pieza vale para
// varias plataformas y puntúa distinto en cada objetivo, así que esas dos cosas son
// tablas aparte: es lo que permite preguntar "qué piezas valen para un EA113 y suman
// para drift" con una consulta en vez de recorriendo el catálogo entero en memoria.
//
// Las claves foráneas van con ON DELETE CASCADE para que al resembrar no queden filas
// huérfanas colgando de piezas que ya no existen.

export const ESQUEMA = `
PRAGMA foreign_keys = ON;

-- Versión y moneda del catálogo, y cuándo se sembró por última vez.
CREATE TABLE IF NOT EXISTS meta (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pieza (
  id              TEXT PRIMARY KEY,
  nombre          TEXT NOT NULL,
  categoria       TEXT NOT NULL,
  gama            TEXT NOT NULL CHECK (gama IN ('baja','media','alta')),
  precio_min      INTEGER NOT NULL,
  precio_estimado INTEGER NOT NULL,
  precio_max      INTEGER NOT NULL,
  impacto         INTEGER NOT NULL CHECK (impacto BETWEEN 1 AND 5),
  legalidad       TEXT NOT NULL CHECK (legalidad IN ('homologable','requiere-ficha','solo-circuito')),
  grupo_exclusivo TEXT,
  stage           TEXT,
  nota            TEXT,
  imagen          TEXT
);

-- Chasis en los que monta. Vacío quiere decir que la pieza no depende del chasis, que
-- es el caso de todo lo que cuelga del motor.
CREATE TABLE IF NOT EXISTS pieza_chasis (
  pieza_id TEXT NOT NULL REFERENCES pieza(id) ON DELETE CASCADE,
  chasis   TEXT NOT NULL,
  PRIMARY KEY (pieza_id, chasis)
);

-- Tracciones en las que la pieza tiene sentido. Vacío = cualquiera.
CREATE TABLE IF NOT EXISTS pieza_traccion (
  pieza_id TEXT NOT NULL REFERENCES pieza(id) ON DELETE CASCADE,
  traccion TEXT NOT NULL CHECK (traccion IN ('delantera','trasera','total')),
  PRIMARY KEY (pieza_id, traccion)
);

-- Las tres listas de equipamiento van juntas con una columna que dice cuál es. Son la
-- misma relación pieza-equipamiento y solo cambia el sentido, así que tres tablas
-- idénticas solo servirían para repetir el mismo esquema tres veces.
CREATE TABLE IF NOT EXISTS pieza_equipamiento (
  pieza_id     TEXT NOT NULL REFERENCES pieza(id) ON DELETE CASCADE,
  relacion     TEXT NOT NULL CHECK (relacion IN ('sustituye','exige','chocaCon')),
  equipamiento TEXT NOT NULL,
  PRIMARY KEY (pieza_id, relacion, equipamiento)
);

-- Una pieza puede valer para varios motores.
CREATE TABLE IF NOT EXISTS pieza_plataforma (
  pieza_id   TEXT NOT NULL REFERENCES pieza(id) ON DELETE CASCADE,
  plataforma TEXT NOT NULL,
  PRIMARY KEY (pieza_id, plataforma)
);

-- Cuánto aporta cada pieza a cada objetivo, de 0 a 5.
CREATE TABLE IF NOT EXISTS pieza_objetivo (
  pieza_id TEXT NOT NULL REFERENCES pieza(id) ON DELETE CASCADE,
  objetivo TEXT NOT NULL CHECK (objetivo IN ('drift','drag','mas-cv','estetica')),
  peso     INTEGER NOT NULL CHECK (peso BETWEEN 0 AND 5),
  PRIMARY KEY (pieza_id, objetivo)
);

-- Piezas que hay que montar antes que otra. Se apunta a sí misma.
CREATE TABLE IF NOT EXISTS pieza_requiere (
  pieza_id    TEXT NOT NULL REFERENCES pieza(id) ON DELETE CASCADE,
  requiere_id TEXT NOT NULL,
  PRIMARY KEY (pieza_id, requiere_id)
);

CREATE TABLE IF NOT EXISTS modelo (
  id            TEXT PRIMARY KEY,
  nombre        TEXT NOT NULL,
  chasis        TEXT NOT NULL,
  motor         TEXT NOT NULL,
  motor_detalle TEXT NOT NULL,
  traccion      TEXT NOT NULL CHECK (traccion IN ('delantera','trasera','total')),
  propulsion    TEXT NOT NULL,
  anio_inicio   INTEGER NOT NULL,
  anio_fin      INTEGER NOT NULL
);

-- Lo que el coche trae de fábrica y condiciona qué piezas tienen sentido.
CREATE TABLE IF NOT EXISTS modelo_equipamiento (
  modelo_id    TEXT NOT NULL REFERENCES modelo(id) ON DELETE CASCADE,
  equipamiento TEXT NOT NULL,
  PRIMARY KEY (modelo_id, equipamiento)
);

-- Formas alternativas de escribir el modelo, para el buscador.
CREATE TABLE IF NOT EXISTS modelo_alias (
  modelo_id TEXT NOT NULL REFERENCES modelo(id) ON DELETE CASCADE,
  alias     TEXT NOT NULL,
  PRIMARY KEY (modelo_id, alias)
);

-- Deja constancia de cada siembra: quién la disparó y cuánto entró. Es lo que permite
-- comprobar si el webhook de GitHub llegó a hacer su trabajo.
CREATE TABLE IF NOT EXISTS siembra (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha   TEXT NOT NULL,
  origen  TEXT NOT NULL,
  piezas  INTEGER NOT NULL,
  modelos INTEGER NOT NULL
);

-- ─────────────────────────────── cuentas ───────────────────────────────
--
-- La contraseña no se guarda: se guarda su huella con scrypt y una sal distinta por
-- usuario, de forma que dos personas con la misma contraseña tengan huellas distintas y
-- una filtración de la base no sirva para entrar en ningún sitio.
-- Solo se pide lo que hace falta para que la herramienta sirva de algo: cómo llamar a
-- la persona y con qué coche anda. Ni teléfono ni dirección ni fecha de nacimiento: son
-- datos personales que habría que proteger y que aquí no pintan nada.
CREATE TABLE IF NOT EXISTS usuario (
  id       TEXT PRIMARY KEY,
  correo   TEXT NOT NULL UNIQUE,
  huella   TEXT NOT NULL,
  sal      TEXT NOT NULL,
  alta     TEXT NOT NULL,
  nombre   TEXT NOT NULL DEFAULT '',
  -- Su coche, para que el planner arranque ya en él. Sin clave foránea a propósito: si
  -- un modelo desaparece del catálogo, la cuenta no se rompe, simplemente deja de
  -- coincidir y el planner tira del que venga por defecto.
  coche    TEXT NOT NULL DEFAULT '',
  -- Cuándo entró por última vez, para poder enseñárselo en su perfil.
  visto    TEXT
);

-- El correo se busca siempre en minúsculas, para que Ana@x.com y ana@x.com sean la
-- misma cuenta y nadie pueda registrar la de otro cambiando una mayúscula.
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_correo ON usuario(lower(correo));

-- De la sesión se guarda la huella del token, no el token. Quien lea la base no puede
-- suplantar a nadie con lo que hay dentro.
CREATE TABLE IF NOT EXISTS sesion (
  huella_token TEXT PRIMARY KEY,
  usuario_id   TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  creada       TEXT NOT NULL,
  caduca       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sesion_usuario ON sesion(usuario_id);

-- Una fila por usuario. 'estado' es lo que manda para dar o no acceso: lo escribe el
-- webhook de la pasarela, nunca el navegador.
CREATE TABLE IF NOT EXISTS suscripcion (
  usuario_id     TEXT PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  estado         TEXT NOT NULL CHECK (estado IN ('ninguna','activa','impagada','cancelada')),
  proveedor      TEXT NOT NULL,
  referencia     TEXT,
  renueva        TEXT,
  actualizada    TEXT NOT NULL
);

-- Cuántos planes ha pedido cada usuario cada día, para el tope del plan gratuito.
CREATE TABLE IF NOT EXISTS uso_diario (
  usuario_id TEXT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  dia        TEXT NOT NULL,
  planes     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (usuario_id, dia)
);

-- El motor filtra siempre por plataforma, y la API por categoría y por objetivo.
CREATE INDEX IF NOT EXISTS idx_pieza_categoria    ON pieza(categoria);
CREATE INDEX IF NOT EXISTS idx_pieza_grupo        ON pieza(grupo_exclusivo);
CREATE INDEX IF NOT EXISTS idx_plataforma_pieza   ON pieza_plataforma(plataforma);
CREATE INDEX IF NOT EXISTS idx_objetivo_peso      ON pieza_objetivo(objetivo, peso);
CREATE INDEX IF NOT EXISTS idx_modelo_motor       ON modelo(motor);
`;

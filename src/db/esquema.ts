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
  grupo_exclusivo TEXT,
  stage           TEXT,
  nota            TEXT,
  imagen          TEXT
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
  traccion      TEXT NOT NULL CHECK (traccion IN ('delantera','total')),
  anio_inicio   INTEGER NOT NULL,
  anio_fin      INTEGER NOT NULL
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

-- El motor filtra siempre por plataforma, y la API por categoría y por objetivo.
CREATE INDEX IF NOT EXISTS idx_pieza_categoria    ON pieza(categoria);
CREATE INDEX IF NOT EXISTS idx_pieza_grupo        ON pieza(grupo_exclusivo);
CREATE INDEX IF NOT EXISTS idx_plataforma_pieza   ON pieza_plataforma(plataforma);
CREATE INDEX IF NOT EXISTS idx_objetivo_peso      ON pieza_objetivo(objetivo, peso);
CREATE INDEX IF NOT EXISTS idx_modelo_motor       ON modelo(motor);
`;

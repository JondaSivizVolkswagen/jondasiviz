<#
.SYNOPSIS
Carga la bóveda en una instancia de Neo4j Desktop 2.

.DESCRIPTION
Busca el cypher-shell y el Java 21 que Neo4j Desktop ya trae descargados, y ejecuta
contra la instancia el script generado por build-neo4j.mjs. La instancia tiene que
estar arrancada en Desktop antes de lanzar esto.

Si no se pasa -Clave, cypher-shell la pide por teclado y así no queda en el historial.

Con -Limpiar borra antes los nodos de la bóveda. Hace falta cuando cambia la forma del
grafo y no solo su contenido: como todo son MERGE, una recarga normal añade lo nuevo
pero no quita las relaciones que ya no deberían existir.

.EXAMPLE
.\cargar.ps1
.EXAMPLE
.\cargar.ps1 -Limpiar
.EXAMPLE
.\cargar.ps1 -Uri bolt://localhost:7688 -Base boveda
#>
param(
  [string]$Clave,
  [string]$Usuario = "neo4j",
  [string]$Uri = "bolt://localhost:7687",
  [string]$Base = "neo4j",
  [string]$Archivo,
  [switch]$Limpiar
)

$ErrorActionPreference = "Stop"
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Archivo) { $Archivo = Join-Path $aqui "salida\boveda-vw.cypher" }

if (-not (Test-Path $Archivo)) {
  throw "No existe $Archivo. Genera la salida antes con: node $aqui\build-neo4j.mjs"
}

$cache = Join-Path $env:USERPROFILE ".Neo4jDesktop2\Cache"
if (-not (Test-Path $cache)) {
  throw "No encuentro la cache de Neo4j Desktop 2 en $cache. Si usas otra instalación, pasa la ruta del cypher-shell a mano."
}

# Java: Desktop trae varios runtimes; cypher-shell 2026.x necesita 21 o 25, y coge el
# primero del PATH, así que no basta con JAVA_HOME.
$jre = Get-ChildItem -Directory (Join-Path $cache "runtime") -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match "jre(21|25)" } |
  Sort-Object Name -Descending | Select-Object -First 1
if (-not $jre) { throw "No hay ningún JRE 21 o 25 en $cache\runtime. Ábrelo una vez en Desktop para que lo descargue." }

$shell = Get-ChildItem -Recurse -File -Filter "cypher-shell.bat" (Join-Path $cache "dbmss") -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending | Select-Object -First 1
if (-not $shell) { throw "No encuentro cypher-shell.bat en $cache\dbmss." }

$env:JAVA_HOME = $jre.FullName
$env:PATH = "$($jre.FullName)\bin;$env:PATH"

$argumentos = @("-a", $Uri, "-u", $Usuario, "-d", $Base, "-f", $Archivo)
if ($Clave) { $argumentos += @("-p", $Clave) }

Write-Host "cypher-shell: $($shell.FullName)"
Write-Host "java:         $($jre.Name)"
Write-Host "destino:      $Uri (base $Base)"
Write-Host ""

if ($Limpiar) {
  # La consulta de borrado se saca del propio script generado, comentada en su cabecera,
  # para que la lista de etiquetas no se duplique aquí y se quede vieja.
  $linea = Select-String -Path $Archivo -Pattern '^// (MATCH \(n\) WHERE any\(l IN labels\(n\).+DETACH DELETE n;)$' |
    Select-Object -First 1
  if (-not $linea) { throw "No encuentro la consulta de borrado en la cabecera de $Archivo." }
  $consulta = $linea.Matches[0].Groups[1].Value

  Write-Host "Borrando los nodos de la bóveda antes de recargar."
  Write-Host "  $consulta"
  Write-Host "Solo afecta a esas etiquetas; cualquier otro dato de la base se queda."
  Write-Host ""

  $limpieza = $argumentos | Where-Object { $_ -ne "-f" -and $_ -ne $Archivo }
  & $shell.FullName @limpieza $consulta
  if ($LASTEXITCODE -ne 0) { throw "El borrado falló con código $LASTEXITCODE." }
}

& $shell.FullName @argumentos
if ($LASTEXITCODE -ne 0) { throw "cypher-shell terminó con código $LASTEXITCODE." }

Write-Host ""
Write-Host "Cargado. Comprueba en la pestaña Query de Desktop:"
Write-Host "  MATCH (n) RETURN labels(n)[0] AS etiqueta, count(*) AS nodos ORDER BY nodos DESC;"

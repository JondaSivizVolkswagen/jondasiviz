<#
.SYNOPSIS
Copia los CSV de la bóveda a la carpeta import de una instancia de Neo4j Desktop 2.

.DESCRIPTION
LOAD CSV con URL file:/// solo lee de la carpeta import de la instancia. Este script
localiza esa carpeta y deja dentro los CSV en un subdirectorio llamado boveda-vw, que es
la ruta que espera cargar-csv.cypher.

Si hay varias instancias, las lista y hay que elegir una con -Import.

.EXAMPLE
.\copiar-csv.ps1
.EXAMPLE
.\copiar-csv.ps1 -Import "C:\Users\USUARIO\.Neo4jDesktop2\Data\dbmss\dbms-xxxx\import"
#>
param(
  [string]$Import,
  [string]$Origen
)

$ErrorActionPreference = "Stop"
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Origen) { $Origen = Join-Path $aqui "salida\csv" }

if (-not (Test-Path $Origen)) {
  throw "No existe $Origen. Genera la salida antes con: node $aqui\build-neo4j.mjs"
}

if (-not $Import) {
  $dbmss = Join-Path $env:USERPROFILE ".Neo4jDesktop2\Data\dbmss"
  if (-not (Test-Path $dbmss)) {
    throw "No encuentro instancias de Neo4j Desktop 2 en $dbmss. Crea una desde Desktop y vuelve a intentarlo."
  }
  # Ojo: sin -Recurse, PowerShell ignora -Depth y solo mira los hijos directos.
  $candidatos = @(Get-ChildItem -Directory -Recurse -Depth 2 $dbmss -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq "import" })

  if ($candidatos.Count -eq 0) {
    throw "No hay ninguna carpeta import bajo $dbmss. Crea una instancia en Desktop y arráncala una vez."
  }
  if ($candidatos.Count -gt 1) {
    Write-Host "Hay varias instancias. Elige una y pásala con -Import:"
    $candidatos | ForEach-Object { Write-Host "  $($_.FullName)" }
    throw "Varias instancias encontradas."
  }
  $Import = $candidatos[0].FullName
}

if (-not (Test-Path $Import)) { throw "No existe la carpeta import: $Import" }

$destino = Join-Path $Import "boveda-vw"
New-Item -ItemType Directory -Force $destino | Out-Null
Copy-Item (Join-Path $Origen "*.csv") $destino -Force

$copiados = (Get-ChildItem -File -Filter *.csv $destino).Count
Write-Host "Copiados $copiados archivos en $destino"
Write-Host ""
Write-Host "Ahora, en la pestaña Query de Desktop, pega el contenido de:"
Write-Host "  $(Join-Path $aqui 'salida\cargar-csv.cypher')"

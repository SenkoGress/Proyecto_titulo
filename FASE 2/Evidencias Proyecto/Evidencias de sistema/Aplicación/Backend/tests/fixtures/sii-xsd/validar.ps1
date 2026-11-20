# Valida un XML contra los esquemas oficiales del SII que estan en esta carpeta.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File validar.ps1 -Xml <archivo> -Esquema <archivo.xsd>
# Imprime una linea por error o advertencia y termina con codigo 0 solo si no hubo ninguno.
# Las advertencias cuentan: un elemento sin declarar se valida de forma laxa y solo deja advertencia.
param([string]$Xml, [string]$Esquema)

$set = New-Object System.Xml.Schema.XmlSchemaSet
$set.XmlResolver = New-Object System.Xml.XmlUrlResolver
[void]$set.Add('http://www.sii.cl/SiiDte', $Esquema)
$set.Compile()

$config = New-Object System.Xml.XmlReaderSettings
$config.ValidationType = [System.Xml.ValidationType]::Schema
$config.Schemas = $set
$config.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
$config.ValidationFlags = $config.ValidationFlags -bor [System.Xml.Schema.XmlSchemaValidationFlags]::ReportValidationWarnings

$problemas = New-Object System.Collections.Generic.List[string]
$config.add_ValidationEventHandler({
  param($s, $ev)
  $problemas.Add(("{0} linea {1} col {2}: {3}" -f $ev.Severity, $ev.Exception.LineNumber, $ev.Exception.LinePosition, $ev.Message))
})

$lector = [System.Xml.XmlReader]::Create($Xml, $config)
try { while ($lector.Read()) { } } catch { $problemas.Add("Error al leer: " + $_.Exception.Message) } finally { $lector.Close() }

$problemas | ForEach-Object { Write-Output $_ }
if ($problemas.Count -gt 0) { exit 1 }
exit 0

# Verifica todas las firmas XMLDSig de un XML con la implementacion de .NET (System.Security.Cryptography.Xml),
# que es independiente del firmador de GesTock: canonicaliza, recalcula cada digest y comprueba la firma
# con la clave publica que viaja en KeyInfo.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File verificar_firmas.ps1 -Xml <archivo>
# Imprime una linea por firma y termina con codigo 0 solo si todas son validas.
param([string]$Xml)

Add-Type -AssemblyName System.Security
$doc = New-Object System.Xml.XmlDocument
$doc.PreserveWhitespace = $true
$doc.Load($Xml)

$ns = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
$ns.AddNamespace('ds', 'http://www.w3.org/2000/09/xmldsig#')
$firmas = $doc.SelectNodes('//ds:Signature', $ns)
if ($firmas.Count -eq 0) { Write-Output 'FALLA sin firmas'; exit 1 }

$malas = 0
foreach ($firma in $firmas) {
  # el certificado X509 de prueba no es un certificado real: se verifica con la clave de RSAKeyValue,
  # sobre una copia de la firma sin X509Data para no tocar el documento que se verifica
  $copia = $firma.Clone()
  foreach ($x509 in @($copia.SelectNodes('.//ds:X509Data', $ns))) { [void]$x509.ParentNode.RemoveChild($x509) }
  $verificador = New-Object System.Security.Cryptography.Xml.SignedXml($doc)
  try { $verificador.LoadXml([System.Xml.XmlElement]$copia) } catch { Write-Output ('FALLA no se pudo leer la firma: ' + $_.Exception.Message); $malas++; continue }
  $referencia = $verificador.SignedInfo.References[0].Uri
  if ($verificador.CheckSignature()) { Write-Output ("OK " + $referencia) }
  else { Write-Output ("FALLA " + $referencia); $malas++ }
}
if ($malas -gt 0) { exit 1 }
exit 0

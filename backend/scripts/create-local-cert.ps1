$ErrorActionPreference = "Stop"

$certsDir = Join-Path $PSScriptRoot "..\certs"
$pfxPath = Join-Path $certsDir "localhost.pfx"

New-Item -ItemType Directory -Force -Path $certsDir | Out-Null

$cert = New-SelfSignedCertificate `
  -DnsName "localhost", "127.0.0.1" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -FriendlyName "frontback31-localhost" `
  -NotAfter (Get-Date).AddYears(2)

$password = ConvertTo-SecureString -String "frontback31" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $password | Out-Null

Write-Host "Local HTTPS certificate created: $pfxPath"

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$SiteUrl,

  [string]$ClientId = $env:ENTRAID_APP_ID,

  [string]$Tenant
)

$ErrorActionPreference = "Stop"

if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
  throw "Brakuje modulu PnP.PowerShell. Zainstaluj go poleceniem: Install-Module PnP.PowerShell -Scope CurrentUser"
}

Import-Module PnP.PowerShell

if (-not $ClientId) {
  throw @"
Brakuje ClientId aplikacji Entra ID dla PnP.PowerShell.

Od wrzesnia 2024 Connect-PnPOnline -Interactive wymaga wlasnej App Registration.
Najpierw utworz aplikacje:

  Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "Filtr plikow PnP" -Tenant "twoj-tenant.onmicrosoft.com" -Interactive

Potem uruchom ten skrypt z parametrem:

  -ClientId "GUID-APPLICATION-CLIENT-ID"

Albo ustaw zmienna srodowiskowa:

  `$env:ENTRAID_APP_ID = "GUID-APPLICATION-CLIENT-ID"
"@
}

Write-Host "Logowanie do: $SiteUrl"
$connectParams = @{
  Url = $SiteUrl
  Interactive = $true
  ClientId = $ClientId
}

if ($Tenant) {
  $connectParams.Tenant = $Tenant
}

Connect-PnPOnline @connectParams

$web = Get-PnPWeb -Includes AssociatedOwnerGroup,AssociatedMemberGroup,AssociatedVisitorGroup

Write-Host ""
Write-Host "Domyslne grupy witryny:"
Write-Host "Owners:  $($web.AssociatedOwnerGroup.Title)"
Write-Host "Members: $($web.AssociatedMemberGroup.Title)"
Write-Host "Visitors: $($web.AssociatedVisitorGroup.Title)"

Write-Host ""
Write-Host "Wszystkie grupy SharePoint na tej witrynie:"
Get-PnPGroup |
  Sort-Object Title |
  Select-Object Title, Id |
  Format-Table -AutoSize

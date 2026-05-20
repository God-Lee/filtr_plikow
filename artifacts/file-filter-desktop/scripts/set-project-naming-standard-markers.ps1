[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [Parameter(Mandatory = $true)]
  [string]$SiteUrl,

  [string]$ClientId = $env:ENTRAID_APP_ID,

  [string]$Tenant,

  [Parameter(Mandatory = $true)]
  [string]$Library,

  [Parameter(Mandatory = $true)]
  [string]$ProjectsFolderSiteRelativeUrl,

  [ValidateSet(3, 4)]
  [int]$NamingStandardVersion = 3,

  [string[]]$ReadGroups = @(),

  [string[]]$OwnerGroups = @(),

  [switch]$Overwrite
)

$ErrorActionPreference = "Stop"

if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
  throw "Brakuje modulu PnP.PowerShell. Zainstaluj go poleceniem: Install-Module PnP.PowerShell -Scope CurrentUser"
}

if ($ReadGroups.Count -gt 0 -and $OwnerGroups.Count -eq 0) {
  throw "Podaj co najmniej jedna grupe w -OwnerGroups, zeby nie usunac dostepu administracyjnego przy nadawaniu praw tylko do odczytu."
}

Import-Module PnP.PowerShell

if (-not $ClientId) {
  throw @"
Brakuje ClientId aplikacji Entra ID dla PnP.PowerShell.

Dla wariantu Sites.Selected utworz aplikacje z SharePoint delegated permission Sites.Selected,
nadaj jej FullControl do tej jednej witryny, a potem uruchom ten skrypt z:

  -ClientId "GUID-APPLICATION-CLIENT-ID"

Albo ustaw zmienna srodowiskowa:

  `$env:ENTRAID_APP_ID = "GUID-APPLICATION-CLIENT-ID"
"@
}

$connectParams = @{
  Url = $SiteUrl
  Interactive = $true
  ClientId = $ClientId
}

if ($Tenant) {
  $connectParams.Tenant = $Tenant
}

Connect-PnPOnline @connectParams

$settingsFileName = "nazewnictwo.json"
$designFolderName = "4. Projektowanie"
$jsonContent = @{ namingStandardVersion = $NamingStandardVersion } | ConvertTo-Json -Depth 2
$tempFile = Join-Path ([System.IO.Path]::GetTempPath()) "filtr-plikow-ustawienia-$NamingStandardVersion.json"
Set-Content -Path $tempFile -Value $jsonContent -Encoding UTF8

try {
  $projectFolders = Get-PnPFolderItem -FolderSiteRelativeUrl $ProjectsFolderSiteRelativeUrl -ItemType Folder

  foreach ($projectFolder in $projectFolders) {
    $projectUrl = "$ProjectsFolderSiteRelativeUrl/$($projectFolder.Name)"
    $designFolderUrl = "$projectUrl/$designFolderName"
    $settingsFileUrl = "$designFolderUrl/$settingsFileName"

    try {
      Get-PnPFolder -Url $designFolderUrl | Out-Null
    } catch {
      Write-Host "Pomijam: $projectUrl - brak folderu $designFolderName"
      continue
    }

    $existingFile = $null
    try {
      $existingFile = Get-PnPFile -Url $settingsFileUrl -AsListItem -ErrorAction Stop
    } catch {
      $existingFile = $null
    }

    if ($existingFile -and -not $Overwrite) {
      Write-Host "Pomijam: $settingsFileUrl - plik juz istnieje"
      continue
    }

    if ($PSCmdlet.ShouldProcess($settingsFileUrl, "Utworz nazewnictwo.json V$NamingStandardVersion")) {
      Add-PnPFile -Path $tempFile -Folder $designFolderUrl -NewFileName $settingsFileName | Out-Null
      $listItem = Get-PnPFile -Url $settingsFileUrl -AsListItem

      $shouldResetPermissions = $ReadGroups.Count -gt 0 -or $OwnerGroups.Count -gt 0
      $hasResetPermissions = $false
      foreach ($groupName in $OwnerGroups) {
        if ($shouldResetPermissions -and -not $hasResetPermissions) {
          Set-PnPListItemPermission -List $Library -Identity $listItem.Id -Group $groupName -AddRole "Full Control" -ClearExisting | Out-Null
          $hasResetPermissions = $true
        } else {
          Set-PnPListItemPermission -List $Library -Identity $listItem.Id -Group $groupName -AddRole "Full Control" | Out-Null
        }
      }

      foreach ($groupName in $ReadGroups) {
        Set-PnPListItemPermission -List $Library -Identity $listItem.Id -Group $groupName -AddRole "Read" | Out-Null
      }

      Write-Host "Ustawiono: $settingsFileUrl"
    }
  }
} finally {
  Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
}

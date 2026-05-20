[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectsRoot,

  [ValidateSet(3, 4)]
  [int]$NamingStandardVersion = 3,

  [string[]]$ProjectNames = @(),

  [switch]$Overwrite
)

$ErrorActionPreference = "Stop"

$designFolderName = "4. Projektowanie"
$edtFolderName = "2. EDT"
$pdfFolderName = "3. PDF"
$settingsFileName = "nazewnictwo.json"
$jsonContent = @{ namingStandardVersion = $NamingStandardVersion } | ConvertTo-Json -Depth 2

if (-not (Test-Path -LiteralPath $ProjectsRoot -PathType Container)) {
  throw "Folder projektow nie istnieje: $ProjectsRoot"
}

$projectFolders = Get-ChildItem -LiteralPath $ProjectsRoot -Directory

if ($ProjectNames.Count -gt 0) {
  $selected = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($projectName in $ProjectNames) {
    [void]$selected.Add($projectName)
  }

  $projectFolders = $projectFolders | Where-Object { $selected.Contains($_.Name) }
}

foreach ($projectFolder in $projectFolders) {
  $designFolderPath = Join-Path $projectFolder.FullName $designFolderName
  $edtFolderPath = Join-Path $designFolderPath $edtFolderName
  $pdfFolderPath = Join-Path $designFolderPath $pdfFolderName
  $settingsPath = Join-Path $designFolderPath $settingsFileName

  if (-not (Test-Path -LiteralPath $designFolderPath -PathType Container)) {
    Write-Host "Pomijam: $($projectFolder.Name) - brak folderu $designFolderName"
    continue
  }

  if (-not (Test-Path -LiteralPath $edtFolderPath -PathType Container)) {
    Write-Host "Pomijam: $($projectFolder.Name) - brak folderu $designFolderName\$edtFolderName"
    continue
  }

  if (-not (Test-Path -LiteralPath $pdfFolderPath -PathType Container)) {
    Write-Host "Pomijam: $($projectFolder.Name) - brak folderu $designFolderName\$pdfFolderName"
    continue
  }

  if ((Test-Path -LiteralPath $settingsPath -PathType Leaf) -and -not $Overwrite) {
    Write-Host "Pomijam: $($projectFolder.Name) - $settingsFileName juz istnieje"
    continue
  }

  if ($PSCmdlet.ShouldProcess($settingsPath, "Zapisz namingStandardVersion $NamingStandardVersion")) {
    Set-Content -LiteralPath $settingsPath -Value $jsonContent -Encoding UTF8
    Write-Host "Zapisano: $settingsPath"
  }
}

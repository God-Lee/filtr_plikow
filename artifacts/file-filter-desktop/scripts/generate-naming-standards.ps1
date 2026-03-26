param(
  [string]$WorkbookPath = (Join-Path $PSScriptRoot "..\assets\Standard nazewnictwa.xlsm"),
  [string]$OutputPath = (Join-Path $PSScriptRoot "..\shared\naming-standards.json")
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-ZipEntryText {
  param(
    [System.IO.Compression.ZipArchive]$Archive,
    [string]$EntryPath
  )

  $entry = $Archive.Entries | Where-Object { $_.FullName -eq $EntryPath } | Select-Object -First 1
  if (-not $entry) {
    throw "Nie znaleziono wpisu '$EntryPath' w workbooku."
  }

  $reader = [System.IO.StreamReader]::new($entry.Open())
  try {
    return $reader.ReadToEnd()
  }
  finally {
    $reader.Dispose()
  }
}

function Convert-ColumnLettersToNumber {
  param([string]$Letters)

  $result = 0
  foreach ($char in $Letters.ToCharArray()) {
    $result = ($result * 26) + ([int][char]$char - [int][char]'A' + 1)
  }

  return $result
}

function Convert-ColumnNumberToLetters {
  param([int]$Number)

  $result = ""
  $value = $Number
  while ($value -gt 0) {
    $remainder = ($value - 1) % 26
    $result = [char]([int][char]'A' + $remainder) + $result
    $value = [math]::Floor(($value - 1) / 26)
  }

  return $result
}

function Get-SharedStrings {
  param([xml]$SharedStringsXml)

  $values = @()
  foreach ($stringNode in $SharedStringsXml.SelectNodes("//*[local-name()='si']")) {
    $text = ($stringNode.SelectNodes(".//*[local-name()='t']") | ForEach-Object { $_.InnerText }) -join ""
    $values += $text
  }

  return ,$values
}

function Get-WorksheetCellValues {
  param(
    [xml]$SheetXml,
    [string[]]$SharedStrings
  )

  $cellValues = @{}
  foreach ($cell in $SheetXml.SelectNodes("//*[local-name()='sheetData']/*[local-name()='row']/*[local-name()='c']")) {
    $ref = $cell.r
    $valueNode = $cell.SelectSingleNode("./*[local-name()='v']")
    if (-not $ref -or -not $valueNode) {
      continue
    }

    $rawValue = $valueNode.InnerText
    if ($cell.t -eq "s") {
      $cellValues[$ref] = $SharedStrings[[int]$rawValue]
      continue
    }

    $cellValues[$ref] = $rawValue
  }

  return $cellValues
}

function Expand-Range {
  param([string]$RangeRef)

  if ($RangeRef -notmatch '^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$') {
    throw "Nieobsługiwany zakres '$RangeRef'."
  }

  $startColumn = Convert-ColumnLettersToNumber $matches[1]
  $startRow = [int]$matches[2]
  $endColumn = Convert-ColumnLettersToNumber $matches[3]
  $endRow = [int]$matches[4]

  $refs = @()
  for ($column = $startColumn; $column -le $endColumn; $column += 1) {
    $letters = Convert-ColumnNumberToLetters $column
    for ($row = $startRow; $row -le $endRow; $row += 1) {
      $refs += "$letters$row"
    }
  }

  return $refs
}

function Convert-ValuesToMap {
  param([string[]]$Values)

  $result = [ordered]@{}
  foreach ($value in $Values) {
    $trimmed = $value.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed)) {
      continue
    }

    if ($trimmed -match '^([A-Z0-9]+)\s*-\s*(.+)$') {
      $result[$matches[1]] = $trimmed
    }
  }

  return $result
}

$resolvedWorkbookPath = (Resolve-Path $WorkbookPath).Path
$archive = [System.IO.Compression.ZipFile]::OpenRead($resolvedWorkbookPath)

try {
  [xml]$sharedStringsXml = Get-ZipEntryText -Archive $archive -EntryPath "xl/sharedStrings.xml"
  [xml]$worksheetXml = Get-ZipEntryText -Archive $archive -EntryPath "xl/worksheets/sheet1.xml"

  $sharedStrings = Get-SharedStrings -SharedStringsXml $sharedStringsXml
  $cellValues = Get-WorksheetCellValues -SheetXml $worksheetXml -SharedStrings $sharedStrings

  $definitionsByField = [ordered]@{
    "B7" = "phases"
    "C7" = "disciplines"
    "D7" = "documentTypes"
    "E7" = "levels"
    "H7" = "revisions"
    "I7" = "statuses"
  }

  $namingStandards = [ordered]@{}
  foreach ($dataValidation in $worksheetXml.SelectNodes("//*[local-name()='dataValidation']")) {
    $sqref = $dataValidation.sqref
    if (-not $definitionsByField.Contains($sqref)) {
      continue
    }

    $formulaNode = $dataValidation.SelectSingleNode("./*[local-name()='formula1']")
    if (-not $formulaNode) {
      continue
    }

    $rangeRef = $formulaNode.InnerText.Trim().TrimStart('=')
    $values = foreach ($cellRef in Expand-Range $rangeRef) {
      if ($cellValues.ContainsKey($cellRef)) {
        $cellValues[$cellRef]
      }
    }

    $namingStandards[$definitionsByField[$sqref]] = Convert-ValuesToMap -Values $values
  }

  $outputDirectory = Split-Path -Parent $OutputPath
  if ($outputDirectory -and -not (Test-Path $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
  }

  $json = $namingStandards | ConvertTo-Json -Depth 5
  [System.IO.File]::WriteAllText($OutputPath, "$json`n", [System.Text.Encoding]::UTF8)
}
finally {
  $archive.Dispose()
}

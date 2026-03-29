param(
  [Parameter(Mandatory = $true)]
  [string]$OutputPath,
  [Parameter(Mandatory = $true)]
  [string]$DataPath
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

function Escape-XmlText {
  param([string]$Value)

  if ($null -eq $Value) {
    return ""
  }

  return [System.Security.SecurityElement]::Escape($Value)
}

function New-InlineStringCell {
  param(
    [string]$Reference,
    [string]$Value
  )

  $escaped = Escape-XmlText $Value
  return "<c r=`"$Reference`" t=`"inlineStr`"><is><t xml:space=`"preserve`">$escaped</t></is></c>"
}

$disciplineHeader = "Bran" + [char]0x017C + "a"
$sheetName = "Raport b" + [char]0x0142 + [char]0x0119 + "dnych plik" + [char]0x00F3 + "w"

$rows = Get-Content -Raw -Encoding UTF8 $DataPath | ConvertFrom-Json
$lastRowNumber = ($rows | Measure-Object).Count + 1
$dimension = "A1:B$lastRowNumber"

$sheetRows = [System.Collections.Generic.List[string]]::new()
$sheetRows.Add("<row r=`"1`">$(New-InlineStringCell -Reference "A1" -Value "Nazwa pliku")$(New-InlineStringCell -Reference "B1" -Value $disciplineHeader)</row>")

$rowIndex = 2
foreach ($row in $rows) {
  $sheetRows.Add("<row r=`"$rowIndex`">$(New-InlineStringCell -Reference "A$rowIndex" -Value $row.fileName)$(New-InlineStringCell -Reference "B$rowIndex" -Value $row.discipline)</row>")
  $rowIndex += 1
}

$worksheetXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="$dimension"/>
  <sheetViews>
    <sheetView workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="48" customWidth="1"/>
    <col min="2" max="2" width="22" customWidth="1"/>
  </cols>
  <sheetData>
    $($sheetRows -join "`n    ")
  </sheetData>
  <autoFilter ref="$dimension"/>
</worksheet>
"@

$contentTypesXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>
"@

$rootRelsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
"@

$workbookXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="$sheetName" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>
"@

$workbookRelsXml = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>
"@

$utf8WithBom = [System.Text.UTF8Encoding]::new($true)

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory -and -not (Test-Path $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

if (Test-Path $OutputPath) {
  Remove-Item $OutputPath -Force
}

$fileStream = [System.IO.File]::Open($OutputPath, [System.IO.FileMode]::CreateNew)
try {
  $archive = [System.IO.Compression.ZipArchive]::new($fileStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
  try {
    $entries = [ordered]@{
      "[Content_Types].xml" = $contentTypesXml
      "_rels/.rels" = $rootRelsXml
      "xl/workbook.xml" = $workbookXml
      "xl/_rels/workbook.xml.rels" = $workbookRelsXml
      "xl/worksheets/sheet1.xml" = $worksheetXml
    }

    foreach ($entryPath in $entries.Keys) {
      $entry = $archive.CreateEntry($entryPath, [System.IO.Compression.CompressionLevel]::Optimal)
      $writer = [System.IO.StreamWriter]::new($entry.Open(), $utf8WithBom)
      try {
        $writer.Write($entries[$entryPath])
      }
      finally {
        $writer.Dispose()
      }
    }
  }
  finally {
    $archive.Dispose()
  }
}
finally {
  $fileStream.Dispose()
}

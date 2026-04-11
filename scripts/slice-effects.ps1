param(
  [Parameter(Mandatory = $true)]
  [string]$SourceRoot,

  [int]$TileWidth = 32,
  [int]$TileHeight = 32,

  [string]$OutputRoot = ""
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function New-DirectoryIfMissing {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Get-OutputDirectory {
  param(
    [string]$InputFile,
    [string]$SourceBase,
    [string]$DestinationBase
  )

  $relativeDir = Split-Path -Parent ($InputFile.Substring($SourceBase.Length).TrimStart('\'))
  $fileName = [System.IO.Path]::GetFileNameWithoutExtension($InputFile)

  if ([string]::IsNullOrWhiteSpace($relativeDir)) {
    return Join-Path $DestinationBase $fileName
  }

  return Join-Path (Join-Path $DestinationBase $relativeDir) $fileName
}

$resolvedSourceRoot = (Resolve-Path $SourceRoot).Path
$resolvedOutputRoot = if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  Join-Path $resolvedSourceRoot "sliced"
} else {
  [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputRoot))
}

New-DirectoryIfMissing -Path $resolvedOutputRoot

$pngFiles = Get-ChildItem -LiteralPath $resolvedSourceRoot -Recurse -File -Filter *.png |
  Where-Object { $_.DirectoryName -notlike "$resolvedOutputRoot*" }

if (-not $pngFiles) {
  Write-Host "No PNG files found under $resolvedSourceRoot"
  exit 0
}

$sheetCount = 0
$frameCount = 0

foreach ($file in $pngFiles) {
  $image = [System.Drawing.Bitmap]::FromFile($file.FullName)

  try {
    if (($image.Width % $TileWidth) -ne 0 -or ($image.Height % $TileHeight) -ne 0) {
      Write-Warning "Skipping $($file.FullName) because its size $($image.Width)x$($image.Height) is not divisible by ${TileWidth}x${TileHeight}."
      continue
    }

    $columns = [int]($image.Width / $TileWidth)
    $rows = [int]($image.Height / $TileHeight)
    $outputDir = Get-OutputDirectory -InputFile $file.FullName -SourceBase $resolvedSourceRoot -DestinationBase $resolvedOutputRoot
    New-DirectoryIfMissing -Path $outputDir

    $sheetCount++

    for ($row = 0; $row -lt $rows; $row++) {
      for ($column = 0; $column -lt $columns; $column++) {
        $frame = New-Object System.Drawing.Bitmap $TileWidth, $TileHeight
        $graphics = [System.Drawing.Graphics]::FromImage($frame)

        try {
          $graphics.Clear([System.Drawing.Color]::Transparent)
          $sourceRect = New-Object System.Drawing.Rectangle ($column * $TileWidth), ($row * $TileHeight), $TileWidth, $TileHeight
          $destRect = New-Object System.Drawing.Rectangle 0, 0, $TileWidth, $TileHeight
          $graphics.DrawImage($image, $destRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
        } finally {
          $graphics.Dispose()
        }

        try {
          $frameIndex = ($row * $columns) + $column + 1
          $framePath = Join-Path $outputDir ("frame-{0:D3}.png" -f $frameIndex)
          $frame.Save($framePath, [System.Drawing.Imaging.ImageFormat]::Png)
          $frameCount++
        } finally {
          $frame.Dispose()
        }
      }
    }
  } finally {
    $image.Dispose()
  }
}

Write-Host "Sliced $sheetCount sheet(s) into $frameCount frame(s). Output: $resolvedOutputRoot"

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$terrainDir = Join-Path $PSScriptRoot '..\frontend\public\sprites\terrain'

$palette = @{
  '0' = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
  '1' = [System.Drawing.Color]::FromArgb(255, 23, 24, 27)
  '2' = [System.Drawing.Color]::FromArgb(255, 45, 39, 55)
  '3' = [System.Drawing.Color]::FromArgb(255, 63, 55, 76)
  '4' = [System.Drawing.Color]::FromArgb(255, 82, 72, 95)
  '5' = [System.Drawing.Color]::FromArgb(255, 102, 92, 116)
  '6' = [System.Drawing.Color]::FromArgb(255, 126, 114, 141)
  '7' = [System.Drawing.Color]::FromArgb(255, 150, 138, 166)
  '8' = [System.Drawing.Color]::FromArgb(255, 93, 82, 106)
  '9' = [System.Drawing.Color]::FromArgb(255, 176, 162, 194)
}

function Write-Tile {
  param(
    [string]$Name,
    [string[]]$Rows
  )

  $bitmap = New-Object System.Drawing.Bitmap 8, 8
  for ($y = 0; $y -lt 8; $y++) {
    for ($x = 0; $x -lt 8; $x++) {
      $key = $Rows[$y][$x].ToString()
      $color = $palette[$key]
      if ($null -eq $color) {
        throw "Unknown palette key '$key' in $Name at $x,$y"
      }
      $bitmap.SetPixel($x, $y, $color)
    }
  }

  $path = Join-Path $terrainDir $Name
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

Write-Tile 'crypt-floor-8x8.png' @(
  '54454545',
  '45545454',
  '54565545',
  '45654554',
  '54545645',
  '45456554',
  '54545455',
  '45544544'
)

Write-Tile 'crypt-floor-cracked-8x8.png' @(
  '54454545',
  '45145454',
  '54161545',
  '41615154',
  '54114645',
  '45416154',
  '54541455',
  '45544514'
)

Write-Tile 'crypt-wall-8x8.png' @(
  '33333333',
  '45654564',
  '34433443',
  '56545654',
  '43344334',
  '65456545',
  '34433443',
  '56545654'
)

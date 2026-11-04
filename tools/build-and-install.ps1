# Builds the TV app (local shell + offline copy of the code + photos + icons)
# and installs it on the TV with LG's official webOS CLI.
. "$PSScriptRoot\common.ps1"
Add-Type -AssemblyName PresentationCore, WindowsBase

function Convert-Photo($src, $dst) {
  # Decode, turn the right way up, shrink to fit 1920x1080, save as a fresh JPEG.
  # The new file is built from pixels only, so camera, date and GPS details are dropped.
  $fs = [IO.File]::OpenRead($src)
  try {
    $dec = [Windows.Media.Imaging.BitmapDecoder]::Create($fs,
      [Windows.Media.Imaging.BitmapCreateOptions]::IgnoreColorProfile,
      [Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
    $frame = $dec.Frames[0]
    $o = 1
    foreach ($q in '/app1/ifd/{ushort=274}', '/ifd/{ushort=274}') {
      try { $v = $frame.Metadata.GetQuery($q); if ($v) { $o = [int]$v; break } } catch {}
    }
  } finally { $fs.Close() }
  $angle = 0; $flip = $false
  switch ($o) { 2 { $flip = $true } 3 { $angle = 180 } 4 { $angle = 180; $flip = $true }
                5 { $angle = 270; $flip = $true } 6 { $angle = 90 } 7 { $angle = 90; $flip = $true } 8 { $angle = 270 } }
  $w = $frame.PixelWidth; $h = $frame.PixelHeight
  if ($angle -eq 90 -or $angle -eq 270) { $t = $w; $w = $h; $h = $t }
  $scale = [Math]::Min(1.0, [Math]::Min(1920.0 / $w, 1080.0 / $h))
  $sx = $scale; if ($flip) { $sx = -$scale }
  $tg = New-Object Windows.Media.TransformGroup
  $tg.Children.Add((New-Object Windows.Media.ScaleTransform -ArgumentList $sx, $scale))
  if ($angle) { $tg.Children.Add((New-Object Windows.Media.RotateTransform -ArgumentList $angle)) }
  $tb = New-Object Windows.Media.Imaging.TransformedBitmap -ArgumentList $frame, $tg
  $cv = New-Object Windows.Media.Imaging.FormatConvertedBitmap -ArgumentList $tb, ([Windows.Media.PixelFormats]::Bgr24), $null, 0
  $enc = New-Object Windows.Media.Imaging.JpegBitmapEncoder
  $enc.QualityLevel = 85
  $enc.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($cv))
  $out = [IO.File]::Create($dst)
  try { $enc.Save($out) } finally { $out.Close() }
}

function Build-And-Install {
  Refresh-Path
  $s = Load-Settings
  if (-not $s -or -not $s.GitHubUser) { Fail 'Run 1-First-time-setup.bat first.' }
  $user = $s.GitHubUser.ToLower()
  $Remote = "https://$user.github.io/$RepoName/"
  $Origin = "https://$user.github.io"

  if ((Test-Path (Join-Path $Root '.git')) -and (Has git)) {
    Push-Location $Root; git pull --ff-only --quiet 2>$null | Out-Null; Pop-Location
  }

  $Build = Join-Path $Root 'build'; $App = Join-Path $Build 'app'; $Out = Join-Path $Build 'out'
  if (Test-Path $Build) { Remove-Item $Build -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $App, $Out | Out-Null
  Copy-Item (Join-Path $Root 'shell\*') $App -Recurse
  New-Item -ItemType Directory -Force -Path "$App\fallback", "$App\photos", "$App\icons" | Out-Null

  $info = Get-Content "$App\appinfo.json" -Raw | ConvertFrom-Json
  foreach ($f in 'index.html', 'loader.js') {
    $p = Join-Path $App $f
    $t = [IO.File]::ReadAllText($p).Replace('__REMOTE_BASE__', $Remote).Replace('__REMOTE_ORIGIN__', $Origin).Replace('__SHELL_VERSION__', $info.version)
    [IO.File]::WriteAllText($p, $t)
  }
  Ok "App set to load its live code from $Remote"

  Say 'Saving an offline copy of the app code inside the TV app'
  $live = $true
  foreach ($f in 'app.js', 'app.css') {
    try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 20 -Uri ($Remote + $f + '?t=' + [DateTime]::Now.Ticks) -OutFile "$App\fallback\$f" }
    catch { $live = $false }
  }
  if ($live -and (Select-String -Path "$App\fallback\app.js" -Pattern 'TVHOME_STARTED' -Quiet)) { Ok 'Offline copy is the latest live version' }
  else {
    Copy-Item (Join-Path $Root 'app.js'), (Join-Path $Root 'app.css') "$App\fallback\" -Force
    Warn 'GitHub Pages was not reachable yet, so the copy on this PC was used instead (that is fine).'
  }

  Say 'Preparing photos'
  $inbox = Join-Path $Root 'photos-inbox'
  # A zip downloaded from a Google Photos album can be dropped straight in
  Get-ChildItem $inbox -Filter *.zip -File | ForEach-Object {
    Expand-Archive $_.FullName -DestinationPath $inbox -Force
    Remove-Item $_.FullName
    Ok "Unpacked $($_.Name)"
  }
  $exts = '.jpg', '.jpeg', '.png', '.heic', '.heif', '.bmp', '.tif', '.tiff', '.webp'
  $files = @(Get-ChildItem $inbox -File -Recurse | Where-Object { $exts -contains $_.Extension.ToLower() } | Sort-Object FullName)
  $list = @(); $n = 0; $skipped = 0
  foreach ($f in $files) {
    $name = 'p{0:D3}.jpg' -f ($n + 1)
    try {
      Convert-Photo $f.FullName (Join-Path $App "photos\$name")
      $n++; $list += "photos/$name"
      Write-Host "  $n. $($f.Name)"
    } catch {
      $skipped++
      Warn "Skipped $($f.Name) (could not read it)"
    }
  }
  if ($skipped -and ($files | Where-Object { $_.Extension -match 'hei' })) {
    Warn 'iPhone HEIC photos need the free "HEIF Image Extensions" from the Microsoft Store, or save them as JPEG.'
  }
  $json = ConvertTo-Json -InputObject @($list) -Compress
  [IO.File]::WriteAllText("$App\photos\list.js", "window.TVHOME_PHOTOS = $json;")
  [IO.File]::WriteAllText("$App\photos\list.json", $json)
  Ok "$n photos ready (resized, details removed)"

  $iconMap = @{}
  Get-ChildItem (Join-Path $Root 'my-icons') -File | Where-Object { '.png', '.jpg', '.jpeg', '.webp', '.svg' -contains $_.Extension.ToLower() } | ForEach-Object {
    $key = ($_.BaseName.ToLower() -replace '[^a-z0-9]', '')
    $dst = $key + $_.Extension.ToLower()
    Copy-Item $_.FullName "$App\icons\$dst"
    $iconMap[$key] = "icons/$dst"
  }
  if ($iconMap.Count) { Ok "$($iconMap.Count) icons of your own added" }

  Say 'Getting the official app logos'
  # Downloaded here and bundled into the TV app only, never stored on GitHub.
  # Each file is checked against a pinned fingerprint before it is used.
  $sources = Get-Content (Join-Path $PSScriptRoot 'logo-sources.json') -Raw | ConvertFrom-Json
  $cache = Join-Path $Root 'logo-cache'
  New-Item -ItemType Directory -Force -Path $cache | Out-Null
  $logos = 0
  foreach ($p in $sources.logos.PSObject.Properties) {
    $key = $p.Name; $want = "$($p.Value.sha256)".ToLower()
    if ($iconMap.ContainsKey($key)) { continue }   # your own icon wins
    $file = Join-Path $cache "$key.svg"
    if (-not (Test-Path $file)) {
      try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 30 -UserAgent 'TVHomeBuild/1.0 (personal use)' -Uri $p.Value.url -OutFile $file }
      catch { Warn "Could not download the $key logo this time (the tile shows its name instead)"; continue }
    }
    $got = (Get-FileHash $file -Algorithm SHA256).Hash.ToLower()
    $txt = [IO.File]::ReadAllText($file)
    $bad = $txt -notmatch '<svg' -or $txt -match '<script|javascript:|foreignObject'
    if ($bad -or ($want -and $got -ne $want)) {
      Warn "The $key logo was not the expected file, so it was skipped"
      Remove-Item $file -Force; continue
    }
    Copy-Item $file "$App\icons\logo-$key.svg"
    $iconMap[$key] = "icons/logo-$key.svg"
    $logos++
  }
  Ok "$logos app logos ready"
  [IO.File]::WriteAllText("$App\icons\list.js", 'window.TVHOME_ICONS = ' + (ConvertTo-Json -InputObject $iconMap -Compress) + ';')

  Say 'Packaging the app'
  ares-package $App -o $Out -n
  $ipk = Get-ChildItem $Out -Filter *.ipk | Select-Object -First 1
  if ($LASTEXITCODE -ne 0 -or -not $ipk) { Fail 'Packaging failed (see the messages above).' }
  Ok "Packaged $($ipk.Name) ($([Math]::Round($ipk.Length / 1MB, 1)) MB)"

  Wait-Enter "On the TV: open the Developer Mode app and switch Key Server ON."
  Check-TV
  Say 'Installing on the TV (this can take a minute with photos)'
  ares-install -d $Device $ipk.FullName
  if ($LASTEXITCODE -ne 0) { Fail 'Install failed (see the messages above).' }
  Ok 'Installed'
  ares-launch -d $Device $AppId | Out-Null
  Ok 'Home is opening on the TV'
  Write-Host ''
  Write-Host '  IMPORTANT: on the TV, switch Key Server OFF again in the Developer Mode app.' -ForegroundColor Yellow
}

if ($MyInvocation.InvocationName -ne '.') { Run-Safely { Build-And-Install } }

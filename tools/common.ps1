# Shared settings and helpers for the TV Home scripts (Windows PowerShell 5.1)
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Root = Split-Path -Parent $PSScriptRoot
$SettingsFile = Join-Path $Root 'settings.json'
$RepoName = 'tv-home'
$AppId = 'com.tomruff.tvhome'
$Device = 'tv'

function Say($m)  { Write-Host ''; Write-Host $m -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  OK   $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  NOTE $m" -ForegroundColor Yellow }
function Fail($m) { throw $m }
function Wait-Enter($m) { Write-Host ''; Write-Host $m -ForegroundColor White; Read-Host 'Press Enter when ready' | Out-Null }
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Has($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Load-Settings {
  if (Test-Path $SettingsFile) { return (Get-Content $SettingsFile -Raw | ConvertFrom-Json) }
  return $null
}
function Save-Settings($o) { $o | ConvertTo-Json | Set-Content $SettingsFile -Encoding UTF8 }
function Run-Safely([scriptblock]$body) {
  try { & $body }
  catch {
    Write-Host ''
    Write-Host "  STOPPED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host '  Nothing on the TV has been changed by this step. Copy or photograph this window and send it to Claude.' -ForegroundColor Red
  }
}
function Check-TV {
  $r = (ares-novacom -d $Device --run 'echo connected' | Out-String).Trim()
  if ($r -notmatch 'connected') {
    Fail "Could not reach the TV. Check it is switched on, on the same Wi-Fi, and the Developer Mode app shows Dev Mode Status ON."
  }
  Ok 'TV is reachable'
}

# Reads the Developer Mode session token from the TV and stores it as a GitHub
# Actions secret. The token is never shown on screen or saved to a file.
. "$PSScriptRoot\common.ps1"

$TokenFile = '/var/luna/preferences/devmode_enabled'

function Describe-Safely($text) {
  # Describes what the TV sent back without ever showing a token
  $t = "$text"
  $kinds = @()
  if ($t -cmatch '[a-z]') { $kinds += 'lowercase' }
  if ($t -cmatch '[A-Z]') { $kinds += 'capitals' }
  if ($t -match '[0-9]') { $kinds += 'digits' }
  $other = (($t -replace '[A-Za-z0-9\s]', '').ToCharArray() | Sort-Object -Unique) -join ' '
  Write-Host "    Characters received: $($t.Length), lines: $(@($t -split "`n").Count)"
  Write-Host "    Made of: $($kinds -join ', ')$(if ($other) { "; symbols: $other" })"
}

function Read-TVToken {
  $raw = (ares-novacom -d $Device --run "cat $TokenFile" 2>&1 | ForEach-Object { "$_" }) -join "`n"
  # Use the longest token-looking piece of the reply (ignores any extra messages)
  $best = ''
  foreach ($m in [regex]::Matches($raw, '[A-Za-z0-9+/=_.\-]{16,}')) { if ($m.Value.Length -gt $best.Length) { $best = $m.Value } }
  if ($best -and $best -notmatch 'devmode_enabled|preferences') { return $best }

  Write-Host ''
  Write-Host '  The TV did not hand over a token. Safe details for Claude (no secrets shown):' -ForegroundColor Yellow
  if ($raw -match 'No such file') { Write-Host '    Reason: the token file does not exist on this TV' }
  elseif ($raw -match 'denied|not permitted') { Write-Host '    Reason: the TV refused to let Developer Mode read the token file' }
  elseif (-not $raw.Trim()) { Write-Host '    Reason: the TV sent back nothing' }
  else { Write-Host '    Reason: the reply did not look like a token' }
  Describe-Safely $raw
  Write-Host '    Files in the TV settings folder:'
  (ares-novacom -d $Device --run 'ls /var/luna/preferences' 2>&1 | ForEach-Object { "      $_" }) | Write-Host
  return $null
}

function Set-RenewToken {
  $s = Load-Settings
  if (-not $s -or -not $s.GitHubUser) { Fail 'Run 1-First-time-setup.bat first.' }
  $repo = "$($s.GitHubUser)/$RepoName"

  Say 'Reading the Developer Mode token from the TV'
  Check-TV
  $tok = Read-TVToken
  if (-not $tok) { Fail 'No token yet. Photograph this window and send it to Claude. Your app and photos are not affected.' }
  Ok "Token read ($($tok.Length) characters, not shown for safety)"

  gh secret set DEVMODE_TOKEN --repo $repo --body $tok | Out-Null
  $tok = $null
  if ($LASTEXITCODE -ne 0) { Fail 'GitHub would not save the token secret.' }
  Ok 'Token saved as a private GitHub secret'

  Say 'Running the renewal once now to test it'
  gh workflow run devmode-renew.yml --repo $repo | Out-Null
  if ($LASTEXITCODE -ne 0) { Warn 'Could not start the test run. It will still run on its own every 12 hours.'; return }
  Start-Sleep -Seconds 10
  $id = (gh run list --repo $repo --workflow devmode-renew.yml --limit 1 --json databaseId --jq '.[0].databaseId' | Out-String).Trim()
  if ($id) {
    gh run watch $id --repo $repo --exit-status | Out-Null
    if ($LASTEXITCODE -eq 0) { Ok 'Renewal test passed. Developer Mode will now be topped up every 12 hours.' }
    else {
      Warn 'The renewal test did not pass. Here is what LG replied:'
      gh run view $id --repo $repo --log | Select-String 'reply:'
    }
  }
}

if ($MyInvocation.InvocationName -ne '.') { Run-Safely { Set-RenewToken } }

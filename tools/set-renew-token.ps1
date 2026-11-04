# Reads the Developer Mode session token from the TV and stores it as a GitHub
# Actions secret. The token is never shown on screen or saved to a file.
. "$PSScriptRoot\common.ps1"

function Set-RenewToken {
  $s = Load-Settings
  if (-not $s -or -not $s.GitHubUser) { Fail 'Run 1-First-time-setup.bat first.' }
  $repo = "$($s.GitHubUser)/$RepoName"

  Say 'Reading the Developer Mode token from the TV'
  Check-TV
  $tok = (ares-novacom -d $Device --run 'cat /var/luna/preferences/devmode_enabled' | Out-String).Trim()
  if ($tok -notmatch '^[A-Za-z0-9_\-]{16,}$') {
    $tok = $null
    Fail 'The TV did not hand over a token. Make sure Developer Mode is ON in the Developer Mode app on the TV.'
  }
  Ok 'Token read (not shown, for safety)'

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

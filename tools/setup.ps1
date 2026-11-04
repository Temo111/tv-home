# One-time setup: tools, GitHub repo + Pages, 2FA check, Developer Mode renewal, first install.
. "$PSScriptRoot\common.ps1"
. "$PSScriptRoot\set-renew-token.ps1"
. "$PSScriptRoot\build-and-install.ps1"

function Install-Tool($cmd, $wingetId, $label) {
  if (Has $cmd) { Ok "$label is installed"; return }
  Say "Installing $label (Windows may ask for permission: click Yes)"
  winget install --id $wingetId -e --source winget --accept-package-agreements --accept-source-agreements
  Refresh-Path
  if (-not (Has $cmd)) { Fail "$label did not install. Close this window, open it again and rerun. If it still fails, send Claude a photo." }
  Ok "$label installed"
}

function Setup {
  Set-Location $Root
  Refresh-Path

  Say 'Step 1 of 5: checking the tools on this PC'
  if (-not (Has node)) { Fail 'Node.js is missing. It was used for the first install, so this is unexpected: send Claude a photo of this window.' }
  if (-not (Has ares-package)) { npm install -g @webos-tools/cli; Refresh-Path }
  if (-not (Has ares-package)) { Fail 'The LG webOS CLI is not installed.' }
  Ok 'LG webOS CLI is installed'
  Install-Tool git 'Git.Git' 'Git'
  Install-Tool gh 'GitHub.cli' 'GitHub CLI'

  Say 'Step 2 of 5: signing in to GitHub'
  gh auth status -h github.com 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Host '  A one-time code will appear below and your browser will open.' -ForegroundColor White
    Write-Host '  Press Enter, then in the browser paste the code and click Authorize.' -ForegroundColor White
    gh auth login -h github.com -p https -w -s workflow
  } else {
    gh auth refresh -h github.com -s workflow
  }
  if ($LASTEXITCODE -ne 0) { Fail 'GitHub sign-in did not finish.' }
  gh auth setup-git | Out-Null
  $user = (gh api user --jq .login | Out-String).Trim()
  $uid = (gh api user --jq .id | Out-String).Trim()
  if (-not $user) { Fail 'Could not read your GitHub username.' }
  Ok "Signed in as $user"
  Save-Settings ([pscustomobject]@{ GitHubUser = $user })

  $tfa = (gh api user --jq .two_factor_authentication | Out-String).Trim()
  if ($tfa -eq 'true') { Ok 'Two-factor sign-in is ON for your GitHub account' }
  else {
    Warn 'Could not confirm two-factor sign-in is on. Your GitHub account now controls code that runs on your TV, so it matters.'
    Start-Process 'https://github.com/settings/security'
    Wait-Enter '  In the page that just opened, check "Two-factor authentication" says Enabled. If not, click Enable and follow the steps.'
  }

  Say 'Step 3 of 5: publishing the app code to GitHub'
  if (-not (Test-Path (Join-Path $Root '.git'))) { git init -q -b main }
  git config user.name $user
  git config user.email "$uid+$user@users.noreply.github.com"
  git add -A
  $leak = @(git ls-files | Where-Object { ($_ -match '^(photos-inbox|my-icons)/' -and $_ -notmatch 'README\.txt$') -or $_ -match '^(build/|settings\.json)' -or $_ -match '\.ipk$' })
  if ($leak.Count) { Fail "Personal files were about to be published: $($leak -join ', ')" }
  git commit -q -m 'TV Home: hosted app code' 2>$null | Out-Null
  gh repo view "$user/$RepoName" 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    gh repo create $RepoName --public --source . --remote origin --push --description "Tom's TV Home launcher (hosted code)"
  } else {
    git remote get-url origin 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { git remote add origin "https://github.com/$user/$RepoName.git" }
    git push -u origin main
  }
  if ($LASTEXITCODE -ne 0) { Fail 'Could not upload to GitHub.' }
  Ok "Code is at https://github.com/$user/$RepoName"

  gh api -X POST "repos/$user/$RepoName/pages" -f 'source[branch]=main' -f 'source[path]=/' 2>$null | Out-Null
  gh api "repos/$user/$RepoName/pages" 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail 'Could not switch on GitHub Pages.' }
  gh api -X PUT "repos/$user/$RepoName/pages" -F https_enforced=true 2>$null | Out-Null
  Ok "GitHub Pages is on: https://$($user.ToLower()).github.io/$RepoName/"

  Say 'Step 4 of 5: keeping Developer Mode alive automatically'
  Wait-Enter '  Make sure the TV is on and on the same Wi-Fi as this PC.'
  Set-RenewToken

  Say 'Step 5 of 5: building and installing the app'
  Build-And-Install

  Say 'All done.'
}

Run-Safely { Setup }

param(
  [string]$Mode = "dashboard"
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$DemoDir = Join-Path $RootDir "examples\demo-expo"

function Show-Usage {
  @"
usage: .\script\build_and_run.ps1 [mode]

Modes:
  dashboard, start, run   Start the Expo Live Lens dashboard
  --demo, demo            Start the demo Expo app
  --demo-offline          Start the demo Expo app in offline mode
  --review-ui             Pull a UI review prompt
  --review-bug            Pull a bug-triage review prompt
  --review-polish         Pull a polish review prompt
  --review-mobile         Pull a senior mobile-dev review prompt
  --mobile-insights       Pull prioritized mobile-development insights
  --timeline              Pull the replay timeline
  --capture-now           Request a screenshot capture from the connected app
  --session-start         Start a recorded mobile session
  --session-stop          Stop the active recorded mobile session
  --session-pull          Pull the latest session packet and review prompt
  --review-now            Request a fresh screenshot and pull the review packet
  --health                Print dashboard health
  --help, help            Show this help
"@
}

function Get-LanIp {
  $addresses = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
    Where-Object {
      $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
      -not $_.IPAddressToString.StartsWith("169.254.")
    }

  if ($addresses.Count -gt 0) {
    return $addresses[0].IPAddressToString
  }

  return "YOUR_COMPUTER_IP"
}

function Start-Dashboard {
  Set-Location $RootDir
  & node "src/server.mjs"
}

function Start-Demo([string]$ScriptName) {
  $lanIp = Get-LanIp
  $env:EXPO_PUBLIC_LIVE_LENS_URL = "http://${lanIp}:4317"
  Write-Host "Expo demo target: $env:EXPO_PUBLIC_LIVE_LENS_URL"
  Set-Location $RootDir

  if ($ScriptName -eq "start") {
    & npm.cmd --prefix $DemoDir start
    return
  }

  & npm.cmd --prefix $DemoDir run $ScriptName
}

function Run-ReviewPrompt([string]$ReviewMode) {
  Set-Location $RootDir
  & node "scripts/pull-review-prompt.mjs" $ReviewMode
}

function Run-MobileInsights {
  Set-Location $RootDir
  & node "scripts/pull-mobile-insights.mjs"
}

function Request-Capture {
  Set-Location $RootDir
  & node "scripts/request-capture.mjs" "codex-action"
}

function Run-Timeline {
  Set-Location $RootDir
  & node "scripts/pull-timeline.mjs"
}

function Run-Session([string]$SessionCommand) {
  Set-Location $RootDir
  & node "scripts/session.mjs" $SessionCommand
}

function Show-Health {
  $response = Invoke-RestMethod -UseBasicParsing "http://localhost:4317/api/health"
  $response | ConvertTo-Json -Depth 8
}

switch ($Mode) {
  "dashboard" { Start-Dashboard; break }
  "start" { Start-Dashboard; break }
  "run" { Start-Dashboard; break }
  "--demo" { Start-Demo "start"; break }
  "demo" { Start-Demo "start"; break }
  "--demo-offline" { Start-Demo "start:offline"; break }
  "demo-offline" { Start-Demo "start:offline"; break }
  "--review-ui" { Run-ReviewPrompt "ui"; break }
  "review-ui" { Run-ReviewPrompt "ui"; break }
  "--review-bug" { Run-ReviewPrompt "bug"; break }
  "review-bug" { Run-ReviewPrompt "bug"; break }
  "--review-polish" { Run-ReviewPrompt "polish"; break }
  "review-polish" { Run-ReviewPrompt "polish"; break }
  "--review-mobile" { Run-ReviewPrompt "mobile"; break }
  "review-mobile" { Run-ReviewPrompt "mobile"; break }
  "--mobile-insights" { Run-MobileInsights; break }
  "mobile-insights" { Run-MobileInsights; break }
  "--timeline" { Run-Timeline; break }
  "timeline" { Run-Timeline; break }
  "--capture-now" { Request-Capture; break }
  "capture-now" { Request-Capture; break }
  "--session-start" { Run-Session "start"; break }
  "session-start" { Run-Session "start"; break }
  "--session-stop" { Run-Session "stop"; break }
  "session-stop" { Run-Session "stop"; break }
  "--session-pull" { Run-Session "pull"; break }
  "session-pull" { Run-Session "pull"; break }
  "--review-now" {
    Set-Location $RootDir
    & node "scripts/pull-review-packet.mjs" "--now"
    break
  }
  "review-now" {
    Set-Location $RootDir
    & node "scripts/pull-review-packet.mjs" "--now"
    break
  }
  "--health" { Show-Health; break }
  "health" { Show-Health; break }
  "--help" { Show-Usage; break }
  "help" { Show-Usage; break }
  default {
    Show-Usage
    exit 2
  }
}

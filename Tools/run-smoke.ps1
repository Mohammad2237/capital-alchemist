# Runs the automated desktop route in the built player: six financial branches,
# real scene controllers, JSON ledgers + screenshots in Evidence/smoke.
# Usage: powershell -ExecutionPolicy Bypass -File Tools/run-smoke.ps1
param(
    [string]$Player = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $Player) { $Player = Join-Path $root "Builds\Windows\Capital.exe" }
$out = Join-Path $root "Evidence\smoke"
if (-not (Test-Path $Player)) { throw "Player not found: $Player" }
New-Item -ItemType Directory -Force -Path $out | Out-Null
$p = Start-Process $Player -ArgumentList @("--smoke", "--evidence", "`"$out`"") -PassThru -Wait
$report = Join-Path $out "runtime-smoke.txt"
if (Test-Path $report) { Get-Content $report } else { "No smoke report written to $out" }
exit $p.ExitCode

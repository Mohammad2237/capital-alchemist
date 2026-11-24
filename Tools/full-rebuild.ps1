# Regenerates the three scenes from code, then runs EditMode tests, the Windows build and the smoke route.
# Usage (from the project folder, Unity closed):  powershell -ExecutionPolicy Bypass -File Tools/full-rebuild.ps1
param([string]$Editor = "")
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "_find-editor.ps1")
if (-not $Editor) { $Editor = Find-CapitalEditor }
$root = Split-Path -Parent $PSScriptRoot
Write-Host "== Regenerating scenes (CapitalBuilder.BuildProject)"
$p = Start-Process $Editor -ArgumentList @("-batchmode", "-quit", "-projectPath", "`"$root`"", "-executeMethod", "CapitalBuilder.BuildProject", "-logFile", "`"$root\Evidence\setup-shop.log`"") -PassThru -Wait
if ($p.ExitCode -ne 0) { throw "Scene builder failed (exit $($p.ExitCode)). See Evidence/setup-shop.log" }
Write-Host "== EditMode tests";  & (Join-Path $PSScriptRoot "run-editmode-tests.ps1") -Editor $Editor
Write-Host "== Windows build";   & (Join-Path $PSScriptRoot "build-windows.ps1") -Editor $Editor
if ($LASTEXITCODE -ne 0) { throw "Windows build failed" }
Write-Host "== Smoke route";     & (Join-Path $PSScriptRoot "run-smoke.ps1")
